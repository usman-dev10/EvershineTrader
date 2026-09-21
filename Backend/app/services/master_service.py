from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.repositories.master_repo import MasterRepo
from app.schemas.common import (
    EmployeeCreate,
    MachineCreate,
    SheetOptionCreate,
    ShiftTemplateCreate,
    SupervisorCreate,
    WorkerCreate,
)


class MasterService:
    def __init__(self, db: AsyncSession, company_id: UUID, actor_id: UUID):
        self.repo = MasterRepo(db, company_id)
        self.actor_id = actor_id

    def _dup(self, message: str, exc: Exception) -> AppError:
        return AppError("DUPLICATE", message, 409)

    async def list_workers(self, status: str | None = None):
        return await self.repo.list_workers(status)

    async def create_worker(self, payload: WorkerCreate):
        try:
            return await self.repo.create_worker(
                name=payload.name.strip(),
                worker_code=payload.worker_code.strip(),
                created_by=self.actor_id,
            )
        except IntegrityError as exc:
            raise self._dup("Worker code already exists.", exc) from exc

    async def set_worker_status(self, worker_id: UUID, status: str):
        row = await self.repo.set_worker_status(worker_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Worker not found.", 404)
        return row

    async def list_machines(self, status: str | None = None):
        return await self.repo.list_machines(status)

    async def create_machine(self, payload: MachineCreate):
        try:
            return await self.repo.create_machine(
                name=payload.name.strip(), created_by=self.actor_id
            )
        except IntegrityError as exc:
            raise self._dup("Machine name already exists.", exc) from exc

    async def set_machine_status(self, machine_id: UUID, status: str):
        row = await self.repo.set_machine_status(machine_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Machine not found.", 404)
        return row

    async def list_sheet_options(self, status: str | None = None):
        return await self.repo.list_sheet_options(status)

    async def create_sheet_option(self, payload: SheetOptionCreate):
        try:
            return await self.repo.create_sheet_option(payload.quantity)
        except IntegrityError as exc:
            raise self._dup("Sheet quantity already exists.", exc) from exc

    async def set_sheet_option_status(self, option_id: UUID, status: str):
        row = await self.repo.set_sheet_option_status(option_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Sheet option not found.", 404)
        return row

    async def list_supervisors(self, status: str | None = None):
        return await self.repo.list_supervisors(status)

    async def create_supervisor(self, payload: SupervisorCreate):
        return await self.repo.create_supervisor(
            name=payload.name.strip(),
            staff_code=(payload.staff_code or None),
            created_by=self.actor_id,
        )

    async def set_supervisor_status(self, supervisor_id: UUID, status: str):
        row = await self.repo.set_supervisor_status(supervisor_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Supervisor not found.", 404)
        return row

    async def list_employees(self, status: str | None = None):
        return await self.repo.list_employees(status)

    async def create_employee(self, payload: EmployeeCreate):
        try:
            return await self.repo.create_employee(
                full_name=payload.full_name.strip(),
                email=str(payload.email).lower().strip(),
                employee_code=payload.employee_code.strip(),
                phone=payload.phone or None,
                role_permission=payload.role_permission or "standard",
                created_by=self.actor_id,
            )
        except IntegrityError as exc:
            raise self._dup("Employee email or code already exists.", exc) from exc

    async def set_employee_status(self, employee_id: UUID, status: str):
        row = await self.repo.set_employee_status(employee_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Employee not found.", 404)
        return row

    async def list_shift_templates(self, status: str | None = None):
        return await self.repo.list_shift_templates(status)

    async def create_shift_template(self, payload: ShiftTemplateCreate):
        return await self.repo.create_shift_template(
            name=payload.name.strip(),
            default_start_time=payload.default_start_time,
            default_end_time=payload.default_end_time,
        )

    async def set_shift_template_status(self, template_id: UUID, status: str):
        row = await self.repo.set_shift_template_status(template_id, status)
        if not row:
            raise AppError("NOT_FOUND", "Shift template not found.", 404)
        return row
