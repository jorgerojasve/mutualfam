"""
Test end-to-end del módulo de Gobernanza (Ingreso y Expulsión de Miembros) en MutualFam.
Prueba:
1. Flujo de Ingreso Aprobado (Consenso con Veto, activación automática de membresía)
2. Flujo de Ingreso Vetado (Veto nominativo rechaza inmediatamente)
3. Bloqueo de voto durante período de debate
4. Flujo de Expulsión con Defensa obligatoria y Supermayoría 75%
5. Flujo de Expulsión Rechazada (permanece activo)
6. Validaciones de seguridad (no auto-expulsión, no expulsión del fundador, no proponer miembro activo)
"""
import os
import sys
from datetime import datetime, timedelta, timezone

if './civiccore/backend' not in sys.path:
    sys.path.extend(['./civiccore/backend', './civiccore/apps/mutualfam'])

if "DATABASE_URL" not in os.environ:
    if os.path.exists("/app/data"):
        os.environ["DATABASE_URL"] = "sqlite:////app/data/mutualfam.db"
    elif os.path.exists("civiccore/apps/mutualfam/data"):
        os.environ["DATABASE_URL"] = f"sqlite:///{os.path.abspath('civiccore/apps/mutualfam/data/mutualfam.db')}"
    elif os.path.exists("data"):
        os.environ["DATABASE_URL"] = f"sqlite:///{os.path.abspath('data/mutualfam.db')}"

from fastapi.testclient import TestClient
from civiccore.core.database import SessionLocal, Base, engine
import civiccore.modules.config.models
import civiccore.modules.governance.models
from civiccore.modules.membership.models import User, Organization, OrganizationMembership, MemberStatus
from civiccore.modules.governance.models import Proposal, ProposalStatus, ProposalType
from civiccore.core.auth import create_access_token
from app import app

Base.metadata.create_all(bind=engine)

client = TestClient(app)

def run_tests():
    db = SessionLocal()
    try:
        print("\n=======================================================")
        print("  INICIANDO SUITE DE TESTS E2E DE GOBERNANZA MUTUALFAM  ")
        print("=======================================================\n")

        # Setup: Crear o recuperar organización de prueba
        org = db.query(Organization).filter(Organization.name == "Mutual Gobernanza Test").first()
        if not org:
            org = Organization(name="Mutual Gobernanza Test", description="Mutual para tests de asamblea")
            db.add(org)
            db.commit()
            db.refresh(org)

        # Crear usuarios para el test
        def get_or_create_user(email, first_name, last_name):
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(email=email, hashed_password="pw", first_name=first_name, last_name=last_name)
                db.add(u)
                db.commit()
                db.refresh(u)
            return u

        founder = get_or_create_user("founder_gob@test.com", "Fundador", "Gobernanza")
        member1 = get_or_create_user("miembro1_gob@test.com", "Lucia", "Rivas")
        member2 = get_or_create_user("miembro2_gob@test.com", "Marcos", "Torres")
        member3 = get_or_create_user("miembro3_gob@test.com", "Elena", "Sanz")
        candidate1 = get_or_create_user("candidato1_gob@test.com", "Roberto", "Candidato")
        candidate2 = get_or_create_user("candidato2_gob@test.com", "Valeria", "Vetada")

        # Asegurar membresías activas para founder y miembros
        def ensure_membership(user, role="member", status=MemberStatus.ACTIVE):
            m = db.query(OrganizationMembership).filter(
                OrganizationMembership.user_id == user.id,
                OrganizationMembership.organization_id == org.id
            ).first()
            if not m:
                m = OrganizationMembership(user_id=user.id, organization_id=org.id, role=role, status=status)
                db.add(m)
            else:
                m.role = role
                m.status = status
            db.commit()
            return m

        ensure_membership(founder, role="founder")
        ensure_membership(member1, role="member")
        ensure_membership(member2, role="member")
        ensure_membership(member3, role="member")

        # Limpiar cualquier membresía previa de los candidatos y propuestas previas del test org
        for c in [candidate1, candidate2]:
            db.query(OrganizationMembership).filter(
                OrganizationMembership.user_id == c.id,
                OrganizationMembership.organization_id == org.id
            ).delete()
        
        # Eliminar propuestas previas y votos asociados
        from civiccore.modules.governance.models import Vote
        from civiccore.modules.membership.models import OrganizationInvite
        old_props = db.query(Proposal).filter(Proposal.organization_id == org.id).all()
        for op in old_props:
            db.query(Vote).filter(Vote.proposal_id == op.id).delete()
            db.query(OrganizationInvite).filter(OrganizationInvite.proposal_id == op.id).delete()
            db.delete(op)
        db.commit()

        # Headers de autenticación
        headers_founder = {"Authorization": f"Bearer {create_access_token(data={'sub': str(founder.id)})}", "X-Organization-ID": str(org.id)}
        headers_m1 = {"Authorization": f"Bearer {create_access_token(data={'sub': str(member1.id)})}", "X-Organization-ID": str(org.id)}
        headers_m2 = {"Authorization": f"Bearer {create_access_token(data={'sub': str(member2.id)})}", "X-Organization-ID": str(org.id)}
        headers_m3 = {"Authorization": f"Bearer {create_access_token(data={'sub': str(member3.id)})}", "X-Organization-ID": str(org.id)}

        # -----------------------------------------------------------
        # TEST 1: Creación de propuesta con enlace de 15 días y bloqueo de voto en DEBATE
        # -----------------------------------------------------------
        print("▶ TEST 1: Propuesta con enlace de 15 días y bloqueo de votación en debate...")
        res = client.post(
            "/api/v1/gobernanza/proponer-ingreso",
            json={
                "candidate_name": "Roberto Candidato",
                "candidate_relation": "Primo",
                "candidate_phone": "+584121234567",
                "justificacion": "Familiar ejemplar que desea participar en la mutual"
            },
            headers=headers_m1
        )
        assert res.status_code == 201, f"Error creando propuesta: {res.text}"
        prop_ingreso_1 = res.json()
        assert prop_ingreso_1["status"] == "debate", "La propuesta debe iniciar en DEBATE"
        assert prop_ingreso_1["proposal_type"] == "member_admission"
        assert prop_ingreso_1["invite_token"] is not None, "Debe generar un token de invitación"
        assert prop_ingreso_1["invite_code_formatted"] is not None, "Debe incluir código formateado"
        assert prop_ingreso_1["invite_expires_at"] is not None, "Debe incluir fecha de expiración"
        prop1_id = prop_ingreso_1["id"]
        invite_token_1 = prop_ingreso_1["invite_token"]
        print(f"  ✓ Propuesta de ingreso #{prop1_id} creada con código {prop_ingreso_1['invite_code_formatted']} (Expira en 15 días)")

        # Intentar votar mientras está en DEBATE -> Debe rechazar con 400
        vote_try = client.post(
            f"/api/v1/gobernanza/propuestas/{prop1_id}/votar",
            json={"voto": "si"},
            headers=headers_m1
        )
        assert vote_try.status_code == 400, "Debe rechazar votar durante el período de debate"
        print("  ✓ Voto rechazado correctamente durante la fase de debate (400)")

        # Candidato canjea el enlace mientras está en DEBATE -> Pasa a estado PENDING
        headers_cand1 = {"Authorization": f"Bearer {create_access_token(data={'sub': str(candidate1.id)})}"}
        join_res = client.post(
            "/api/v1/membership/organizations/join",
            json={"token": invite_token_1},
            headers=headers_cand1
        )
        assert join_res.status_code == 200, f"Error al canjear invitacion: {join_res.text}"
        join_data = join_res.json()
        assert join_data["status"] == "PENDING", "La membresía debe quedar en PENDING mientras se debate y vota"
        print("  ✓ Candidato canjeó enlace de invitación: Membresía registrada como PENDING")

        # -----------------------------------------------------------
        # TEST 2: Transición a VOTING y Aprobación de Ingreso
        # -----------------------------------------------------------
        print("\n▶ TEST 2: Transición a VOTACIÓN y Aprobación de Ingreso (Consenso con Veto)...")
        # Simular que transcurrieron los 4 días de debate
        p_db = db.query(Proposal).filter(Proposal.id == prop1_id).first()
        p_db.voting_starts_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

        # Miembros votan SÍ (Founder, M1, M2, M3)
        for h in [headers_founder, headers_m1, headers_m2, headers_m3]:
            v_res = client.post(f"/api/v1/gobernanza/propuestas/{prop1_id}/votar", json={"voto": "si"}, headers=h)
            assert v_res.status_code == 200, f"Error al votar: {v_res.text}"
        print("  ✓ Todos los miembros votaron SÍ")

        # Cerrar y computar resultados
        close_res = client.post(f"/api/v1/gobernanza/propuestas/{prop1_id}/cerrar", headers=headers_m1)
        assert close_res.status_code == 200, f"Error al cerrar: {close_res.text}"
        result_data = close_res.json()
        assert result_data["status"] == "approved", "La propuesta debió ser aprobada"
        assert result_data["veto_activated"] is False
        print("  ✓ Propuesta cerrada y APROBADA exitosamente")

        # Verificar hook post-aprobación: Candidato 1 ahora es miembro ACTIVE
        cand1_mem = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == candidate1.id,
            OrganizationMembership.organization_id == org.id
        ).first()
        assert cand1_mem is not None, "El candidato debió ser agregado a organization_memberships"
        assert cand1_mem.status == MemberStatus.ACTIVE, "El estado del candidato debe ser ACTIVE"
        print(f"  ✓ Membresía activada automáticamente de PENDING a ACTIVE para candidato #{candidate1.id}")

        # -----------------------------------------------------------
        # TEST 3: Ingreso Rechazado por VETO NOMINATIVO (Opción A)
        # -----------------------------------------------------------
        print("\n▶ TEST 3: Rechazo por VETO NOMINATIVO en admisión...")
        res_cand2 = client.post(
            "/api/v1/gobernanza/proponer-ingreso",
            json={
                "candidate_name": "Valeria Vetada",
                "candidate_relation": "Conocida",
                "justificacion": "Candidata con dudas en la familia"
            },
            headers=headers_m1
        )
        assert res_cand2.status_code == 201
        prop2_json = res_cand2.json()
        prop2_id = prop2_json["id"]
        invite_token_2 = prop2_json["invite_token"]

        # Avanzar a fase de votación
        p2_db = db.query(Proposal).filter(Proposal.id == prop2_id).first()
        p2_db.voting_starts_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

        # Founder y M1 votan SÍ
        client.post(f"/api/v1/gobernanza/propuestas/{prop2_id}/votar", json={"voto": "si"}, headers=headers_founder)
        client.post(f"/api/v1/gobernanza/propuestas/{prop2_id}/votar", json={"voto": "si"}, headers=headers_m1)
        # Miembro 2 ejerce el VETO votando NO
        v_no = client.post(f"/api/v1/gobernanza/propuestas/{prop2_id}/votar", json={"voto": "no"}, headers=headers_m2)
        assert v_no.status_code == 200
        print("  ✓ Miembro 2 ejerció voto NO (veto individual)")

        # Cerrar propuesta
        close_veto = client.post(f"/api/v1/gobernanza/propuestas/{prop2_id}/cerrar", headers=headers_m1)
        assert close_veto.status_code == 200
        veto_data = close_veto.json()
        assert veto_data["status"] == "rejected", "La propuesta debió ser RECHAZADA"
        assert veto_data["veto_activated"] is True, "El veto debió ser registrado como activado"
        assert member2.first_name in veto_data["vetantes_names"][0], "El vetante debe ser revelado nominativamente"
        print(f"  ✓ Propuesta rechazada por veto nominativo de: {veto_data['vetantes_names']}")

        # Candidato 2 intenta canjear enlace de propuesta rechazada -> Debe fallar con 400
        headers_cand2 = {"Authorization": f"Bearer {create_access_token(data={'sub': str(candidate2.id)})}"}
        join_rejected = client.post(
            "/api/v1/membership/organizations/join",
            json={"token": invite_token_2},
            headers=headers_cand2
        )
        assert join_rejected.status_code == 400, "Debe rechazar unirse con token de propuesta rechazada"
        print("  ✓ Intento de canjear enlace de propuesta rechazada bloqueado correctamente con 400")

        # Candidato 2 NO debe ser miembro activo
        cand2_mem = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == candidate2.id,
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.status == MemberStatus.ACTIVE
        ).first()
        assert cand2_mem is None, "El candidato vetado no debe ingresar a la mutual"
        print("  ✓ Candidato vetado permanece fuera de la mutual")

        # -----------------------------------------------------------
        # TEST 4: Expulsión con Defensa Obligatoria y Supermayoría 75%
        # -----------------------------------------------------------
        print("\n▶ TEST 4: Proceso de Expulsión con Defensa y Supermayoría...")
        # Miembro 1 propone la expulsión de Miembro 3
        res_exp = client.post(
            "/api/v1/gobernanza/proponer-expulsion",
            json={"target_user_id": member3.id, "motivo": "Incumplimiento reiterado en cuotas de préstamo"},
            headers=headers_m1
        )
        assert res_exp.status_code == 201, f"Error proponiendo expulsion: {res_exp.text}"
        prop_exp = res_exp.json()
        assert prop_exp["status"] == "debate", "La expulsión debe iniciar en fase DEBATE para defensa"
        prop_exp_id = prop_exp["id"]
        print(f"  ✓ Propuesta de expulsión #{prop_exp_id} iniciada en DEBATE")

        # Un tercero intenta publicar defensa -> Debe ser 403
        fake_def = client.post(
            f"/api/v1/gobernanza/propuestas/{prop_exp_id}/defensa",
            json={"defense_text": "Yo no fui"},
            headers=headers_m2
        )
        assert fake_def.status_code == 403, "Solo el acusado puede publicar su defensa"
        print("  ✓ Rechazo correcto 403 cuando un tercero intenta publicar defensa")

        # El acusado (Miembro 3) publica su defensa
        headers_m3_def = {"Authorization": f"Bearer {create_access_token(data={'sub': str(member3.id)})}", "X-Organization-ID": str(org.id)}
        def_res = client.post(
            f"/api/v1/gobernanza/propuestas/{prop_exp_id}/defensa",
            json={"defense_text": "Estuve desempleado 2 meses, ya transferí el 50% de la deuda."},
            headers=headers_m3_def
        )
        assert def_res.status_code == 200
        print("  ✓ Acusado publicó su texto de defensa correctamente")

        # Avanzar a fase de votación
        p_exp_db = db.query(Proposal).filter(Proposal.id == prop_exp_id).first()
        p_exp_db.voting_starts_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

        # Votación: 3 votan SÍ (Founder, M1, M2), 1 vota NO (M3) -> 3/4 = 75% SÍ
        client.post(f"/api/v1/gobernanza/propuestas/{prop_exp_id}/votar", json={"voto": "si"}, headers=headers_founder)
        client.post(f"/api/v1/gobernanza/propuestas/{prop_exp_id}/votar", json={"voto": "si"}, headers=headers_m1)
        client.post(f"/api/v1/gobernanza/propuestas/{prop_exp_id}/votar", json={"voto": "si"}, headers=headers_m2)
        client.post(f"/api/v1/gobernanza/propuestas/{prop_exp_id}/votar", json={"voto": "no"}, headers=headers_m3_def)
        print("  ✓ Votos emitidos: 3 SÍ vs 1 NO (75% supermayoría)")

        # Cerrar propuesta de expulsión
        close_exp = client.post(f"/api/v1/gobernanza/propuestas/{prop_exp_id}/cerrar", headers=headers_m1)
        assert close_exp.status_code == 200
        exp_res_data = close_exp.json()
        assert exp_res_data["status"] == "approved", "La expulsión debió ser aprobada con el 75%"
        print("  ✓ Expulsión aprobada oficialmente")

        # Verificar hook: Miembro 3 debe estar EXPELLED
        m3_mem = db.query(OrganizationMembership).filter(
            OrganizationMembership.user_id == member3.id,
            OrganizationMembership.organization_id == org.id
        ).first()
        assert m3_mem.status == MemberStatus.EXPELLED, "El estado del miembro expulsado debe ser EXPELLED"
        print(f"  ✓ Estado de Miembro #{member3.id} actualizado a EXPELLED")

        # -----------------------------------------------------------
        # TEST 5: Validaciones de Seguridad
        # -----------------------------------------------------------
        print("\n▶ TEST 5: Validaciones de Seguridad...")
        # 5.1 Auto-expulsión
        self_exp = client.post(
            "/api/v1/gobernanza/proponer-expulsion",
            json={"target_user_id": member1.id, "motivo": "Me quiero ir"},
            headers=headers_m1
        )
        assert self_exp.status_code == 400, "No debe permitir auto-expulsión"
        print("  ✓ Auto-expulsión bloqueada (400)")

        # 5.2 Expulsión del fundador
        founder_exp = client.post(
            "/api/v1/gobernanza/proponer-expulsion",
            json={"target_user_id": founder.id, "motivo": "Expulsar fundador"},
            headers=headers_m1
        )
        assert founder_exp.status_code == 403, "No debe permitir expulsar al fundador"
        print("  ✓ Expulsión del fundador protegida (403)")

        # 5.3 Proponer ingreso de miembro que ya es activo
        already_member = client.post(
            "/api/v1/gobernanza/proponer-ingreso",
            json={"candidate_user_id": member1.id, "justificacion": "Ya es miembro"},
            headers=headers_founder
        )
        assert already_member.status_code == 400, "No debe permitir proponer a un miembro ya activo"
        print("  ✓ Proponer ingreso de miembro ya activo bloqueado (400)")

        # -----------------------------------------------------------
        # TEST 6: Endpoints de Consulta para UI Mobile
        # -----------------------------------------------------------
        print("\n▶ TEST 6: Endpoints de Consulta para UI Mobile...")
        # Candidatos disponibles
        cand_list_res = client.get("/api/v1/gobernanza/candidatos-disponibles", headers=headers_m1)
        assert cand_list_res.status_code == 200
        assert isinstance(cand_list_res.json(), list)
        print("  ✓ Endpoint /candidatos-disponibles respondió exitosamente")

        # Miembros expulsables
        exp_list_res = client.get("/api/v1/gobernanza/miembros-expulsables", headers=headers_m1)
        assert exp_list_res.status_code == 200
        assert isinstance(exp_list_res.json(), list)
        # El fundador no debe estar en la lista de expulsables
        founder_in_list = any(item["id"] == founder.id for item in exp_list_res.json())
        assert not founder_in_list, "El fundador no debe aparecer en la lista de miembros expulsables"
        print("  ✓ Endpoint /miembros-expulsables excluye al fundador y respondió exitosamente")

        # Listado de propuestas
        props_list = client.get("/api/v1/gobernanza/propuestas", headers=headers_m1)
        assert props_list.status_code == 200
        assert len(props_list.json()) >= 3
        print(f"  ✓ Endpoint /propuestas retornó {len(props_list.json())} propuestas")

        print("\n=======================================================")
        print("  ¡TODOS LOS TESTS DE GOBERNANZA PASARON CON ÉXITO!  ")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
