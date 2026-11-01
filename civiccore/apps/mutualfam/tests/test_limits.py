import os
import sys

# Ensure backend and mutualfam app are in path
sys.path.insert(0, "/civiccore_backend")
sys.path.insert(0, "/app")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from civiccore.core.database import Base
from civiccore.modules.membership.models import User, Organization, OrganizationMembership, OrganizationInvite, MemberStatus, InviteStatus
from services.limits import (
    check_can_create_organization,
    check_can_join_organization,
    check_can_create_invite,
    get_limits_summary,
    set_limit_override,
    reset_limit_overrides,
    get_max_members_per_mutual,
    get_max_extra_mutuals_first_mutual,
    get_contact_email
)

def run_tests():
    print("==================================================")
    print("  EJECUTANDO TESTS DE REGLAS DE LÍMITES (MUTUALFAM) ")
    print("==================================================")

    # Base de datos SQLite temporal en memoria para pruebas
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    reset_limit_overrides()

    # 1. Crear usuarios de prueba
    u1 = User(email="u1@test.com", hashed_password="pw", first_name="User", last_name="1")
    u2 = User(email="u2@test.com", hashed_password="pw", first_name="User", last_name="2")
    u3 = User(email="u3@test.com", hashed_password="pw", first_name="User", last_name="3")
    u4 = User(email="u4@test.com", hashed_password="pw", first_name="User", last_name="4")
    u5 = User(email="u5@test.com", hashed_password="pw", first_name="User", last_name="5")
    db.add_all([u1, u2, u3, u4, u5])
    db.commit()

    # -----------------------------------------------------------------
    # Test 1: Bootstrap inicial - cuando la base de datos no tiene mutuales
    # -----------------------------------------------------------------
    try:
        check_can_create_organization(db, u1)
        print("✅ Test 1 PASÓ: u1 puede crear la primera mutual (bootstrap)")
    except HTTPException as e:
        assert False, f"Test 1 falló inesperadamente: {e.detail}"

    # Crear la primera mutual (Org 1)
    org1 = Organization(name="Mutual 1", founder_user_id=u1.id)
    db.add(org1)
    db.commit()
    mem1 = OrganizationMembership(user_id=u1.id, organization_id=org1.id, role="founder", status=MemberStatus.ACTIVE)
    db.add(mem1)
    db.commit()

    # -----------------------------------------------------------------
    # Test 2: Usuario que NO es miembro de la primera mutual intenta crear mutual
    # -----------------------------------------------------------------
    try:
        check_can_create_organization(db, u2)
        assert False, "Test 2 falló: u2 no debería poder crear una mutual sin ser miembro de la primera mutual"
    except HTTPException as e:
        assert e.status_code == 403, f"Esperaba 403 pero obtuve {e.status_code}"
        assert e.detail.get("code") == "LIMIT_MUTUALS", f"Esperaba LIMIT_MUTUALS pero obtuve {e.detail}"
        print("✅ Test 2 PASÓ: u2 (no miembro de la primera mutual) fue bloqueado con 403 LIMIT_MUTUALS")

    # -----------------------------------------------------------------
    # Test 3: Miembro de la primera mutual (u1) crea 1 mutual adicional (permitido)
    # -----------------------------------------------------------------
    try:
        check_can_create_organization(db, u1)
        print("✅ Test 3 PASÓ: u1 (miembro de primera mutual) puede crear su 1ra mutual adicional")
    except HTTPException as e:
        assert False, f"Test 3 falló: {e.detail}"

    # Crear la mutual adicional de u1 (Org 2)
    org2 = Organization(name="Mutual 2 de u1", founder_user_id=u1.id)
    db.add(org2)
    db.commit()
    mem2 = OrganizationMembership(user_id=u1.id, organization_id=org2.id, role="founder", status=MemberStatus.ACTIVE)
    db.add(mem2)
    db.commit()

    # -----------------------------------------------------------------
    # Test 4: u1 intenta crear una 2da mutual adicional (supera el límite de 1 adicional)
    # -----------------------------------------------------------------
    try:
        check_can_create_organization(db, u1)
        assert False, "Test 4 falló: u1 no debería poder crear una 2da mutual adicional"
    except HTTPException as e:
        assert e.status_code == 403, f"Esperaba 403 pero obtuve {e.status_code}"
        assert e.detail.get("code") == "LIMIT_MUTUALS"
        print("✅ Test 4 PASÓ: u1 bloqueado al intentar crear más de 1 mutual adicional con 403 LIMIT_MUTUALS")

    # -----------------------------------------------------------------
    # Test 5: Otro miembro de la primera mutual (u3) crea su mutual adicional
    # -----------------------------------------------------------------
    # u3 se une a Org 1
    mem3_org1 = OrganizationMembership(user_id=u3.id, organization_id=org1.id, role="member", status=MemberStatus.ACTIVE)
    db.add(mem3_org1)
    db.commit()

    try:
        check_can_create_organization(db, u3)
        print("✅ Test 5a PASÓ: u3 (miembro de la primera mutual) puede crear su mutual adicional")
    except HTTPException as e:
        assert False, f"Test 5a falló: {e.detail}"

    # u3 crea su mutual adicional (Org 3)
    org3 = Organization(name="Mutual 3 de u3", founder_user_id=u3.id)
    db.add(org3)
    db.commit()
    mem3_org3 = OrganizationMembership(user_id=u3.id, organization_id=org3.id, role="founder", status=MemberStatus.ACTIVE)
    db.add(mem3_org3)
    db.commit()

    # u3 intenta crear una segunda mutual adicional -> debe fallar
    try:
        check_can_create_organization(db, u3)
        assert False, "Test 5b falló: u3 no debería poder crear una segunda mutual adicional"
    except HTTPException as e:
        assert e.status_code == 403
        assert e.detail.get("code") == "LIMIT_MUTUALS"
        print("✅ Test 5b PASÓ: u3 bloqueado al intentar crear más de 1 mutual adicional")

    # -----------------------------------------------------------------
    # Test 6: Límite de miembros por mutual (Regla 2: 15 miembros por mutual)
    # -----------------------------------------------------------------
    # Ajustamos temporalmente el límite a 3 miembros para pruebas rápidas
    set_limit_override("max_members_per_mutual", 3)
    assert get_max_members_per_mutual() == 3

    # En org1 tenemos actualmente 2 miembros activos (u1 y u3)
    # Validamos que se pueda invitar y unir a un 3er miembro
    try:
        check_can_create_invite(db, org1.id)
        check_can_join_organization(db, org1.id)
        print("✅ Test 6a PASÓ: org1 con 2 miembros permite invitar y unirse al 3ero")
    except HTTPException as e:
        assert False, f"Test 6a falló: {e.detail}"

    # Añadir 3er miembro (u4)
    mem4_org1 = OrganizationMembership(user_id=u4.id, organization_id=org1.id, role="member", status=MemberStatus.ACTIVE)
    db.add(mem4_org1)
    db.commit()

    # Ahora org1 tiene 3 miembros (capacidad máxima alcanzada)
    # Intento de invitar a más miembros -> debe fallar con 409 LIMIT_MEMBERS
    try:
        check_can_create_invite(db, org1.id)
        assert False, "Test 6b falló: no debería permitir crear invitaciones cuando la mutual está llena"
    except HTTPException as e:
        assert e.status_code == 409
        assert e.detail.get("code") == "LIMIT_MEMBERS"
        print("✅ Test 6b PASÓ: check_can_create_invite bloqueado con 409 LIMIT_MEMBERS al alcanzar capacidad")

    # Intento de unirse a org1 llena -> debe fallar con 409 LIMIT_MEMBERS
    try:
        check_can_join_organization(db, org1.id)
        assert False, "Test 6c falló: no debería permitir unirse a una mutual que alcanzó la capacidad máxima"
    except HTTPException as e:
        assert e.status_code == 409
        assert e.detail.get("code") == "LIMIT_MEMBERS"
        print("✅ Test 6c PASÓ: check_can_join_organization bloqueado con 409 LIMIT_MEMBERS al alcanzar capacidad")

    # -----------------------------------------------------------------
    # Test 7: Restaurar valores y verificar resumen de configuración
    # -----------------------------------------------------------------
    reset_limit_overrides()
    summary = get_limits_summary()
    assert summary["max_members_per_mutual"] == 15 or summary["max_members_per_mutual"] == int(os.getenv("LIMIT_MAX_MEMBERS_PER_MUTUAL", "15"))
    assert summary["extra_mutuals_first_mutual"] == 1
    assert "mutualfam@gmail.com" in summary["contact_email"]
    print("✅ Test 7 PASÓ: get_limits_summary() retorna valores esperados:", summary)

    print("\n==================================================")
    print("   🎉 TODOS LOS TESTS DE LÍMITES PASARON (100%)   ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
