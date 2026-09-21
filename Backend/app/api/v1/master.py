from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.exceptions import envelope
from app.core.security import AuthContext, require_roles
from app.schemas.common import (
    AccountCreate,
    AccountOut,
    AccountUpdate,
    EmployeeCreate,
    EmployeeOut,
    EmployeeUpdate,
    MachineCreate,
    MachineOut,
    MachineUpdate,
    SupervisorOut,
    WorkerOut,
)
from app.services.company_master_service import CompanyMasterService
from app.repositories.master_repo import MasterRepo

router = APIRouter(tags=["master"])


def _company(
    auth: AuthContext = Depends(require_roles("company")),
    db: AsyncSession = Depends(get_db),
) -> CompanyMasterService:
    return CompanyMasterService(db, auth.company_id, auth.user_id)


@router.get("/accounts")
async def list_accounts(service: CompanyMasterService = Depends(_company)):
    rows = await service.list_accounts()
    return envelope(data=[AccountOut.model_validate(r).model_dump(mode="json") for r in rows])


@router.post("/accounts", status_code=201)
async def create_account(
    body: AccountCreate, service: CompanyMasterService = Depends(_company)
):
    row = await service.create_account(body)
    return envelope(data=AccountOut.model_validate(row).model_dump(mode="json"))


@router.patch("/accounts/{account_id}")
async def update_account(
    account_id: UUID,
    body: AccountUpdate,
    service: CompanyMasterService = Depends(_company),
):
    row = await service.update_account(account_id, body)
    return envelope(data=AccountOut.model_validate(row).model_dump(mode="json"))


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: UUID, service: CompanyMasterService = Depends(_company)
):
    await service.delete_account(account_id)
    return envelope(data={"deleted": True})


@router.get("/employees")
async def list_employees(service: CompanyMasterService = Depends(_company)):
    rows = await service.list_employees()
    return envelope(data=[EmployeeOut.model_validate(r).model_dump(mode="json") for r in rows])


@router.post("/employees", status_code=201)
async def create_employee(
    body: EmployeeCreate, service: CompanyMasterService = Depends(_company)
):
    row = await service.create_employee(body)
    return envelope(data=EmployeeOut.model_validate(row).model_dump(mode="json"))


@router.patch("/employees/{employee_id}")
async def update_employee(
    employee_id: UUID,
    body: EmployeeUpdate,
    service: CompanyMasterService = Depends(_company),
):
    row = await service.update_employee(employee_id, body)
    return envelope(data=EmployeeOut.model_validate(row).model_dump(mode="json"))


@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: UUID, service: CompanyMasterService = Depends(_company)
):
    await service.delete_employee(employee_id)
    return envelope(data={"deleted": True})


@router.get("/machines")
async def list_machines(
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    rows = await CompanyMasterService(db, auth.company_id, auth.user_id).list_machines()
    return envelope(data=[MachineOut.model_validate(r).model_dump(mode="json") for r in rows])


@router.post("/machines", status_code=201)
async def create_machine(
    body: MachineCreate, service: CompanyMasterService = Depends(_company)
):
    row = await service.create_machine(body)
    return envelope(data=MachineOut.model_validate(row).model_dump(mode="json"))


@router.patch("/machines/{machine_id}")
async def update_machine(
    machine_id: UUID,
    body: MachineUpdate,
    service: CompanyMasterService = Depends(_company),
):
    row = await service.update_machine(machine_id, body)
    return envelope(data=MachineOut.model_validate(row).model_dump(mode="json"))


@router.delete("/machines/{machine_id}")
async def delete_machine(
    machine_id: UUID, service: CompanyMasterService = Depends(_company)
):
    await service.delete_machine(machine_id)
    return envelope(data={"deleted": True})


@router.get("/workers")
async def list_workers(
    status: str | None = Query(default="active"),
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    rows = await MasterRepo(db, auth.company_id).list_workers(status)
    return envelope(data=[WorkerOut.model_validate(r).model_dump(mode="json") for r in rows])


@router.get("/supervisors")
async def list_supervisors(
    status: str | None = Query(default="active"),
    auth: AuthContext = Depends(require_roles("company", "employee")),
    db: AsyncSession = Depends(get_db),
):
    rows = await MasterRepo(db, auth.company_id).list_supervisors(status)
    return envelope(
        data=[SupervisorOut.model_validate(r).model_dump(mode="json") for r in rows]
    )
