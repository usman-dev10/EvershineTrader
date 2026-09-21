from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import Job, JobPile, Shift, ShiftWorker


class ShiftRepo:
    def __init__(self, db: AsyncSession, company_id: UUID):
        self.db = db
        self.company_id = company_id

    async def get_current_open(self) -> Shift | None:
        result = await self.db.execute(
            select(Shift).where(
                Shift.company_id == self.company_id, Shift.status == "open"
            )
        )
        return result.scalar_one_or_none()

    async def list_shifts(self, status: str | None = None) -> list[Shift]:
        stmt = select(Shift).where(Shift.company_id == self.company_id)
        if status:
            stmt = stmt.where(Shift.status == status)
        result = await self.db.execute(stmt.order_by(Shift.created_at.desc()))
        return list(result.scalars().all())

    async def get(self, shift_id: UUID) -> Shift | None:
        result = await self.db.execute(
            select(Shift).where(
                Shift.id == shift_id, Shift.company_id == self.company_id
            )
        )
        return result.scalar_one_or_none()

    async def create(self, shift: Shift) -> Shift:
        self.db.add(shift)
        await self.db.commit()
        await self.db.refresh(shift)
        return shift

    async def close(self, shift: Shift, closed_by: UUID) -> Shift:
        shift.status = "closed"
        shift.closed_by = closed_by
        shift.closed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(shift)
        return shift


class JobRepo:
    def __init__(self, db: AsyncSession, company_id: UUID):
        self.db = db
        self.company_id = company_id

    async def list_jobs(
        self,
        *,
        shift_id: UUID | None = None,
        machine_id: UUID | None = None,
        status: str | None = None,
    ) -> list[Job]:
        stmt = select(Job).where(Job.company_id == self.company_id)
        if shift_id:
            stmt = stmt.where(Job.shift_id == shift_id)
        if machine_id:
            stmt = stmt.where(Job.machine_id == machine_id)
        if status:
            stmt = stmt.where(Job.status == status)
        result = await self.db.execute(
            stmt.order_by(Job.created_at.desc(), Job.id.desc())
        )
        return list(result.scalars().all())

    async def get(self, job_id: UUID) -> Job | None:
        result = await self.db.execute(
            select(Job).where(Job.id == job_id, Job.company_id == self.company_id)
        )
        return result.scalar_one_or_none()

    async def create(self, job: Job) -> Job:
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def update(self, job: Job) -> Job:
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def allocated_sheets(self, job_id: UUID) -> int:
        """Completed piles only (pile_out_at set) count toward break sheets."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(JobPile.sheets), 0)).where(
                JobPile.job_id == job_id,
                JobPile.pile_out_at.is_not(None),
            )
        )
        return int(result.scalar_one())

    async def open_pile_count(self, job_id: UUID, worker_id: UUID | None = None) -> int:
        stmt = select(func.count()).select_from(JobPile).where(
            JobPile.job_id == job_id,
            JobPile.pile_out_at.is_(None),
        )
        if worker_id is not None:
            stmt = stmt.where(JobPile.worker_id == worker_id)
        result = await self.db.execute(stmt)
        return int(result.scalar_one())

    async def completed_pile_count(self, job_id: UUID, worker_id: UUID | None = None) -> int:
        stmt = select(func.count()).select_from(JobPile).where(
            JobPile.job_id == job_id,
            JobPile.pile_out_at.is_not(None),
        )
        if worker_id is not None:
            stmt = stmt.where(JobPile.worker_id == worker_id)
        result = await self.db.execute(stmt)
        return int(result.scalar_one())


class PileRepo:
    def __init__(self, db: AsyncSession, company_id: UUID):
        self.db = db
        self.company_id = company_id

    async def create_with_limit_check(
        self,
        *,
        job_id: UUID,
        worker_id: UUID,
        shift_id: UUID,
        sheets: int,
        is_custom: bool,
        sheet_option_id: UUID | None,
        created_by: UUID,
        pile_in_at: datetime | None = None,
        pile_out_at: datetime | None = None,
        open_only: bool = False,
    ) -> tuple[JobPile, int, int]:
        """Lock job row (or serialize on SQLite), enforce sheet limit, insert pile."""
        from datetime import datetime, timezone

        job_result = await self.db.execute(
            select(Job)
            .where(Job.id == job_id, Job.company_id == self.company_id)
            .with_for_update()
        )
        job = job_result.scalar_one()
        allocated = await JobRepo(self.db, self.company_id).allocated_sheets(job_id)
        # Allow over-break so remaining can go negative (shown red in UI).
        remaining = 10**9

        now = datetime.now(timezone.utc)
        pile = JobPile(
            company_id=self.company_id,
            job_id=job_id,
            worker_id=worker_id,
            shift_id=shift_id,
            sheets=sheets,
            is_custom=is_custom,
            sheet_option_id=sheet_option_id,
            pile_in_at=pile_in_at or now,
            pile_out_at=None if open_only else (pile_out_at or now),
            created_by=created_by,
        )
        self.db.add(pile)
        await self.db.commit()
        await self.db.refresh(pile)
        new_allocated = await JobRepo(self.db, self.company_id).allocated_sheets(job_id)
        if job.total_sheets > 0:
            new_remaining = job.total_sheets - new_allocated
        else:
            new_remaining = new_allocated
        return pile, new_allocated, new_remaining

    async def list_for_job(self, job_id: UUID) -> list[JobPile]:
        result = await self.db.execute(
            select(JobPile)
            .where(JobPile.job_id == job_id, JobPile.company_id == self.company_id)
            .order_by(JobPile.created_at.asc())
        )
        return list(result.scalars().all())

    async def get(self, pile_id: UUID) -> JobPile | None:
        result = await self.db.execute(
            select(JobPile).where(
                JobPile.id == pile_id, JobPile.company_id == self.company_id
            )
        )
        return result.scalar_one_or_none()

    async def get_open_for_worker(
        self, job_id: UUID, worker_id: UUID
    ) -> JobPile | None:
        result = await self.db.execute(
            select(JobPile)
            .where(
                JobPile.job_id == job_id,
                JobPile.worker_id == worker_id,
                JobPile.company_id == self.company_id,
                JobPile.pile_out_at.is_(None),
            )
            .order_by(JobPile.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def complete_out(
        self, pile: JobPile, *, pile_out_at: datetime | None = None
    ) -> tuple[JobPile, int, int]:
        from datetime import datetime, timezone

        job_result = await self.db.execute(
            select(Job)
            .where(Job.id == pile.job_id, Job.company_id == self.company_id)
            .with_for_update()
        )
        job = job_result.scalar_one()
        # Allow over-break; remaining may go negative (red in UI).
        pile.pile_out_at = pile_out_at or datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(pile)
        new_allocated = await JobRepo(self.db, self.company_id).allocated_sheets(
            pile.job_id
        )
        if job.total_sheets > 0:
            new_remaining = job.total_sheets - new_allocated
        else:
            new_remaining = new_allocated
        return pile, new_allocated, new_remaining

    async def update_sheets(self, pile: JobPile, sheets: int) -> JobPile:
        pile.sheets = sheets
        await self.db.commit()
        await self.db.refresh(pile)
        return pile

    async def delete(self, pile: JobPile) -> None:
        await self.db.delete(pile)
        await self.db.commit()
