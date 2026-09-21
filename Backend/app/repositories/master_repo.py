from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master import Supervisor, Worker
from app.models.profile import Company


class CompanyRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, company_id: UUID) -> Company | None:
        result = await self.db.execute(select(Company).where(Company.id == company_id))
        return result.scalar_one_or_none()


class MasterRepo:
    def __init__(self, db: AsyncSession, company_id: UUID):
        self.db = db
        self.company_id = company_id

    async def list_workers(self, status: str | None = None) -> list[Worker]:
        stmt = select(Worker).where(Worker.company_id == self.company_id)
        if status:
            stmt = stmt.where(Worker.status == status)
        result = await self.db.execute(stmt.order_by(Worker.name))
        return list(result.scalars().all())

    async def list_supervisors(self, status: str | None = None) -> list[Supervisor]:
        stmt = select(Supervisor).where(Supervisor.company_id == self.company_id)
        if status:
            stmt = stmt.where(Supervisor.status == status)
        result = await self.db.execute(stmt.order_by(Supervisor.name))
        return list(result.scalars().all())
