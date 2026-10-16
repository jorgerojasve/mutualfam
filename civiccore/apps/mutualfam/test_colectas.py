"""
Test end-to-end del ciclo de vida de Colectas ("Vacas")
"""
import os
import sys
from datetime import date, timedelta

# Asegurar path y DB
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
import models
from civiccore.modules.membership.models import User, Organization, OrganizationMembership
from app import app

client = TestClient(app)

def run_tests():
    db = SessionLocal()
    try:
        # 1. Obtener o crear usuarios y organización de prueba
        user1 = db.query(User).filter(User.email == "test_proponente@mutual.org").first()
        if not user1:
            user1 = User(email="test_proponente@mutual.org", hashed_password="pw", first_name="Ana", last_name="Pérez")
            db.add(user1)
            db.commit()
            db.refresh(user1)

        user2 = db.query(User).filter(User.email == "test_socio@mutual.org").first()
        if not user2:
            user2 = User(email="test_socio@mutual.org", hashed_password="pw", first_name="Carlos", last_name="Gómez")
            db.add(user2)
            db.commit()
            db.refresh(user2)

        org = db.query(Organization).first()
        if not org:
            org = Organization(name="Familia Pérez", description="Mutual familiar de prueba")
            db.add(org)
            db.commit()
            db.refresh(org)

        # Membresías
        for u in [user1, user2]:
            m = db.query(OrganizationMembership).filter(
                OrganizationMembership.user_id == u.id,
                OrganizationMembership.organization_id == org.id
            ).first()
            if not m:
                m = OrganizationMembership(user_id=u.id, organization_id=org.id, role="member", status="active")
                db.add(m)
        db.commit()

        # Generar tokens de auth para los dos usuarios
        from civiccore.core.auth import create_access_token
        token_ana = create_access_token(data={"sub": str(user1.id)})
        token_carlos = create_access_token(data={"sub": str(user2.id)})

        headers_ana = {
            "Authorization": f"Bearer {token_ana}",
            "X-Organization-Id": str(org.id)
        }
        headers_carlos = {
            "Authorization": f"Bearer {token_carlos}",
            "X-Organization-Id": str(org.id)
        }

        print("--- TEST 1: Consulta de tasas disponibles ---")
        res = client.get("/api/v1/colectas/tasas", headers=headers_ana)
        assert res.status_code == 200, f"Error tasas: {res.text}"
        tasas = res.json()
        assert "bcv" in tasas
        assert "usdt" in tasas
        print(f"✅ Tasas OK: BCV={tasas['bcv']['rate']}, USDT={tasas['usdt']['rate']}")

        print("\n--- TEST 2: Creación de colecta (Ana) ---")
        colecta_payload = {
            "titulo": "Compra de Tensiómetro Familiar",
            "proposito": "Comprar tensiómetro digital para monitoreo de la abuela.",
            "monto_meta_usd": 50.0,
            "tipo_tasa": "bcv",
            "fecha_pago": str(date.today() + timedelta(days=5)),
            "beneficiario_nombre": "Ana Pérez"
        }
        res = client.post("/api/v1/colectas/", json=colecta_payload, headers=headers_ana)
        assert res.status_code == 200, f"Error crear colecta: {res.text}"
        colecta = res.json()
        colecta_id = colecta["id"]
        assert colecta["estado"] == "propuesta"
        assert colecta["monto_prometido_usd"] == 0.0
        assert colecta["is_active"] is False
        print(f"✅ Colecta #{colecta_id} creada en estado PROPUESTA.")

        print("\n--- TEST 3: Carlos promete $20 (por debajo de la meta) ---")
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos", json={"monto_usd": 20.0}, headers=headers_carlos)
        assert res.status_code == 200, f"Error compromiso: {res.text}"
        colecta = res.json()
        assert colecta["monto_prometido_usd"] == 20.0
        assert colecta["estado"] == "propuesta"
        assert colecta["is_active"] is False
        carlos_comp_id = colecta["mi_compromiso"]["id"]
        print(f"✅ Compromiso de $20 registrado. Total prometido: ${colecta['monto_prometido_usd']}. Sigue en PROPUESTA.")

        print("\n--- TEST 4: Ana promete $30 (Alcanza el 100% de la meta) ---")
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos", json={"monto_usd": 30.0}, headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_prometido_usd"] == 50.0
        assert colecta["estado"] == "activa"
        assert colecta["is_active"] is True
        ana_comp_id = colecta["mi_compromiso"]["id"]
        print(f"✅ Quorum del 100% alcanzado (${colecta['monto_prometido_usd']}/$50). Colecta pasó a ACTIVA.")

        print("\n--- TEST 5: Carlos cancela su compromiso -> Reversión automática a PROPUESTA ---")
        res = client.delete(f"/api/v1/colectas/{colecta_id}/compromisos/{carlos_comp_id}", headers=headers_carlos)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_prometido_usd"] == 30.0
        assert colecta["estado"] == "propuesta"
        assert colecta["is_active"] is False
        print(f"✅ Al cancelar Carlos ($20), total prometido cayó a ${colecta['monto_prometido_usd']}. Revertió a PROPUESTA exitosamente.")

        print("\n--- TEST 6: Carlos vuelve a prometer $20 -> Vuelve a ACTIVA ---")
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos", json={"monto_usd": 20.0}, headers=headers_carlos)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_prometido_usd"] == 50.0
        assert colecta["estado"] == "activa"
        carlos_comp_id = colecta["mi_compromiso"]["id"]
        print(f"✅ Colecta volvió a estado ACTIVA.")

        print("\n--- TEST 7: Notificación de cobro (cálculo en Bs) ---")
        res = client.post(f"/api/v1/colectas/{colecta_id}/notificar-cobro", headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        for comp in colecta["compromisos"]:
            if comp["estado"] != "cancelado":
                assert comp["estado"] == "notificado"
                assert comp["monto_bs"] > 0
                assert comp["tasa_usada"] > 0
        print(f"✅ Compromisos notificados con montos calculados en Bs.")

        print("\n--- TEST 8: Carlos confirma su pago ---")
        pago_payload = {
            "payment_method": "pago_movil",
            "referencia_pago": "REF-987654",
            "nota_pago": "Pago móvil enviado desde Banesco"
        }
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos/{carlos_comp_id}/confirmar-pago", json=pago_payload, headers=headers_carlos)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_recaudado_usd"] == 20.0
        print(f"✅ Pago de Carlos confirmado. Total recaudado: ${colecta['monto_recaudado_usd']}.")

        print("\n--- TEST 9: Ana confirma su pago -> Colecta pasa a CERRADA (en espera de gasto) ---")
        pago_ana = {
            "payment_method": "efectivo",
            "referencia_pago": "EFECTIVO-ANA",
            "nota_pago": "Aporte propio en efectivo"
        }
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos/{ana_comp_id}/confirmar-pago", json=pago_ana, headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_recaudado_usd"] == 50.0
        assert colecta["estado"] == "cerrada"
        print(f"✅ Todos los pagos confirmados ($50/$50). Colecta pasó a CERRADA.")

        print("\n--- TEST 10: Beneficiaria valida el gasto (comprobante opcional) ---")
        gasto_payload = {
            "descripcion_gasto": "Se compró el tensiómetro digital Omron en Farmatodo de Los Palos Grandes.",
            "comprobante_gasto_url": "https://mutualfam.local/uploads/factura_omron.jpg"
        }
        res = client.post(f"/api/v1/colectas/{colecta_id}/validar-gasto", json=gasto_payload, headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["gasto_validado"] is True
        assert colecta["estado"] == "completada"
        print(f"✅ Gasto validado. Colecta finalizada con éxito en estado COMPLETADA.")

        print("\n🎉 ¡TODOS LOS TESTS DEL CICLO DE VIDA DE COLECTAS PASARON EXITOSAMENTE!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
