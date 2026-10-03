import asyncio
from httpx import AsyncClient
from civiccore.backend.civiccore.factory import create_app
app = create_app()

async def run_test():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # First register a user
        await ac.post("/api/v1/membership/register", json={"email": "test@test.com", "password": "pass", "full_name": "Test"})
        # Then login
        resp = await ac.post("/api/v1/auth/login", data={"username": "test@test.com", "password": "pass"})
        print(resp.json())

asyncio.run(run_test())
