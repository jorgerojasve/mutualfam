import sys
sys.path.insert(0, "/civiccore_backend")
sys.path.insert(0, "/app")

from fastapi.testclient import TestClient
import os
os.environ["CIVICCORE_ENV"] = "sandbox"
from app import app
from services.limits import set_limit_override, reset_limit_overrides

client = TestClient(app)

def test_api_config_limits():
    reset_limit_overrides()
    resp = client.get("/api/v1/config/limits")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "max_members_per_mutual" in data
    assert "extra_mutuals_first_mutual" in data
    assert "contact_email" in data
    print("✅ Endpoint GET /api/v1/config/limits funciona correctamente:", data)

    # Probar endpoint GET /api/v1/config/
    resp_config = client.get("/api/v1/config/")
    assert resp_config.status_code == 200
    config_data = resp_config.json()
    assert "limits" in config_data
    assert config_data["limits"]["max_members_per_mutual"] == data["max_members_per_mutual"]
    assert "app_phase" in config_data
    assert config_data["app_phase"]["is_beta"] is True
    print("✅ Endpoint GET /api/v1/config/ incluye limits y app_phase correctamente")

    # Probar endpoint GET /api/v1/config/phase
    resp_phase = client.get("/api/v1/config/phase")
    assert resp_phase.status_code == 200
    phase_data = resp_phase.json()
    assert phase_data["is_beta"] is True
    assert phase_data["phase_label"] == "Beta"
    print("✅ Endpoint GET /api/v1/config/phase retorna fase Beta:", phase_data)

    # Probar conmutación en caliente POST /api/v1/config/phase (Desactivación de Beta a Estable)
    resp_update = client.post("/api/v1/config/phase", json={"is_beta": False})
    assert resp_update.status_code == 200
    assert resp_update.json()["app_phase"]["is_beta"] is False
    assert resp_update.json()["app_phase"]["phase_label"] == "Estable"

    # Verificar que GET /config/ refleja el cambio a Estable
    resp_config_stable = client.get("/api/v1/config/")
    assert resp_config_stable.json()["app_phase"]["is_beta"] is False
    print("✅ Conmutación a Estable en caliente exitosa (is_beta=False)")

    # Restaurar
    reset_limit_overrides()
    assert client.get("/api/v1/config/phase").json()["is_beta"] is True
    print("✅ Reinicio a valores por defecto exitoso")

if __name__ == "__main__":
    test_api_config_limits()

