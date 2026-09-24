from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.models.master import Employee, LoginAccount, Machine, Supervisor, Worker
from app.models.operations import Job, JobPile, Shift, ShiftMachine, ShiftWorker
from app.repositories.master_repo import MasterRepo
from app.repositories.ops_repo import JobRepo, PileRepo, ShiftRepo
from app.schemas.common import MachineOut
from app.schemas.operations import (
    CompanyDashboardOut,
    DutyBulkUpdate,
    EmployeeDashboardOut,
    JobCreate,
    JobOut,
    JobUpdate,
    PileCreate,
    PileSheetsUpdate,
    ShiftCreate,
    ShiftOut,
    ShiftUpdate,
)

FLOOR_SUPERVISORS = ("Imran", "Suleman")


class OpsService:
    def __init__(self, db: AsyncSession, company_id: UUID, actor_id: UUID):
        self.db = db
        self.company_id = company_id
        self.actor_id = actor_id
        self.shifts = ShiftRepo(db, company_id)
        self.jobs = JobRepo(db, company_id)
        self.piles = PileRepo(db, company_id)

    async def current_shift(self):
        return await self.shifts.get_current_open()

    async def _job_number_on_shift(
        self,
        shift_id: UUID,
        job_number: str,
        *,
        exclude_id: UUID | None = None,
    ) -> Job | None:
        stmt = select(Job).where(
            Job.company_id == self.company_id,
            Job.shift_id == shift_id,
            Job.job_number == job_number,
        )
        if exclude_id is not None:
            stmt = stmt.where(Job.id != exclude_id)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def ensure_floor_supervisors(self) -> list[Supervisor]:
        result = await self.db.execute(
            select(Supervisor).where(
                Supervisor.company_id == self.company_id,
                Supervisor.name.in_(FLOOR_SUPERVISORS),
            )
        )
        existing = {s.name: s for s in result.scalars().all()}
        for name in FLOOR_SUPERVISORS:
            if name in existing:
                row = existing[name]
                if row.status != "active":
                    row.status = "active"
                continue
            row = Supervisor(
                company_id=self.company_id,
                name=name,
                staff_code=name.upper(),
                status="active",
                created_by=self.actor_id,
            )
            self.db.add(row)
            existing[name] = row
        await self.db.commit()
        for row in existing.values():
            await self.db.refresh(row)
        return [existing[name] for name in FLOOR_SUPERVISORS]

    async def serialize_shift(self, shift: Shift | None) -> ShiftOut | None:
        if not shift:
            return None
        data = ShiftOut.model_validate(shift)
        data.opened_at = shift.created_at
        if not data.original_start_time:
            data.original_start_time = shift.start_time
        if not data.original_end_time:
            data.original_end_time = shift.end_time

        if shift.supervisor_id:
            supervisor = await self.db.get(Supervisor, shift.supervisor_id)
            data.supervisor_name = supervisor.name if supervisor else None

        machines_result = await self.db.execute(
            select(Machine)
            .join(ShiftMachine, ShiftMachine.machine_id == Machine.id)
            .where(
                ShiftMachine.shift_id == shift.id,
                ShiftMachine.company_id == self.company_id,
            )
            .order_by(Machine.machine_number, Machine.name)
        )
        data.machines = [
            MachineOut.model_validate(m) for m in machines_result.scalars().all()
        ]
        return data

    async def serialize_shifts(self, shifts: list[Shift]) -> list[dict]:
        if not shifts:
            return []
        shift_ids = [s.id for s in shifts]
        supervisor_ids = [s.supervisor_id for s in shifts if s.supervisor_id]
        names: dict[UUID, str] = {}
        if supervisor_ids:
            result = await self.db.execute(
                select(Supervisor).where(Supervisor.id.in_(supervisor_ids))
            )
            names = {s.id: s.name for s in result.scalars().all()}

        machines_result = await self.db.execute(
            select(ShiftMachine.shift_id, Machine)
            .join(Machine, Machine.id == ShiftMachine.machine_id)
            .where(
                ShiftMachine.shift_id.in_(shift_ids),
                ShiftMachine.company_id == self.company_id,
            )
            .order_by(Machine.machine_number, Machine.name)
        )
        machines_by_shift: dict[UUID, list[MachineOut]] = {}
        for shift_id, machine in machines_result.all():
            machines_by_shift.setdefault(shift_id, []).append(
                MachineOut.model_validate(machine)
            )

        out: list[dict] = []
        for shift in shifts:
            data = ShiftOut.model_validate(shift)
            data.opened_at = shift.created_at
            if not data.original_start_time:
                data.original_start_time = shift.start_time
            if not data.original_end_time:
                data.original_end_time = shift.end_time
            if shift.supervisor_id:
                data.supervisor_name = names.get(shift.supervisor_id)
            data.machines = machines_by_shift.get(shift.id, [])
            out.append(data.model_dump(mode="json"))
        return out

    async def _require_valid_machines(self, machine_ids: list) -> list:
        ids = list(dict.fromkeys(machine_ids))
        if not ids:
            return []
        valid = await self.db.execute(
            select(func.count())
            .select_from(Machine)
            .where(
                Machine.company_id == self.company_id,
                Machine.id.in_(ids),
            )
        )
        if int(valid.scalar_one()) != len(ids):
            raise AppError(
                "VALIDATION_ERROR",
                "One or more machines are invalid.",
                400,
            )
        return ids

    async def _replace_shift_machines(self, shift_id, machine_ids: list) -> None:
        ids = await self._require_valid_machines(machine_ids)
        await self.db.execute(
            delete(ShiftMachine).where(
                ShiftMachine.shift_id == shift_id,
                ShiftMachine.company_id == self.company_id,
            )
        )
        await self.db.flush()
        for machine_id in ids:
            self.db.add(
                ShiftMachine(
                    company_id=self.company_id,
                    shift_id=shift_id,
                    machine_id=machine_id,
                )
            )


    async def create_shift(self, payload: ShiftCreate) -> Shift:
        await self.ensure_floor_supervisors()
        existing = await self.shifts.get_current_open()
        if existing:
            raise AppError(
                "SHIFT_ALREADY_OPEN",
                f"Shift {existing.name} is currently open. Close it before opening a new shift.",
                409,
            )
        name = payload.name.strip().upper()
        if name not in ("A", "B"):
            raise AppError("VALIDATION_ERROR", "Shift must be A or B.", 400)

        # Same shift letter + same date cannot be entered twice
        dup = await self.db.execute(
            select(Shift).where(
                Shift.company_id == self.company_id,
                Shift.name == name,
                Shift.shift_date == payload.shift_date,
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise AppError(
                "DUPLICATE_SHIFT",
                f"Shift {name} for {payload.shift_date.isoformat()} already exists.",
                409,
            )

        if payload.machine_ids:
            valid = await self.db.execute(
                select(func.count())
                .select_from(Machine)
                .where(
                    Machine.company_id == self.company_id,
                    Machine.id.in_(payload.machine_ids),
                )
            )
            if int(valid.scalar_one()) != len(set(payload.machine_ids)):
                raise AppError("VALIDATION_ERROR", "One or more machines are invalid.", 400)

        shift = Shift(
            company_id=self.company_id,
            name=name,
            shift_date=payload.shift_date,
            start_time=payload.start_time,
            end_time=payload.end_time,
            original_start_time=payload.start_time,
            original_end_time=payload.end_time,
            supervisor_id=payload.supervisor_id,
            shift_template_id=payload.shift_template_id,
            created_by=self.actor_id,
            status="open",
        )
        try:
            shift = await self.shifts.create(shift)
        except Exception as exc:
            raise AppError(
                "SHIFT_ALREADY_OPEN",
                "A shift is currently open. Close it before opening a new one.",
                409,
            ) from exc

        if payload.machine_ids:
            await self._replace_shift_machines(shift.id, payload.machine_ids)

        await self.db.commit()
        await self.db.refresh(shift)
        return shift

    async def update_shift(self, shift_id: UUID, payload: ShiftUpdate) -> Shift:
        shift = await self.shifts.get(shift_id)
        if not shift:
            raise AppError("NOT_FOUND", "Shift not found.", 404)

        name = (payload.name or shift.name).strip().upper()
        if name not in ("A", "B"):
            raise AppError("VALIDATION_ERROR", "Shift must be A or B.", 400)
        shift_date = payload.shift_date or shift.shift_date

        dup = await self.db.execute(
            select(Shift).where(
                Shift.company_id == self.company_id,
                Shift.name == name,
                Shift.shift_date == shift_date,
                Shift.id != shift.id,
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise AppError(
                "DUPLICATE_SHIFT",
                f"Shift {name} for {shift_date.isoformat()} already exists.",
                409,
            )

        if shift.original_start_time is None:
            shift.original_start_time = shift.start_time
        if shift.original_end_time is None:
            shift.original_end_time = shift.end_time

        shift.name = name
        shift.shift_date = shift_date
        shift.start_time = payload.start_time
        shift.end_time = payload.end_time
        if payload.supervisor_id is not None:
            shift.supervisor_id = payload.supervisor_id

        if payload.machine_ids is not None:
            await self._replace_shift_machines(shift.id, payload.machine_ids)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError(
                "UPDATE_FAILED",
                "Unable to update this shift. Check machines and try again.",
                400,
            ) from exc
        await self.db.refresh(shift)
        return shift

    async def delete_shift(self, shift_id: UUID) -> dict:
        shift = await self.shifts.get(shift_id)
        if not shift:
            raise AppError("NOT_FOUND", "Shift not found.", 404)

        job_ids = list(
            (
                await self.db.execute(
                    select(Job.id).where(
                        Job.company_id == self.company_id,
                        Job.shift_id == shift_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        pile_filter = [JobPile.shift_id == shift_id]
        if job_ids:
            pile_filter.append(JobPile.job_id.in_(job_ids))

        await self.db.execute(
            delete(JobPile).where(
                JobPile.company_id == self.company_id,
                or_(*pile_filter),
            )
        )
        await self.db.execute(
            delete(Job).where(
                Job.company_id == self.company_id,
                Job.shift_id == shift_id,
            )
        )
        await self.db.execute(
            delete(ShiftWorker).where(
                ShiftWorker.company_id == self.company_id,
                ShiftWorker.shift_id == shift_id,
            )
        )
        await self.db.execute(
            delete(ShiftMachine).where(
                ShiftMachine.company_id == self.company_id,
                ShiftMachine.shift_id == shift_id,
            )
        )
        await self.db.execute(
            delete(Shift).where(
                Shift.company_id == self.company_id,
                Shift.id == shift_id,
            )
        )
        await self.db.commit()
        return {"deleted": True, "shift_id": str(shift_id)}

    async def clear_all_shifts(self) -> dict:
        """Remove all shifts and related floor records for this company."""
        shift_ids = list(
            (
                await self.db.execute(
                    select(Shift.id).where(Shift.company_id == self.company_id)
                )
            )
            .scalars()
            .all()
        )
        if shift_ids:
            await self.db.execute(
                delete(JobPile).where(JobPile.company_id == self.company_id)
            )
            await self.db.execute(delete(Job).where(Job.company_id == self.company_id))
            await self.db.execute(
                delete(ShiftWorker).where(ShiftWorker.company_id == self.company_id)
            )
            await self.db.execute(
                delete(ShiftMachine).where(ShiftMachine.company_id == self.company_id)
            )
            await self.db.execute(
                delete(Shift).where(Shift.company_id == self.company_id)
            )
            await self.db.commit()
        return {"cleared": len(shift_ids)}

    async def close_shift(self, shift_id: UUID) -> Shift:
        shift = await self.shifts.get(shift_id)
        if not shift:
            raise AppError("NOT_FOUND", "Shift not found.", 404)
        if shift.status == "closed":
            raise AppError("SHIFT_CLOSED", "This shift is already closed.", 409)

        open_rows = (
            await self.db.execute(
                select(JobPile, Worker, Job)
                .join(Worker, Worker.id == JobPile.worker_id)
                .join(Job, Job.id == JobPile.job_id)
                .where(
                    JobPile.company_id == self.company_id,
                    JobPile.pile_out_at.is_(None),
                )
                .order_by(Worker.name)
            )
        ).all()
        if open_rows:
            parts = []
            for _pile, worker, job in open_rows:
                label = (job.job_number or "").strip() or job.job_name
                parts.append(f"{worker.name} ({label})")
            raise AppError(
                "PILE_STILL_IN",
                "Cannot close shift. Pile still IN: " + ", ".join(parts)
                + ". Press Out first.",
                409,
            )

        return await self.shifts.close(shift, self.actor_id)

    async def save_duty(self, shift_id: UUID, payload: DutyBulkUpdate):
        shift = await self.shifts.get(shift_id)
        if not shift:
            raise AppError("NOT_FOUND", "Shift not found.", 404)
        if shift.status != "open":
            raise AppError("SHIFT_CLOSED", "This shift is closed. New records cannot be added.", 409)

        for item in payload.workers:
            result = await self.db.execute(
                select(ShiftWorker).where(
                    ShiftWorker.shift_id == shift_id,
                    ShiftWorker.worker_id == item.worker_id,
                )
            )
            row = result.scalar_one_or_none()
            if row:
                row.duty_status = item.duty_status
                row.recorded_by = self.actor_id
            else:
                self.db.add(
                    ShiftWorker(
                        company_id=self.company_id,
                        shift_id=shift_id,
                        worker_id=item.worker_id,
                        duty_status=item.duty_status,
                        recorded_by=self.actor_id,
                    )
                )
        await self.db.commit()
        return {"saved": len(payload.workers)}

    async def create_job(self, payload: JobCreate) -> Job:
        if payload.shift_id:
            target_shift = await self.shifts.get(payload.shift_id)
            if not target_shift:
                raise AppError("NOT_FOUND", "Shift not found.", 404)
        else:
            target_shift = await self.shifts.get_current_open()
            if not target_shift:
                raise AppError(
                    "NO_OPEN_SHIFT",
                    "No shift is currently open. Please open a shift before creating a job.",
                    409,
                )

        if payload.machine_id is None:
            raise AppError("VALIDATION_ERROR", "Machine number is required.", 400)

        on_shift = await self.db.execute(
            select(ShiftMachine).where(
                ShiftMachine.shift_id == target_shift.id,
                ShiftMachine.machine_id == payload.machine_id,
            )
        )
        if on_shift.scalar_one_or_none() is None:
            machine = await self.db.execute(
                select(Machine).where(
                    Machine.id == payload.machine_id,
                    Machine.company_id == self.company_id,
                )
            )
            if machine.scalar_one_or_none() is None:
                raise AppError("VALIDATION_ERROR", "Machine not found.", 400)
            raise AppError(
                "VALIDATION_ERROR",
                "Select a machine that is running on this shift.",
                400,
            )

        job_number = (payload.job_number or "").strip() or None
        if job_number:
            taken = await self._job_number_on_shift(target_shift.id, job_number)
            if taken is not None:
                raise AppError(
                    "DUPLICATE_JOB_NUMBER",
                    "This job number is already used on this shift.",
                    409,
                )
        else:
            count_result = await self.db.execute(
                select(func.count())
                .select_from(Job)
                .where(
                    Job.company_id == self.company_id,
                    Job.shift_id == target_shift.id,
                )
            )
            n = int(count_result.scalar_one() or 0) + 1
            while True:
                candidate = f"Job{n}"
                taken = await self._job_number_on_shift(target_shift.id, candidate)
                if taken is None:
                    job_number = candidate
                    break
                n += 1

        total_sheets = payload.total_sheets if payload.total_sheets is not None else 0

        job = Job(
            company_id=self.company_id,
            shift_id=target_shift.id,
            machine_id=payload.machine_id,
            job_number=job_number,
            job_name=payload.job_name.strip(),
            total_sheets=total_sheets,
            dabbi=payload.dabbi,
            ups=payload.ups,
            created_by=self.actor_id,
            created_at=datetime.now(timezone.utc),
        )
        try:
            return await self.jobs.create(job)
        except AppError:
            raise
        except IntegrityError as exc:
            raise AppError(
                "DUPLICATE_JOB_NUMBER",
                "This job number is already used on this shift.",
                409,
            ) from exc
        except Exception as exc:
            raise AppError(
                "CREATE_FAILED",
                f"Unable to create this job: {exc}",
                400,
            ) from exc

    async def serialize_job(self, job: Job) -> dict:
        allocated = await self.jobs.allocated_sheets(job.id)
        open_count = await self.jobs.open_pile_count(job.id)
        completed_count = await self.jobs.completed_pile_count(job.id)
        item = JobOut.model_validate(job).model_dump(mode="json")
        item["allocated_sheets"] = allocated
        item["break_sheets"] = allocated
        item["open_pile_count"] = open_count
        item["completed_pile_count"] = completed_count
        if job.total_sheets > 0:
            item["remaining_sheets"] = job.total_sheets - allocated
        else:
            item["remaining_sheets"] = None

        shift = await self.shifts.get(job.shift_id)
        if shift:
            item["shift_name"] = shift.name
            item["shift_date"] = shift.shift_date.isoformat()

        if job.machine_id:
            machine = await self.db.get(Machine, job.machine_id)
            if machine:
                item["machine_number"] = machine.machine_number
                item["machine_name"] = machine.name
        return item

    async def _pile_stats_by_job(
        self, job_ids: list[UUID]
    ) -> tuple[dict[UUID, int], dict[UUID, int], dict[UUID, int]]:
        allocated: dict[UUID, int] = {}
        open_counts: dict[UUID, int] = {}
        completed_counts: dict[UUID, int] = {}
        if not job_ids:
            return allocated, open_counts, completed_counts

        alloc_rows = (
            await self.db.execute(
                select(JobPile.job_id, func.coalesce(func.sum(JobPile.sheets), 0))
                .where(
                    JobPile.job_id.in_(job_ids),
                    JobPile.pile_out_at.is_not(None),
                )
                .group_by(JobPile.job_id)
            )
        ).all()
        allocated = {row[0]: int(row[1]) for row in alloc_rows}

        open_rows = (
            await self.db.execute(
                select(JobPile.job_id, func.count())
                .where(
                    JobPile.job_id.in_(job_ids),
                    JobPile.pile_out_at.is_(None),
                )
                .group_by(JobPile.job_id)
            )
        ).all()
        open_counts = {row[0]: int(row[1]) for row in open_rows}

        done_rows = (
            await self.db.execute(
                select(JobPile.job_id, func.count())
                .where(
                    JobPile.job_id.in_(job_ids),
                    JobPile.pile_out_at.is_not(None),
                )
                .group_by(JobPile.job_id)
            )
        ).all()
        completed_counts = {row[0]: int(row[1]) for row in done_rows}
        return allocated, open_counts, completed_counts

    async def serialize_jobs(self, jobs: list[Job]) -> list[dict]:
        if not jobs:
            return []
        allocated, open_counts, completed_counts = await self._pile_stats_by_job(
            [j.id for j in jobs]
        )
        shift_ids = {j.shift_id for j in jobs}
        shifts: dict[UUID, Shift] = {}
        if shift_ids:
            result = await self.db.execute(select(Shift).where(Shift.id.in_(shift_ids)))
            shifts = {s.id: s for s in result.scalars().all()}
        machine_ids = {j.machine_id for j in jobs if j.machine_id}
        machines: dict[UUID, Machine] = {}
        if machine_ids:
            result = await self.db.execute(
                select(Machine).where(Machine.id.in_(machine_ids))
            )
            machines = {m.id: m for m in result.scalars().all()}

        items: list[dict] = []
        for job in jobs:
            broken = allocated.get(job.id, 0)
            item = JobOut.model_validate(job).model_dump(mode="json")
            item["allocated_sheets"] = broken
            item["break_sheets"] = broken
            item["open_pile_count"] = open_counts.get(job.id, 0)
            item["completed_pile_count"] = completed_counts.get(job.id, 0)
            item["remaining_sheets"] = (
                job.total_sheets - broken if job.total_sheets > 0 else None
            )
            shift = shifts.get(job.shift_id)
            if shift:
                item["shift_name"] = shift.name
                item["shift_date"] = shift.shift_date.isoformat()
            if job.machine_id:
                machine = machines.get(job.machine_id)
                if machine:
                    item["machine_number"] = machine.machine_number
                    item["machine_name"] = machine.name
            items.append(item)
        return items

    async def update_job(self, job_id: UUID, payload: JobUpdate) -> Job:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        # Edit allowed even after shift is closed (corrections)
        machine = await self.db.execute(
            select(Machine).where(
                Machine.id == payload.machine_id,
                Machine.company_id == self.company_id,
            )
        )
        if machine.scalar_one_or_none() is None:
            raise AppError("VALIDATION_ERROR", "Machine not found.", 400)

        # Prefer shift machines when the job's shift still has a machine list
        shift_machines = await self.db.execute(
            select(ShiftMachine).where(ShiftMachine.shift_id == job.shift_id)
        )
        allowed = {sm.machine_id for sm in shift_machines.scalars().all()}
        if allowed and payload.machine_id not in allowed:
            # After close, still allow any company machine for corrections
            shift = await self.shifts.get(job.shift_id)
            if shift and shift.status == "open":
                raise AppError(
                    "VALIDATION_ERROR",
                    "Machine is not selected for this shift.",
                    400,
                )

        job.job_name = payload.job_name.strip()
        job.machine_id = payload.machine_id
        new_number = (payload.job_number or "").strip() or None
        if new_number:
            taken = await self._job_number_on_shift(
                job.shift_id, new_number, exclude_id=job.id
            )
            if taken is not None:
                raise AppError(
                    "DUPLICATE_JOB_NUMBER",
                    "This job number is already used on this shift.",
                    409,
                )
        job.job_number = new_number
        if payload.total_sheets is not None:
            job.total_sheets = payload.total_sheets
        else:
            job.total_sheets = 0
        job.dabbi = payload.dabbi
        job.ups = payload.ups

        try:
            return await self.jobs.update(job)
        except Exception as exc:
            raise AppError(
                "UPDATE_FAILED",
                "Unable to update this job.",
                400,
            ) from exc

    def _shift_letter_rank(self, name: str | None) -> int:
        return 1 if (name or "").strip().upper() == "B" else 0

    def _shift_is_after(self, source: Shift, target: Shift) -> bool:
        if target.id == source.id:
            return False
        if target.shift_date > source.shift_date:
            return True
        if target.shift_date < source.shift_date:
            return False
        return self._shift_letter_rank(target.name) > self._shift_letter_rank(
            source.name
        )

    async def duplicate_job(self, job_id: UUID, target_shift_id: UUID) -> Job:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)
        if job.machine_id is None:
            raise AppError("VALIDATION_ERROR", "This job has no machine to copy.", 400)

        source_shift = await self.shifts.get(job.shift_id)
        target_shift = await self.shifts.get(target_shift_id)
        if not source_shift or not target_shift:
            raise AppError("NOT_FOUND", "Shift not found.", 404)
        if not self._shift_is_after(source_shift, target_shift):
            raise AppError(
                "VALIDATION_ERROR",
                "Select a shift that opened after this job.",
                400,
            )

        on_shift = await self.db.execute(
            select(ShiftMachine).where(
                ShiftMachine.shift_id == target_shift.id,
                ShiftMachine.machine_id == job.machine_id,
            )
        )
        if on_shift.scalar_one_or_none() is None:
            machine = await self.db.execute(
                select(Machine).where(
                    Machine.id == job.machine_id,
                    Machine.company_id == self.company_id,
                )
            )
            if machine.scalar_one_or_none() is None:
                raise AppError("VALIDATION_ERROR", "Machine not found.", 400)
            self.db.add(
                ShiftMachine(
                    company_id=self.company_id,
                    shift_id=target_shift.id,
                    machine_id=job.machine_id,
                )
            )
            await self.db.flush()

        job_number = (job.job_number or "").strip() or None
        if job_number:
            taken = await self._job_number_on_shift(target_shift.id, job_number)
            if taken is not None:
                raise AppError(
                    "DUPLICATE_JOB_NUMBER",
                    "This job number is already used on the selected shift.",
                    409,
                )
        else:
            count_result = await self.db.execute(
                select(func.count())
                .select_from(Job)
                .where(
                    Job.company_id == self.company_id,
                    Job.shift_id == target_shift.id,
                )
            )
            n = int(count_result.scalar_one() or 0) + 1
            while True:
                candidate = f"Job{n}"
                taken = await self._job_number_on_shift(target_shift.id, candidate)
                if taken is None:
                    job_number = candidate
                    break
                n += 1

        copy = Job(
            company_id=self.company_id,
            shift_id=target_shift.id,
            machine_id=job.machine_id,
            job_number=job_number,
            job_name=job.job_name,
            total_sheets=0,
            dabbi=job.dabbi,
            ups=job.ups if job.ups is not None else 0,
            created_by=self.actor_id,
            created_at=datetime.now(timezone.utc),
        )
        try:
            return await self.jobs.create(copy)
        except IntegrityError as exc:
            raise AppError(
                "DUPLICATE_JOB_NUMBER",
                "This job number is already used on the selected shift.",
                409,
            ) from exc

    async def delete_job(self, job_id: UUID) -> dict:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)
        await self.db.execute(
            delete(JobPile).where(
                JobPile.company_id == self.company_id,
                JobPile.job_id == job_id,
            )
        )
        await self.db.execute(
            delete(Job).where(
                Job.company_id == self.company_id,
                Job.id == job_id,
            )
        )
        await self.db.commit()
        return {"deleted": True, "job_id": str(job_id)}

    def _serialize_pile(
        self,
        pile: JobPile,
        *,
        series_no: int | None = None,
        worker_name: str | None = None,
        job_shift_id: UUID | None = None,
        work_shift_name: str | None = None,
        work_shift_date: date | None = None,
    ) -> dict:
        total_seconds = None
        if pile.pile_in_at and pile.pile_out_at:
            start = pile.pile_in_at
            end = pile.pile_out_at
            if start.tzinfo is None and end.tzinfo is not None:
                start = start.replace(tzinfo=timezone.utc)
            elif end.tzinfo is None and start.tzinfo is not None:
                end = end.replace(tzinfo=timezone.utc)
            total_seconds = int((end - start).total_seconds())

        pile_date = None
        if pile.pile_in_at:
            pile_date = (
                pile.pile_in_at.date().isoformat()
                if hasattr(pile.pile_in_at, "date")
                else str(pile.pile_in_at)[:10]
            )
        elif work_shift_date is not None:
            pile_date = work_shift_date.isoformat()

        other_shift = (
            job_shift_id is not None and pile.shift_id != job_shift_id
        )
        return {
            "id": str(pile.id),
            "job_id": str(pile.job_id),
            "worker_id": str(pile.worker_id),
            "shift_id": str(pile.shift_id),
            "sheets": pile.sheets,
            "is_custom": pile.is_custom,
            "pile_in_at": pile.pile_in_at.isoformat() if pile.pile_in_at else None,
            "pile_out_at": pile.pile_out_at.isoformat() if pile.pile_out_at else None,
            "created_at": pile.created_at.isoformat() if pile.created_at else None,
            "series_no": series_no,
            "worker_name": worker_name,
            "total_seconds": total_seconds,
            "pile_date": pile_date,
            "work_shift_name": work_shift_name,
            "work_shift_date": work_shift_date.isoformat() if work_shift_date else None,
            "other_shift": other_shift,
        }

    async def list_job_piles(self, job_id: UUID) -> list[dict]:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        piles = await self.piles.list_for_job(job_id)
        worker_ids = {p.worker_id for p in piles}
        names: dict[UUID, str] = {}
        if worker_ids:
            result = await self.db.execute(
                select(Worker).where(Worker.id.in_(worker_ids))
            )
            names = {w.id: w.name for w in result.scalars().all()}

        shift_ids = {p.shift_id for p in piles}
        shifts: dict[UUID, Shift] = {}
        if shift_ids:
            result = await self.db.execute(select(Shift).where(Shift.id.in_(shift_ids)))
            shifts = {s.id: s for s in result.scalars().all()}

        series_by_worker: dict[UUID, int] = {}
        rows: list[dict] = []
        for pile in piles:
            series = None
            if pile.pile_out_at is not None:
                series_by_worker[pile.worker_id] = (
                    series_by_worker.get(pile.worker_id, 0) + 1
                )
                series = series_by_worker[pile.worker_id]
            work_shift = shifts.get(pile.shift_id)
            rows.append(
                self._serialize_pile(
                    pile,
                    series_no=series,
                    worker_name=names.get(pile.worker_id),
                    job_shift_id=job.shift_id,
                    work_shift_name=work_shift.name if work_shift else None,
                    work_shift_date=work_shift.shift_date if work_shift else None,
                )
            )
        return rows

    async def worker_pile_stats(self, job_id: UUID) -> list[dict]:
        """Per-worker break sheets / open pile for a job (current on-duty workers)."""
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        # Duty is always against the currently open shift (so prior yellow jobs work)
        open_shift = await self.shifts.get_current_open()
        duty_shift_id = open_shift.id if open_shift else job.shift_id

        duty = await self.db.execute(
            select(ShiftWorker).where(
                ShiftWorker.shift_id == duty_shift_id,
                ShiftWorker.duty_status == "on",
            )
        )
        on_duty = list(duty.scalars().all())
        piles = await self.piles.list_for_job(job_id)

        by_worker: dict[UUID, list[JobPile]] = {}
        for p in piles:
            by_worker.setdefault(p.worker_id, []).append(p)

        worker_ids = {sw.worker_id for sw in on_duty} | set(by_worker.keys())
        names: dict[UUID, str] = {}
        if worker_ids:
            result = await self.db.execute(
                select(Worker).where(Worker.id.in_(worker_ids))
            )
            names = {w.id: w.name for w in result.scalars().all()}

        other_open_label: dict[UUID, str] = {}
        if worker_ids:
            other_open = (
                await self.db.execute(
                    select(JobPile, Job)
                    .join(Job, Job.id == JobPile.job_id)
                    .where(
                        JobPile.company_id == self.company_id,
                        JobPile.worker_id.in_(worker_ids),
                        JobPile.pile_out_at.is_(None),
                        JobPile.job_id != job_id,
                    )
                )
            ).all()
            for pile, other_job in other_open:
                other_open_label[pile.worker_id] = (
                    (other_job.job_number or "").strip() or other_job.job_name
                )

        on_duty_ids = {sw.worker_id for sw in on_duty}
        stats = []
        for wid in sorted(worker_ids, key=lambda i: names.get(i, "")):
            wp = by_worker.get(wid, [])
            completed = [p for p in wp if p.pile_out_at is not None]
            open_piles = [p for p in wp if p.pile_out_at is None]
            stats.append(
                {
                    "worker_id": str(wid),
                    "worker_name": names.get(wid, "—"),
                    "on_duty": wid in on_duty_ids,
                    "break_sheets": sum(p.sheets for p in completed),
                    "pile_count": len(completed),
                    "open_pile_count": len(open_piles),
                    "open_pile_id": str(open_piles[0].id) if open_piles else None,
                    "open_pile_sheets": open_piles[0].sheets if open_piles else None,
                    "open_pile_in_at": (
                        open_piles[0].pile_in_at.isoformat()
                        if open_piles and open_piles[0].pile_in_at
                        else None
                    ),
                    "open_on_other_job": other_open_label.get(wid),
                }
            )
        return stats

    async def _require_worker_on_current_shift(self, worker_id: UUID) -> Shift:
        open_shift = await self.shifts.get_current_open()
        if not open_shift:
            raise AppError(
                "SHIFT_CLOSED",
                "No shift is open. Open a shift before recording piles.",
                409,
            )
        duty = await self.db.execute(
            select(ShiftWorker).where(
                ShiftWorker.shift_id == open_shift.id,
                ShiftWorker.worker_id == worker_id,
                ShiftWorker.duty_status == "on",
            )
        )
        if duty.scalar_one_or_none() is None:
            raise AppError(
                "WORKER_NOT_ON_DUTY",
                "This worker is not on duty for the current shift.",
                409,
            )
        return open_shift

    async def create_pile(self, job_id: UUID, worker_id: UUID, payload: PileCreate):
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        # Allow prior-shift yellow jobs; duty checked against current open shift
        open_shift = await self._require_worker_on_current_shift(worker_id)

        open_only = bool(payload.open_only)
        if open_only:
            existing = await self.piles.get_any_open_for_worker(worker_id)
            if existing:
                if existing.job_id == job_id:
                    raise AppError(
                        "PILE_ALREADY_OPEN",
                        "This worker already has a pile IN. Press Out first.",
                        409,
                    )
                other = await self.jobs.get(existing.job_id)
                label = ""
                if other:
                    label = (other.job_number or "").strip() or other.job_name
                raise AppError(
                    "PILE_ALREADY_OPEN",
                    "This worker already has a pile IN"
                    + (f" on {label}" if label else "")
                    + ". Press Out on that job first.",
                    409,
                )

        now = datetime.now(timezone.utc)
        pile_in = payload.pile_in_at or now
        pile_out = None if open_only else (payload.pile_out_at or now)

        try:
            pile, allocated, remaining = await self.piles.create_with_limit_check(
                job_id=job_id,
                worker_id=worker_id,
                shift_id=open_shift.id,
                sheets=payload.sheets,
                is_custom=payload.is_custom,
                sheet_option_id=payload.sheet_option_id,
                created_by=self.actor_id,
                pile_in_at=pile_in,
                pile_out_at=pile_out,
                open_only=open_only,
            )
        except ValueError as exc:
            remaining = int(str(exc))
            raise AppError(
                "SHEET_LIMIT_EXCEEDED",
                f"Cannot add this pile. Only {remaining} sheets remain for this job.",
                409,
            ) from exc

        return {
            "pile": pile,
            "job_allocated_sheets": allocated,
            "job_remaining_sheets": remaining,
            "break_sheets": allocated,
        }

    async def pile_out(
        self, job_id: UUID, worker_id: UUID, *, pile_out_at: datetime | None = None
    ) -> dict:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        await self._require_worker_on_current_shift(worker_id)

        pile = await self.piles.get_open_for_worker(job_id, worker_id)
        if not pile:
            raise AppError(
                "NO_OPEN_PILE",
                "No open pile for this worker. Press In first.",
                409,
            )

        try:
            pile, allocated, remaining = await self.piles.complete_out(
                pile, pile_out_at=pile_out_at
            )
        except ValueError as exc:
            remaining = int(str(exc))
            raise AppError(
                "SHEET_LIMIT_EXCEEDED",
                f"Cannot complete this pile. Only {remaining} sheets remain for this job.",
                409,
            ) from exc

        return {
            "pile": pile,
            "job_allocated_sheets": allocated,
            "job_remaining_sheets": remaining,
            "break_sheets": allocated,
        }

    async def pile_cancel(self, job_id: UUID, worker_id: UUID) -> dict:
        """Cancel a mistaken In (delete open pile, no break sheet)."""
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        await self._require_worker_on_current_shift(worker_id)

        pile = await self.piles.get_open_for_worker(job_id, worker_id)
        if not pile:
            raise AppError(
                "NO_OPEN_PILE",
                "No open pile to cancel.",
                409,
            )

        await self.piles.delete(pile)
        allocated = await self.jobs.allocated_sheets(job_id)
        remaining = (
            job.total_sheets - allocated if job.total_sheets > 0 else None
        )
        return {
            "job_allocated_sheets": allocated,
            "job_remaining_sheets": remaining,
            "break_sheets": allocated,
        }

    async def update_pile_sheets(
        self, job_id: UUID, pile_id: UUID, payload: PileSheetsUpdate
    ) -> dict:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        pile = await self.piles.get(pile_id)
        if not pile or pile.job_id != job_id:
            raise AppError("NOT_FOUND", "This pile could not be found.", 404)

        pile = await self.piles.update_sheets(pile, payload.sheets)
        return self._serialize_pile(pile)

    async def delete_pile(self, job_id: UUID, pile_id: UUID) -> None:
        job = await self.jobs.get(job_id)
        if not job:
            raise AppError("NOT_FOUND", "This job could not be found.", 404)

        pile = await self.piles.get(pile_id)
        if not pile or pile.job_id != job_id:
            raise AppError("NOT_FOUND", "This pile could not be found.", 404)

        await self.piles.delete(pile)

    async def company_dashboard(self) -> CompanyDashboardOut:
        emp = await self.db.execute(
            select(func.count()).select_from(Employee).where(Employee.company_id == self.company_id)
        )
        acc = await self.db.execute(
            select(func.count())
            .select_from(LoginAccount)
            .where(LoginAccount.company_id == self.company_id)
        )
        mach = await self.db.execute(
            select(func.count()).select_from(Machine).where(Machine.company_id == self.company_id)
        )
        wrk = await self.db.execute(
            select(func.count()).select_from(Worker).where(Worker.company_id == self.company_id)
        )
        open_shift = await self.shifts.get_current_open()
        jobs = await self.jobs.list_jobs(status="open")
        total = sum(j.total_sheets for j in jobs)
        allocated = 0
        for j in jobs:
            allocated += await self.jobs.allocated_sheets(j.id)

        shift_worker_sheets: list[dict] = []
        if open_shift:
            piles = await self.db.execute(
                select(
                    Worker.name,
                    Employee.full_name,
                    func.coalesce(func.sum(JobPile.sheets), 0),
                )
                .select_from(ShiftWorker)
                .join(Worker, Worker.id == ShiftWorker.worker_id)
                .outerjoin(Employee, Employee.id == Worker.employee_id)
                .outerjoin(
                    JobPile,
                    (JobPile.worker_id == Worker.id) & (JobPile.shift_id == open_shift.id),
                )
                .where(
                    ShiftWorker.shift_id == open_shift.id,
                    ShiftWorker.duty_status == "on",
                )
                .group_by(Worker.name, Employee.full_name)
                .order_by(func.coalesce(func.sum(JobPile.sheets), 0).desc())
            )
            for worker_name, emp_name, sheets_sum in piles.all():
                shift_worker_sheets.append(
                    {
                        "worker_name": emp_name or worker_name,
                        "sheets": int(sheets_sum or 0),
                    }
                )

        # One chart per machine: workers (x) · sheets by UPS (grouped bars)
        DEFAULT_UPS = [2, 4, 8, 16]
        machines = list(
            (
                await self.db.execute(
                    select(Machine)
                    .where(Machine.company_id == self.company_id)
                    .order_by(Machine.machine_number, Machine.name)
                )
            )
            .scalars()
            .all()
        )
        workers = list(
            (
                await self.db.execute(
                    select(Worker)
                    .where(
                        Worker.company_id == self.company_id,
                        Worker.status == "active",
                    )
                    .order_by(Worker.name)
                )
            )
            .scalars()
            .all()
        )

        machine_ups_charts: list[dict] = []
        for machine in machines:
            ups_rows = await self.db.execute(
                select(Job.ups)
                .where(
                    Job.company_id == self.company_id,
                    Job.machine_id == machine.id,
                    Job.ups.is_not(None),
                )
                .distinct()
            )
            found_ups = sorted({int(u) for (u,) in ups_rows.all() if u is not None})
            ups_list = found_ups if found_ups else list(DEFAULT_UPS)

            # sheets[worker_id][ups] = sum
            sheet_map: dict[UUID, dict[int, int]] = {
                w.id: {u: 0 for u in ups_list} for w in workers
            }
            pile_q = await self.db.execute(
                select(JobPile.worker_id, Job.ups, func.coalesce(func.sum(JobPile.sheets), 0))
                .join(Job, Job.id == JobPile.job_id)
                .where(
                    JobPile.company_id == self.company_id,
                    Job.machine_id == machine.id,
                    JobPile.pile_out_at.is_not(None),
                    Job.ups.is_not(None),
                )
                .group_by(JobPile.worker_id, Job.ups)
            )
            for worker_id, ups_val, sheets_sum in pile_q.all():
                if worker_id not in sheet_map:
                    continue
                u = int(ups_val)
                if u not in sheet_map[worker_id]:
                    sheet_map[worker_id][u] = 0
                    if u not in ups_list:
                        ups_list.append(u)
                sheet_map[worker_id][u] = int(sheets_sum or 0)

            ups_list = sorted(set(ups_list))
            worker_rows = []
            for w in workers:
                by_ups = {str(u): sheet_map.get(w.id, {}).get(u, 0) for u in ups_list}
                worker_rows.append(
                    {
                        "worker_id": str(w.id),
                        "worker_name": w.name,
                        "by_ups": by_ups,
                    }
                )

            machine_ups_charts.append(
                {
                    "machine_id": str(machine.id),
                    "machine_number": machine.machine_number,
                    "machine_name": machine.name,
                    "ups_values": ups_list,
                    "workers": worker_rows,
                }
            )

        return CompanyDashboardOut(
            total_employees=int(emp.scalar_one()),
            total_accounts=int(acc.scalar_one()),
            total_machines=int(mach.scalar_one()),
            total_workers=int(wrk.scalar_one()),
            active_shift=await self.serialize_shift(open_shift),
            open_jobs=len(jobs),
            total_sheets=total,
            allocated_sheets=allocated,
            remaining_sheets=max(0, total - allocated),
            recent_activity=[],
            shift_worker_sheets=shift_worker_sheets,
            machine_ups_charts=machine_ups_charts,
        )

    async def employee_dashboard(self) -> EmployeeDashboardOut:
        open_shift = await self.shifts.get_current_open()
        on_count = off_count = 0
        if open_shift:
            on_q = await self.db.execute(
                select(func.count()).select_from(ShiftWorker).where(
                    ShiftWorker.shift_id == open_shift.id, ShiftWorker.duty_status == "on"
                )
            )
            on_count = int(on_q.scalar_one())
            workers = await MasterRepo(self.db, self.company_id).list_workers("active")
            off_count = max(0, len(workers) - on_count)

        # Machines running on the open shift (not all company machines)
        if open_shift:
            sm = await self.db.execute(
                select(func.count())
                .select_from(ShiftMachine)
                .where(ShiftMachine.shift_id == open_shift.id)
            )
            total_machines = int(sm.scalar_one())
        else:
            total_machines = 0

        jobs = await self.jobs.list_jobs(
            shift_id=open_shift.id if open_shift else None, status="open"
        )
        all_jobs = await self.jobs.list_jobs()
        stats_ids = list({j.id for j in jobs} | {j.id for j in all_jobs})
        allocated_map, _, _ = await self._pile_stats_by_job(stats_ids)

        total = sum(j.total_sheets for j in jobs)
        allocated = sum(allocated_map.get(j.id, 0) for j in jobs)

        previous_yellow: list[dict] = []
        yellow_jobs: list[Job] = []
        for j in all_jobs:
            if open_shift and j.shift_id == open_shift.id:
                continue
            if j.total_sheets <= 0:
                continue
            broken = allocated_map.get(j.id, 0)
            remaining = j.total_sheets - broken
            if remaining <= 0:
                continue
            yellow_jobs.append(j)
        if yellow_jobs:
            previous_yellow = await self.serialize_jobs(yellow_jobs)

        job_sheet_bars: list[dict] = []
        for j in jobs:
            broken = allocated_map.get(j.id, 0)
            label = (j.job_number or "").strip() or j.job_name
            job_sheet_bars.append(
                {
                    "job_id": str(j.id),
                    "job_number": label,
                    "job_name": j.job_name,
                    "total_sheets": j.total_sheets if j.total_sheets > 0 else 0,
                    "break_sheets": broken,
                }
            )

        # Workers with pile currently IN (not yet Out)
        workers_pile_in: list[dict] = []
        open_pile_q = (
            select(JobPile, Worker, Job)
            .join(Worker, Worker.id == JobPile.worker_id)
            .join(Job, Job.id == JobPile.job_id)
            .where(
                JobPile.company_id == self.company_id,
                JobPile.pile_out_at.is_(None),
            )
            .order_by(JobPile.pile_in_at.desc().nullslast(), Worker.name)
        )
        if open_shift:
            open_pile_q = open_pile_q.where(JobPile.shift_id == open_shift.id)
        open_pile_rows = (await self.db.execute(open_pile_q)).all()
        for pile, worker, job in open_pile_rows:
            machine_number = None
            machine_name = None
            if job.machine_id:
                machine = await self.db.get(Machine, job.machine_id)
                if machine:
                    machine_number = machine.machine_number
                    machine_name = machine.name
            workers_pile_in.append(
                {
                    "worker_id": str(worker.id),
                    "worker_name": worker.name,
                    "job_id": str(job.id),
                    "job_number": (job.job_number or "").strip() or None,
                    "job_name": job.job_name,
                    "sheets": pile.sheets,
                    "ups": job.ups,
                    "machine_number": machine_number,
                    "machine_name": machine_name,
                    "pile_in_at": pile.pile_in_at.isoformat() if pile.pile_in_at else None,
                }
            )

        return EmployeeDashboardOut(
            current_shift=await self.serialize_shift(open_shift),
            workers_on=on_count,
            workers_off=off_count,
            open_jobs=len(jobs),
            total_machines=total_machines,
            total_sheets=total,
            allocated_sheets=allocated,
            remaining_sheets=total - allocated if total > 0 else 0,
            previous_yellow_jobs=previous_yellow,
            workers_pile_in=workers_pile_in,
            machine_charts=[],
            job_sheet_bars=job_sheet_bars,
        )
