import sys
sys.path.insert(0, "/civiccore_backend")
sys.path.insert(0, "/app")

from fastapi.testclient import TestClient
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
    print("✅ Endpoint GET /api/v1/config/ incluye limits correctamente")

if __name__ == "__main__":
    test_api_config_limits()
