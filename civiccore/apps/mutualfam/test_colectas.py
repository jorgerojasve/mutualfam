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

        print("\n--- TEST 8: Carlos confirma su pago (Pasa a En Validación) ---")
        pago_payload = {
            "payment_method": "pago_movil",
            "referencia_pago": "REF-987654",
            "nota_pago": "Pago móvil enviado desde Banesco"
        }
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos/{carlos_comp_id}/confirmar-pago", json=pago_payload, headers=headers_carlos)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_pagado_usd"] == 20.0
        assert colecta["monto_validado_usd"] == 0.0
        print(f"✅ Pago de Carlos notificado exitosamente (En validación: ${colecta['monto_pagado_usd']}).")

        print("\n--- TEST 8.1: Ana (Gestora) valida el pago de Carlos ---")
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos/{carlos_comp_id}/validar-pago", headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_validado_usd"] == 20.0
        assert colecta["monto_pagado_usd"] == 0.0
        print(f"✅ Pago de Carlos validado por la gestora (Total validado: ${colecta['monto_validado_usd']}).")

        print("\n--- TEST 9: Ana confirma su propio pago -> Colecta pasa a CERRADA (en espera de gasto) ---")
        pago_ana = {
            "payment_method": "efectivo",
            "referencia_pago": "EFECTIVO-ANA",
            "nota_pago": "Aporte propio en efectivo"
        }
        res = client.post(f"/api/v1/colectas/{colecta_id}/compromisos/{ana_comp_id}/confirmar-pago", json=pago_ana, headers=headers_ana)
        assert res.status_code == 200
        colecta = res.json()
        assert colecta["monto_validado_usd"] == 50.0
        assert colecta["monto_recaudado_usd"] == 50.0
        assert colecta["estado"] == "cerrada"
        print(f"✅ Todos los pagos validados ($50/$50). Colecta pasó a CERRADA.")

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

        print("\n--- TEST 11: Múltiples aportes de un mismo socio ('Aportar más') ---")
        colecta_2_payload = {
            "titulo": "Medicamentos de Emergencia Abuela",
            "proposito": "Adquisición de tratamiento de soporte",
            "monto_meta_usd": 80.0,
            "tipo_tasa": "bcv",
            "fecha_pago": str(date.today() + timedelta(days=5)),
            "beneficiario_nombre": "Ana Pérez"
        }
        res = client.post("/api/v1/colectas/", json=colecta_2_payload, headers=headers_ana)
        assert res.status_code == 200
        c2 = res.json()
        c2_id = c2["id"]

        # Carlos hace su primer aporte de $20
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos", json={"monto_usd": 20.0}, headers=headers_carlos)
        assert res.status_code == 200
        c2 = res.json()
        comp_carlos_1_id = c2["mi_compromiso"]["id"]
        carlos_monto_bs_1 = c2["mi_compromiso"]["monto_bs"]

        # Carlos paga su primer aporte vía Pago Móvil
        pago_pm = {
            "payment_method": "Pago Móvil",
            "referencia_pago": "PM-112233",
            "nota_pago": "Pago móvil transferido"
        }
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_1_id}/confirmar-pago", json=pago_pm, headers=headers_carlos)
        assert res.status_code == 200

        # Ana valida el primer aporte
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_1_id}/validar-pago", headers=headers_ana)
        assert res.status_code == 200

        # Carlos decide aportar más ("Aportar más") con un segundo compromiso de $15 en Efectivo
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos", json={"monto_usd": 15.0}, headers=headers_carlos)
        assert res.status_code == 200
        c2 = res.json()
        comp_carlos_2_id = c2["mi_compromiso"]["id"]
        assert comp_carlos_2_id != comp_carlos_1_id
        assert len(c2["mis_compromisos"]) == 2
        print(f"✅ Carlos pudo aportar más: 2 compromisos registrados (${c2['mis_compromisos'][0]['monto_usd']} y ${c2['mis_compromisos'][1]['monto_usd']}).")

        # Carlos paga su segundo aporte en Efectivo
        pago_ef = {
            "payment_method": "Efectivo",
            "referencia_pago": "EF-DIRECTO",
            "nota_pago": "Entregado en efectivo $15"
        }
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_2_id}/confirmar-pago", json=pago_ef, headers=headers_carlos)
        assert res.status_code == 200

        # Ana valida el segundo aporte
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_2_id}/validar-pago", headers=headers_ana)
        assert res.status_code == 200
        c2 = res.json()
        assert c2["monto_validado_usd"] == 35.0
        print(f"✅ Ambos aportes validados exitosamente en la colecta (Total: ${c2['monto_validado_usd']}).")

        print("\n--- TEST 12: Cancelación por fuerza mayor y devolución según método original ---")
        # Cancelar colecta por fuerza mayor
        cancel_payload = {
            "motivo": "Fuerza mayor: medicamento agotado a nivel nacional en droguerías"
        }
        res = client.patch(f"/api/v1/colectas/{c2_id}/cancelar", json=cancel_payload, headers=headers_ana)
        assert res.status_code == 200
        c2 = res.json()
        assert c2["estado"] == "cancelada"
        assert c2["motivo_cancelacion"] == cancel_payload["motivo"]
        assert c2["tiene_devoluciones_pendientes"] is True
        print(f"✅ Colecta cancelada por fuerza mayor. Pendiente por devolver aportes.")

        # Devolución 1: Aporte Pago Móvil devuelto en Bolívares descontando comisión bancaria
        comision_bs = round(carlos_monto_bs_1 * 0.003, 2)
        monto_neto_bs = round(carlos_monto_bs_1 - comision_bs, 2)
        devolucion_pm = {
            "monto_devuelto": monto_neto_bs,
            "moneda_devolucion": "VES",
            "metodo_devolucion": "Pago Móvil",
            "referencia_devolucion": "DEV-PM-778899",
            "comision_descontada": comision_bs
        }
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_1_id}/devolver", json=devolucion_pm, headers=headers_ana)
        assert res.status_code == 200
        c2 = res.json()
        c_dev_1 = next(c for c in c2["compromisos"] if c["id"] == comp_carlos_1_id)
        assert c_dev_1["estado"] == "devuelto"
        assert c_dev_1["moneda_devolucion"] == "VES"
        assert c_dev_1["monto_devuelto"] == monto_neto_bs
        assert c_dev_1["comision_descontada"] == comision_bs
        print(f"✅ Aporte #1 devuelto a Carlos en Bs ({monto_neto_bs} Bs, comisión descontada: {comision_bs} Bs).")

        # Devolución 2: Aporte en Efectivo devuelto en el mismo Efectivo ($15 USD)
        devolucion_ef = {
            "monto_devuelto": 15.0,
            "moneda_devolucion": "USD",
            "metodo_devolucion": "Efectivo",
            "referencia_devolucion": "Entrega en mano billete de $15",
            "comision_descontada": 0.0
        }
        res = client.post(f"/api/v1/colectas/{c2_id}/compromisos/{comp_carlos_2_id}/devolver", json=devolucion_ef, headers=headers_ana)
        assert res.status_code == 200
        c2 = res.json()
        c_dev_2 = next(c for c in c2["compromisos"] if c["id"] == comp_carlos_2_id)
        assert c_dev_2["estado"] == "devuelto"
        assert c_dev_2["moneda_devolucion"] == "USD"
        assert c_dev_2["monto_devuelto"] == 15.0
        assert c2["tiene_devoluciones_pendientes"] is False
        print(f"✅ Aporte #2 devuelto a Carlos en el mismo efectivo ($15 USD). Todas las devoluciones completadas.")

        print("\n--- TEST 13: Hora de pago, rechazo de pago y recordatorios automáticos ---")
        # 1. Crear colecta con hora_pago personalizada (08:30)
        colecta_hora = {
            "titulo": "Colecta Médica Matutina",
            "proposito": "Compra de insumos a primera hora",
            "monto_meta_usd": 40.0,
            "currency": "USD",
            "tipo_tasa": "bcv",
            "fecha_pago": str(date.today()),
            "hora_pago": "08:30"
        }
        res = client.post("/api/v1/colectas/", json=colecta_hora, headers=headers_ana)
        assert res.status_code == 200
        c3 = res.json()
        c3_id = c3["id"]
        assert c3["hora_pago"] == "08:30"
        print("✅ Colecta creada exitosamente con hora_pago=08:30.")

        # 2. Carlos promete $40
        res = client.post(f"/api/v1/colectas/{c3_id}/compromisos", json={"monto_usd": 40.0, "currency": "USD"}, headers=headers_carlos)
        assert res.status_code == 200
        c3 = res.json()
        comp_carlos_id = c3["compromisos"][0]["id"]
        assert c3["compromisos"][0]["estado"] in ["prometido", "activa"]

        # 3. Carlos notifica pago
        pago_carlos = {
            "payment_method": "Pago Móvil",
            "referencia_pago": "PM-998877",
            "nota_pago": "Transferido temprano"
        }
        res = client.post(f"/api/v1/colectas/{c3_id}/compromisos/{comp_carlos_id}/confirmar-pago", json=pago_carlos, headers=headers_carlos)
        assert res.status_code == 200
        c3 = res.json()
        comp_pagado = next(c for c in c3["compromisos"] if c["id"] == comp_carlos_id)
        assert comp_pagado["estado"] == "pagado"
        print("✅ Carlos notificó pago (estado='pagado').")

        # 4. Ana (gestora) rechaza el pago con motivo
        rechazo = {
            "motivo": "No se visualiza el dinero en la cuenta de Banco Mercantil"
        }
        res = client.post(f"/api/v1/colectas/{c3_id}/compromisos/{comp_carlos_id}/rechazar-pago", json=rechazo, headers=headers_ana)
        assert res.status_code == 200
        c3 = res.json()
        comp_rechazado = next(c for c in c3["compromisos"] if c["id"] == comp_carlos_id)
        assert comp_rechazado["estado"] == "prometido"
        assert comp_rechazado["motivo_rechazo"] == "No se visualiza el dinero en la cuenta de Banco Mercantil"
        assert comp_rechazado["comprobante_url"] is None
        assert comp_rechazado["referencia_pago"] is None
        print(f"✅ Pago rechazado por la gestora. Aporte regresó a estado prometido con motivo guardado.")

        # 5. Probar servicio de recordatorios automáticos
        from services.colectas_reminders import check_and_send_colectas_reminders
        reminders_result = check_and_send_colectas_reminders(db, force=True)
        assert "sent_day_before" in reminders_result or "sent_same_day" in reminders_result
        print(f"✅ Servicio de recordatorios automáticos ejecutado exitosamente ({reminders_result}).")

        # 6. Probar endpoint de recordatorio manual
        res = client.post(f"/api/v1/colectas/{c3_id}/recordar-pendientes", headers=headers_ana)
        assert res.status_code == 200
        print("✅ Endpoint /recordar-pendientes ejecutado exitosamente por la gestora.")

        print("\n🎉 ¡TODOS LOS TESTS DEL CICLO DE VIDA DE COLECTAS (INCLUYENDO APORTAR MÁS, DEVOLUCIONES Y RECORDATORIOS/RECHAZOS) PASARON EXITOSAMENTE!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
