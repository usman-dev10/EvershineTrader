import asyncio
import sys

sys.path.insert(0, ".")

from app.core.db import init_db


async def main() -> None:
    print("initializing…", flush=True)
    await init_db()
    print("db ok", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
