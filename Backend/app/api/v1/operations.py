from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.exceptions import AppError, envelope
from app.core.security import AuthContext, require_roles
from app.models.master import Employee, Machine, Worker
from app.models.operations import Job, JobPile, Shift
from app.repositories.master_repo import CompanyRepo
from app.schemas.common import CompanyOut, MachineOut, MachineReportJob, MachineReportOut
from app.schemas.operations import (
    DutyBulkUpdate,
    JobCreate,
    JobUpdate,
    PileCreate,
    PileOutRequest,
    PileSheetsUpdate,
    ShiftCreate,
    ShiftUpdate,
)
from app.services.ops_service import OpsService

router = APIRouter(tags=["operations"])


def _ops(
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
) -> OpsService:
    return OpsService(db, auth.company_id, auth.user_id)


@router.get("/companies/me")
async def company_me(
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    company = await CompanyRepo(db).get(auth.company_id)
    return envelope(data=CompanyOut.model_validate(company).model_dump(mode="json"))


@router.get("/shifts/current")
async def current_shift(service: OpsService = Depends(_ops)):
    shift = await service.current_shift()
    data = await service.serialize_shift(shift)
    return envelope(data=data.model_dump(mode="json") if data else None)


@router.get("/shifts")
async def list_shifts(
    status: str | None = Query(default=None),
    service: OpsService = Depends(_ops),
):
    rows = await service.shifts.list_shifts(status)
    out = []
    for row in rows:
        item = await service.serialize_shift(row)
        if item:
            out.append(item.model_dump(mode="json"))
    return envelope(data=out)


@router.post("/shifts", status_code=201)
async def create_shift(
    body: ShiftCreate,
    auth: AuthContext = Depends(require_roles("employee", "company")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    shift = await service.create_shift(body)
    data = await service.serialize_shift(shift)
    return envelope(data=data.model_dump(mode="json") if data else None)


@router.patch("/shifts/{shift_id}")
async def update_shift(
    shift_id: UUID,
    body: ShiftUpdate,
    auth: AuthContext = Depends(require_roles("employee", "company")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    shift = await service.update_shift(shift_id, body)
    data = await service.serialize_shift(shift)
    return envelope(data=data.model_dump(mode="json") if data else None)


@router.get("/shifts/{shift_id}")
async def get_shift(
    shift_id: UUID,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    shift = await service.shifts.get(shift_id)
    if not shift:
        raise AppError("NOT_FOUND", "Shift not found.", 404)
    data = await service.serialize_shift(shift)
    return envelope(data=data.model_dump(mode="json") if data else None)


@router.post("/shifts/{shift_id}/close")
async def close_shift(
    shift_id: UUID,
    auth: AuthContext = Depends(require_roles("employee", "company")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    shift = await service.close_shift(shift_id)
    data = await service.serialize_shift(shift)
    return envelope(data=data.model_dump(mode="json") if data else None)


@router.get("/floor/supervisors")
async def ensure_floor_supervisors(
    auth: AuthContext = Depends(require_roles("employee", "company")),
    db: AsyncSession = Depends(get_db),
):
    rows = await OpsService(db, auth.company_id, auth.user_id).ensure_floor_supervisors()
    from app.schemas.common import SupervisorOut

    return envelope(
        data=[SupervisorOut.model_validate(r).model_dump(mode="json") for r in rows]
    )


@router.get("/shifts/{shift_id}/workers")
async def list_duty(
    shift_id: UUID,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.operations import ShiftWorker

    result = await db.execute(
        select(ShiftWorker, Worker)
        .join(Worker, Worker.id == ShiftWorker.worker_id)
        .where(
            ShiftWorker.shift_id == shift_id,
            ShiftWorker.company_id == auth.company_id,
        )
    )
    rows = []
    for duty, worker in result.all():
        rows.append(
            {
                "id": str(duty.id),
                "worker_id": str(worker.id),
                "duty_status": duty.duty_status,
                "worker": {
                    "id": str(worker.id),
                    "name": worker.name,
                    "worker_code": worker.worker_code,
                    "status": worker.status,
                    "company_id": str(worker.company_id),
                },
            }
        )
    return envelope(data=rows)


@router.post("/shifts/{shift_id}/workers")
async def save_duty(
    shift_id: UUID,
    body: DutyBulkUpdate,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    result = await OpsService(db, auth.company_id, auth.user_id).save_duty(shift_id, body)
    return envelope(data=result)


@router.get("/jobs")
async def list_jobs(
    shift_id: UUID | None = None,
    machine_id: UUID | None = None,
    status: str | None = None,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    rows = await service.jobs.list_jobs(
        shift_id=shift_id, machine_id=machine_id, status=status
    )
    payload = [await service.serialize_job(job) for job in rows]
    return envelope(data=payload)


@router.post("/jobs", status_code=201)
async def create_job(
    body: JobCreate,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    job = await service.create_job(body)
    return envelope(data=await service.serialize_job(job))


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: UUID,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    job = await service.jobs.get(job_id)
    if not job:
        raise AppError("NOT_FOUND", "This job could not be found.", 404)
    return envelope(data=await service.serialize_job(job))


@router.patch("/jobs/{job_id}")
async def update_job(
    job_id: UUID,
    body: JobUpdate,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    job = await service.update_job(job_id, body)
    return envelope(data=await service.serialize_job(job))


@router.get("/jobs/{job_id}/piles")
async def list_job_piles(
    job_id: UUID,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    rows = await OpsService(db, auth.company_id, auth.user_id).list_job_piles(job_id)
    return envelope(data=rows)


@router.get("/jobs/{job_id}/worker-stats")
async def job_worker_stats(
    job_id: UUID,
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    rows = await OpsService(db, auth.company_id, auth.user_id).worker_pile_stats(job_id)
    return envelope(data=rows)


@router.post("/jobs/{job_id}/workers/{worker_id}/piles", status_code=201)
async def create_pile(
    job_id: UUID,
    worker_id: UUID,
    body: PileCreate,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    result = await service.create_pile(job_id, worker_id, body)
    pile = result["pile"]
    return envelope(
        data={
            "pile": service._serialize_pile(pile),
            "job_allocated_sheets": result["job_allocated_sheets"],
            "job_remaining_sheets": result["job_remaining_sheets"],
            "break_sheets": result["break_sheets"],
        }
    )


@router.post("/jobs/{job_id}/workers/{worker_id}/pile-out")
async def pile_out(
    job_id: UUID,
    worker_id: UUID,
    body: PileOutRequest = PileOutRequest(),
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    service = OpsService(db, auth.company_id, auth.user_id)
    result = await service.pile_out(
        job_id,
        worker_id,
        pile_out_at=body.pile_out_at,
    )
    pile = result["pile"]
    return envelope(
        data={
            "pile": service._serialize_pile(pile),
            "job_allocated_sheets": result["job_allocated_sheets"],
            "job_remaining_sheets": result["job_remaining_sheets"],
            "break_sheets": result["break_sheets"],
        }
    )


@router.post("/jobs/{job_id}/workers/{worker_id}/pile-cancel")
async def pile_cancel(
    job_id: UUID,
    worker_id: UUID,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    result = await OpsService(db, auth.company_id, auth.user_id).pile_cancel(
        job_id, worker_id
    )
    return envelope(data=result)


@router.patch("/jobs/{job_id}/piles/{pile_id}")
async def update_pile_sheets(
    job_id: UUID,
    pile_id: UUID,
    body: PileSheetsUpdate,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    data = await OpsService(db, auth.company_id, auth.user_id).update_pile_sheets(
        job_id, pile_id, body
    )
    return envelope(data=data)


@router.delete("/jobs/{job_id}/piles/{pile_id}", status_code=200)
async def delete_pile(
    job_id: UUID,
    pile_id: UUID,
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    await OpsService(db, auth.company_id, auth.user_id).delete_pile(job_id, pile_id)
    return envelope(data={"ok": True})


@router.get("/dashboard/company")
async def company_dashboard(
    auth: AuthContext = Depends(require_roles("company")),
    db: AsyncSession = Depends(get_db),
):
    data = await OpsService(db, auth.company_id, auth.user_id).company_dashboard()
    return envelope(data=data.model_dump(mode="json"))


@router.get("/dashboard/employee")
async def employee_dashboard(
    auth: AuthContext = Depends(require_roles("employee")),
    db: AsyncSession = Depends(get_db),
):
    data = await OpsService(db, auth.company_id, auth.user_id).employee_dashboard()
    return envelope(data=data.model_dump(mode="json"))


@router.get("/reports/machines")
async def machine_report(
    machine_id: UUID = Query(...),
    month: str | None = Query(default=None, description="YYYY-MM"),
    auth: AuthContext = Depends(require_roles("company")),
    db: AsyncSession = Depends(get_db),
):
    """Jobs for a machine in the selected month (defaults to current month)."""
    now = datetime.utcnow()
    if month:
        try:
            year_s, month_s = month.split("-")
            year, mon = int(year_s), int(month_s)
        except ValueError as exc:
            raise AppError("VALIDATION_ERROR", "Month must be YYYY-MM.", 400) from exc
    else:
        year, mon = now.year, now.month

    start = datetime(year, mon, 1)
    if mon == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, mon + 1, 1)

    machine = await db.execute(
        select(Machine).where(
            Machine.id == machine_id,
            Machine.company_id == auth.company_id,
        )
    )
    machine_row = machine.scalar_one_or_none()
    if not machine_row:
        raise AppError("NOT_FOUND", "Machine not found.", 404)

    jobs_result = await db.execute(
        select(Job, Shift)
        .outerjoin(Shift, Shift.id == Job.shift_id)
        .where(
            Job.company_id == auth.company_id,
            Job.machine_id == machine_id,
            Job.created_at >= start,
            Job.created_at < end,
        )
        .order_by(Shift.shift_date.asc(), Job.created_at.asc())
    )

    report_jobs: list[MachineReportJob] = []
    for job, shift in jobs_result.all():
        allocated = await db.execute(
            select(func.coalesce(func.sum(JobPile.sheets), 0)).where(
                JobPile.job_id == job.id,
                JobPile.pile_out_at.is_not(None),
            )
        )
        allocated_val = int(allocated.scalar_one())

        piles = await db.execute(
            select(
                Worker.name,
                Employee.full_name,
                func.sum(JobPile.sheets),
                func.count(JobPile.id),
            )
            .join(Worker, Worker.id == JobPile.worker_id)
            .outerjoin(Employee, Employee.id == Worker.employee_id)
            .where(
                JobPile.job_id == job.id,
                JobPile.pile_out_at.is_not(None),
            )
            .group_by(Worker.name, Employee.full_name)
        )
        employees = []
        for worker_name, emp_name, sheets_sum, pile_count in piles.all():
            employees.append(
                {
                    "name": emp_name or worker_name,
                    "sheets": int(sheets_sum or 0),
                    "pile_count": int(pile_count or 0),
                }
            )

        if job.total_sheets > 0:
            remaining = job.total_sheets - allocated_val
        else:
            remaining = 0

        report_jobs.append(
            MachineReportJob(
                id=job.id,
                job_number=job.job_number,
                job_name=job.job_name,
                total_sheets=job.total_sheets,
                allocated_sheets=allocated_val,
                remaining_sheets=remaining,
                status=job.status,
                dabbi=bool(job.dabbi),
                ups=job.ups,
                shift_id=job.shift_id,
                shift_name=shift.name if shift else None,
                shift_date=shift.shift_date if shift else None,
                created_at=job.created_at,
                employees=employees,
            )
        )

    # Ascending by date (shift date, else created_at)
    report_jobs.sort(
        key=lambda j: (
            j.shift_date.isoformat()
            if j.shift_date
            else (j.created_at.date().isoformat() if j.created_at else "9999-99-99"),
            j.created_at.isoformat() if j.created_at else "",
        )
    )

    out = MachineReportOut(
        machine=MachineOut.model_validate(machine_row),
        month=f"{year:04d}-{mon:02d}",
        jobs=report_jobs,
    )
    return envelope(data=out.model_dump(mode="json"))
