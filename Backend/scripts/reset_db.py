import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.db import Base, engine, init_db
import app.models  # noqa: F401


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            __import__("sqlalchemy").text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift_per_company
                ON shifts (company_id)
                WHERE status = 'open'
                """
            )
        )
    print("reset complete")


if __name__ == "__main__":
    asyncio.run(main())
