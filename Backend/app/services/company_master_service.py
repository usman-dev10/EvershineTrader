from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.passwords import hash_password
from app.models.master import Employee, LoginAccount, Machine, Supervisor, Worker
from app.models.profile import Profile
from app.schemas.common import (
    AccountCreate,
    AccountUpdate,
    EmployeeCreate,
    EmployeeUpdate,
    MachineCreate,
    MachineUpdate,
)


class CompanyMasterService:
    def __init__(self, db: AsyncSession, company_id: UUID, actor_id: UUID):
        self.db = db
        self.company_id = company_id
        self.actor_id = actor_id

    # ---- Login accounts (Create Account) ----
    async def list_accounts(self) -> list[LoginAccount]:
        result = await self.db.execute(
            select(LoginAccount)
            .where(LoginAccount.company_id == self.company_id)
            .order_by(LoginAccount.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_account(self, payload: AccountCreate) -> LoginAccount:
        profile_id = uuid4()
        profile = Profile(
            id=profile_id,
            company_id=self.company_id,
            role="employee",
            employee_id=None,
        )
        account = LoginAccount(
            company_id=self.company_id,
            phone=payload.phone,
            password_hash=hash_password(payload.password),
            role="employee",
            profile_id=profile_id,
            created_by=self.actor_id,
        )
        self.db.add(profile)
        self.db.add(account)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError("DUPLICATE", "This phone number already has an account.", 409) from exc
        await self.db.refresh(account)
        return account

    async def delete_account(self, account_id: UUID) -> None:
        result = await self.db.execute(
            select(LoginAccount).where(
                LoginAccount.id == account_id,
                LoginAccount.company_id == self.company_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise AppError("NOT_FOUND", "Account not found.", 404)
        profile = await self.db.get(Profile, account.profile_id)
        await self.db.delete(account)
        if profile and profile.role == "employee":
            await self.db.delete(profile)
        await self.db.commit()

    async def update_account(self, account_id: UUID, payload: AccountUpdate) -> LoginAccount:
        result = await self.db.execute(
            select(LoginAccount).where(
                LoginAccount.id == account_id,
                LoginAccount.company_id == self.company_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            raise AppError("NOT_FOUND", "Account not found.", 404)
        account.phone = payload.phone
        if payload.password:
            account.password_hash = hash_password(payload.password)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError("DUPLICATE", "This phone number already has an account.", 409) from exc
        await self.db.refresh(account)
        return account

    # ---- Floor employees ----
    async def list_employees(self) -> list[Employee]:
        result = await self.db.execute(
            select(Employee)
            .where(Employee.company_id == self.company_id)
            .order_by(Employee.full_name)
        )
        return list(result.scalars().all())

    async def create_employee(self, payload: EmployeeCreate) -> Employee:
        if not payload.is_worker and not payload.is_supervisor:
            raise AppError(
                "VALIDATION_ERROR",
                "Select at least one role: Worker or Supervisor.",
                400,
            )
        employee = Employee(
            company_id=self.company_id,
            full_name=payload.full_name.strip(),
            father_name=payload.father_name.strip(),
            cnic=payload.cnic,
            phone=payload.phone,
            position=payload.position,
            salary=payload.salary,
            is_worker=payload.is_worker,
            is_supervisor=payload.is_supervisor,
            joining_date=payload.joining_date,
            created_by=self.actor_id,
        )
        self.db.add(employee)
        try:
            await self.db.flush()
            await self._sync_roles(employee)
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError(
                "DUPLICATE",
                "Employee CNIC or phone already exists.",
                409,
            ) from exc
        await self.db.refresh(employee)
        return employee

    async def delete_employee(self, employee_id: UUID) -> None:
        result = await self.db.execute(
            select(Employee).where(
                Employee.id == employee_id,
                Employee.company_id == self.company_id,
            )
        )
        employee = result.scalar_one_or_none()
        if not employee:
            raise AppError("NOT_FOUND", "Employee not found.", 404)

        # Soft-remove synced worker/supervisor rows
        workers = await self.db.execute(
            select(Worker).where(Worker.employee_id == employee.id)
        )
        for w in workers.scalars().all():
            w.status = "inactive"
        supers = await self.db.execute(
            select(Supervisor).where(Supervisor.employee_id == employee.id)
        )
        for s in supers.scalars().all():
            s.status = "inactive"

        await self.db.delete(employee)
        await self.db.commit()

    async def update_employee(
        self, employee_id: UUID, payload: EmployeeUpdate
    ) -> Employee:
        if not payload.is_worker and not payload.is_supervisor:
            raise AppError(
                "VALIDATION_ERROR",
                "Select at least one role: Worker or Supervisor.",
                400,
            )
        result = await self.db.execute(
            select(Employee).where(
                Employee.id == employee_id,
                Employee.company_id == self.company_id,
            )
        )
        employee = result.scalar_one_or_none()
        if not employee:
            raise AppError("NOT_FOUND", "Employee not found.", 404)

        employee.full_name = payload.full_name.strip()
        employee.father_name = payload.father_name.strip()
        employee.cnic = payload.cnic
        employee.phone = payload.phone
        employee.position = payload.position
        employee.salary = payload.salary
        employee.is_worker = payload.is_worker
        employee.is_supervisor = payload.is_supervisor
        employee.joining_date = payload.joining_date

        try:
            await self.db.flush()
            await self._sync_roles(employee)
            # Deactivate roles that were unchecked
            if not employee.is_worker:
                workers = await self.db.execute(
                    select(Worker).where(Worker.employee_id == employee.id)
                )
                for w in workers.scalars().all():
                    w.status = "inactive"
            if not employee.is_supervisor:
                supers = await self.db.execute(
                    select(Supervisor).where(Supervisor.employee_id == employee.id)
                )
                for s in supers.scalars().all():
                    s.status = "inactive"
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError(
                "DUPLICATE",
                "Employee CNIC or phone already exists.",
                409,
            ) from exc
        await self.db.refresh(employee)
        return employee

    async def _sync_roles(self, employee: Employee) -> None:
        if employee.is_worker:
            existing = await self.db.execute(
                select(Worker).where(Worker.employee_id == employee.id)
            )
            worker = existing.scalar_one_or_none()
            code = employee.cnic.replace("-", "")
            if worker:
                worker.name = employee.full_name
                worker.worker_code = code
                worker.status = "active"
            else:
                self.db.add(
                    Worker(
                        company_id=self.company_id,
                        employee_id=employee.id,
                        name=employee.full_name,
                        worker_code=code,
                        status="active",
                        created_by=self.actor_id,
                    )
                )
        if employee.is_supervisor:
            existing = await self.db.execute(
                select(Supervisor).where(Supervisor.employee_id == employee.id)
            )
            supervisor = existing.scalar_one_or_none()
            if supervisor:
                supervisor.name = employee.full_name
                supervisor.staff_code = employee.phone
                supervisor.status = "active"
            else:
                self.db.add(
                    Supervisor(
                        company_id=self.company_id,
                        employee_id=employee.id,
                        name=employee.full_name,
                        staff_code=employee.phone,
                        status="active",
                        created_by=self.actor_id,
                    )
                )

    # ---- Machines ----
    async def list_machines(self) -> list[Machine]:
        result = await self.db.execute(
            select(Machine)
            .where(Machine.company_id == self.company_id)
            .order_by(Machine.machine_number, Machine.name)
        )
        return list(result.scalars().all())

    async def _assert_machine_pair_unique(
        self,
        machine_number: str,
        name: str,
        *,
        exclude_id: UUID | None = None,
    ) -> None:
        stmt = select(Machine).where(
            Machine.company_id == self.company_id,
            Machine.machine_number == machine_number,
            Machine.name == name,
        )
        if exclude_id is not None:
            stmt = stmt.where(Machine.id != exclude_id)
        existing = await self.db.execute(stmt)
        if existing.scalar_one_or_none():
            raise AppError(
                "DUPLICATE",
                "A machine with this number and name already exists.",
                409,
            )

    async def create_machine(self, payload: MachineCreate) -> Machine:
        number = payload.machine_number.strip()
        name = payload.name.strip()
        await self._assert_machine_pair_unique(number, name)
        row = Machine(
            company_id=self.company_id,
            machine_number=number,
            name=name,
            status="active",
            created_by=self.actor_id,
        )
        self.db.add(row)
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError(
                "DUPLICATE",
                "A machine with this number and name already exists.",
                409,
            ) from exc
        await self.db.refresh(row)
        return row

    async def delete_machine(self, machine_id: UUID) -> None:
        result = await self.db.execute(
            select(Machine).where(
                Machine.id == machine_id,
                Machine.company_id == self.company_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise AppError("NOT_FOUND", "Machine not found.", 404)
        await self.db.delete(row)
        await self.db.commit()

    async def update_machine(self, machine_id: UUID, payload: MachineUpdate) -> Machine:
        result = await self.db.execute(
            select(Machine).where(
                Machine.id == machine_id,
                Machine.company_id == self.company_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            raise AppError("NOT_FOUND", "Machine not found.", 404)
        number = payload.machine_number.strip()
        name = payload.name.strip()
        await self._assert_machine_pair_unique(number, name, exclude_id=machine_id)
        row.machine_number = number
        row.name = name
        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise AppError(
                "DUPLICATE",
                "A machine with this number and name already exists.",
                409,
            ) from exc
        await self.db.refresh(row)
        return row
