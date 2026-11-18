import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure backend and mutualfam app are in path
sys.path.insert(0, "./civiccore/backend")
sys.path.insert(0, "./civiccore/apps/mutualfam")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from civiccore.core.database import Base
from civiccore.modules.membership.models import User, Organization, OrganizationMembership, MemberStatus
from civiccore.modules.governance.models import Proposal, ProposalStatus, ProposalType, VotingMechanism
from models import ProposalRateLimit
from services.limits import (
    check_can_create_proposal,
    record_proposal_created,
    get_proposal_throttle_status,
    set_limit_override,
    reset_limit_overrides,
    format_remaining_time
)

def run_tests():
    print("========================================================")
    print("  EJECUTANDO TESTS DE RATE LIMITING Y ANTI-FLOOD       ")
    print("  PARA PROPUESTAS DE ASAMBLEA (MUTUALFAM)              ")
    print("========================================================")

    # Base de datos SQLite temporal en memoria para pruebas
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    reset_limit_overrides()

    # 1. Crear usuarios y organización de prueba
    u1 = User(id=1, email="autor@test.com", hashed_password="pw", first_name="Juan", last_name="Perez")
    u2 = User(id=2, email="candidato@test.com", hashed_password="pw", first_name="Pedro", last_name="Gomez")
    org = Organization(id=1, name="Mutual Familiar Test")
    db.add_all([u1, u2, org])
    db.commit()

    mem1 = OrganizationMembership(user_id=u1.id, organization_id=org.id, role="founder", status=MemberStatus.ACTIVE)
    db.add(mem1)
    db.commit()

    # Helper de formateo de tiempo
    assert format_remaining_time(45) == "45 segundos"
    assert format_remaining_time(125) == "2 minutos y 5 segundos"
    assert format_remaining_time(3665) == "1 hora y 1 minuto"
    assert format_remaining_time(90000) == "1 día y 1 hora"
    print("✅ Test 0 PASÓ: format_remaining_time formatea correctamente.")

    # -----------------------------------------------------------------
    # Test 1: Primer intento sin historial previo -> Debe permitirse
    # -----------------------------------------------------------------
    throttle = check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
    assert throttle is not None
    assert throttle.user_id == u1.id
    print("✅ Test 1 PASÓ: El miembro puede crear su primera propuesta sin restricciones.")

    # Simulamos la creación de la propuesta
    prop1 = Proposal(
        organization_id=org.id,
        author_id=u1.id,
        title="Admisión de Pedro",
        content="Justificación",
        category="admision",
        proposal_type=ProposalType.MEMBER_ADMISSION,
        status=ProposalStatus.DEBATE,
        voting_mechanism=VotingMechanism.SIMPLE
    )
    db.add(prop1)
    db.commit()
    record_proposal_created(db, throttle)

    # Verificamos estado registrado
    assert throttle.total_proposals_created == 1
    assert throttle.blocked_until is not None
    print("✅ Test 2 PASÓ: record_proposal_created registra la fecha de bloqueo y conteo.")

    # -----------------------------------------------------------------
    # Test 3: Intento inmediato de crear una segunda propuesta -> HTTP 429
    # -----------------------------------------------------------------
    try:
        check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
        assert False, "Debería haber lanzado HTTPException 429 por período de enfriamiento activo"
    except HTTPException as e:
        assert e.status_code == 429
        detail_lower = e.detail.lower()
        assert "enfriamiento" in detail_lower or "límite" in detail_lower or "esperar" in detail_lower
        print(f"✅ Test 3 PASÓ: Rechazo 429 por enfriamiento activo: {e.detail}")

    # -----------------------------------------------------------------
    # Test 4: Detección de ataque / spam flood -> Penalización progresiva
    # Cada intento fallido mientras está bloqueado aumenta failed_attempts_count
    # y duplica el tiempo de bloqueo (backoff progresivo).
    # -----------------------------------------------------------------
    initial_blocked_until = throttle.blocked_until
    initial_level = throttle.penalty_level

    # Intento 2 fallido (acumula intento fallido)
    try:
        check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
    except HTTPException:
        pass

    db.refresh(throttle)
    assert throttle.failed_attempts_count >= 2
    # El bloqueo debe extenderse más allá del inicial por escalamiento progresivo
    assert throttle.blocked_until > initial_blocked_until
    assert throttle.penalty_level >= 1
    print(f"✅ Test 4 PASÓ: Penalización progresiva activada (nivel {throttle.penalty_level}, bloqueado hasta {throttle.blocked_until}).")

    # -----------------------------------------------------------------
    # Test 5: Endpoint /throttle-status refleja el bloqueo y tiempo restante
    # -----------------------------------------------------------------
    status_info = get_proposal_throttle_status(db, user_id=u1.id, org_id=org.id)
    assert status_info["can_propose"] is False
    assert status_info["remaining_seconds"] > 0
    assert status_info["penalty_level"] >= 1
    reason_lower = (status_info["reason"] or "").lower()
    assert "enfriamiento" in reason_lower or "límite" in reason_lower or "esperar" in reason_lower
    print(f"✅ Test 5 PASÓ: get_proposal_throttle_status reporta correctamente: {status_info}")

    # -----------------------------------------------------------------
    # Test 6: Bypass con bandera X-Bypass-Rate-Limit
    # -----------------------------------------------------------------
    throttle_bypass = check_can_create_proposal(db, user_id=u1.id, org_id=org.id, x_bypass_rate_limit="true")
    assert throttle_bypass is not None
    print("✅ Test 6 PASÓ: El bypass de rate-limit permite continuar cuando se autoriza.")

    # -----------------------------------------------------------------
    # Test 7: Bypass global en pruebas unitarias mediante override
    # -----------------------------------------------------------------
    set_limit_override("bypass_proposal_rate_limit", True)
    throttle_override = check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
    assert throttle_override is not None
    print("✅ Test 7 PASÓ: set_limit_override('bypass_proposal_rate_limit', True) funciona correctamente.")
    reset_limit_overrides()

    # -----------------------------------------------------------------
    # Test 8: Concurrencia de propuestas activas
    # Si simulamos que el tiempo de enfriamiento expiró, pero la propuesta anterior
    # sigue en DEBATE o VOTACIÓN, debe bloquear por límite de concurrencia.
    # -----------------------------------------------------------------
    throttle.blocked_until = datetime.now(timezone.utc) - timedelta(seconds=10)
    db.commit()

    try:
        check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
        assert False, "Debería haber bloqueado por tener una propuesta activa en asamblea"
    except HTTPException as e:
        assert e.status_code == 429
        detail_low = e.detail.lower()
        assert "propuesta" in detail_low and ("activa" in detail_low or "deliberación" in detail_low)
        print(f"✅ Test 8 PASÓ: Bloqueo de concurrencia por propuesta activa en asamblea: {e.detail}")

    # Si la propuesta anterior se cierra (ej. aprobada o rechazada)
    prop1.status = ProposalStatus.APPROVED
    db.commit()

    # Ahora sí debe permitir crear otra propuesta
    throttle_ok = check_can_create_proposal(db, user_id=u1.id, org_id=org.id)
    assert throttle_ok is not None
    print("✅ Test 9 PASÓ: Una vez cerrada la propuesta previa y superado el cooldown, se permite crear una nueva.")

    print("\n========================================================")
    print("  ¡TODOS LOS TESTS DE RATE LIMITING PASARON CON ÉXITO!  ")
    print("========================================================\n")

if __name__ == "__main__":
    run_tests()
