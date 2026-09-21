import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings

get_settings.cache_clear()

from httpx import ASGITransport, AsyncClient
from app.main import app


async def main() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"phone": "03001234567", "password": "company123"},
        )
        print("login", login.status_code)
        token = login.json()["data"]["session"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        emp = await client.post(
            "/api/v1/employees",
            headers=headers,
            json={
                "full_name": "Ali Khan",
                "father_name": "Ahmed",
                "cnic": "42101-1234567-1",
                "phone": "03009998877",
                "position": "Salary",
                "is_worker": True,
                "is_supervisor": True,
                "joining_date": "2026-01-15",
            },
        )
        print("employee", emp.status_code, emp.text[:300])


if __name__ == "__main__":
    asyncio.run(main())
