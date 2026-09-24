from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import MachineOut, OrmModel


class ShiftCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)  # "A" or "B"
    shift_date: date
    start_time: datetime
    end_time: datetime
    supervisor_id: UUID
    machine_ids: list[UUID] = []
    shift_template_id: UUID | None = None


class ShiftUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    shift_date: date | None = None
    start_time: datetime
    end_time: datetime
    supervisor_id: UUID | None = None
    machine_ids: list[UUID] | None = None


class ShiftOut(OrmModel):
    id: UUID
    company_id: UUID
    name: str
    shift_date: date
    start_time: datetime
    end_time: datetime
    original_start_time: datetime | None = None
    original_end_time: datetime | None = None
    supervisor_id: UUID | None
    supervisor_name: str | None = None
    status: str
    closed_at: datetime | None
    machines: list[MachineOut] = []
    opened_at: datetime | None = None


class DutyItem(BaseModel):
    worker_id: UUID
    duty_status: str = Field(pattern="^(on|off)$")


class DutyBulkUpdate(BaseModel):
    workers: list[DutyItem]


class JobCreate(BaseModel):
    job_name: str = Field(min_length=1, max_length=120)
    machine_id: UUID
    shift_id: UUID | None = None
    job_number: str | None = Field(default=None, max_length=60)
    total_sheets: int | None = Field(default=None, ge=0)
    dabbi: bool
    ups: int = Field(ge=0)


class JobDuplicate(BaseModel):
    shift_id: UUID


class JobUpdate(BaseModel):
    job_name: str = Field(min_length=1, max_length=120)
    machine_id: UUID
    job_number: str | None = Field(default=None, max_length=60)
    total_sheets: int | None = Field(default=None, ge=0)
    dabbi: bool
    ups: int = Field(ge=0)


class JobOut(OrmModel):
    id: UUID
    company_id: UUID
    shift_id: UUID
    machine_id: UUID | None = None
    job_number: str | None = None
    job_name: str
    total_sheets: int
    dabbi: bool
    ups: int | None
    status: str
    allocated_sheets: int | None = None
    remaining_sheets: int | None = None
    break_sheets: int | None = None
    open_pile_count: int | None = None
    completed_pile_count: int | None = None
    shift_name: str | None = None
    shift_date: date | None = None
    machine_number: str | None = None
    machine_name: str | None = None
    created_at: datetime | None = None


class PileCreate(BaseModel):
    sheets: int = Field(gt=0)
    is_custom: bool = True
    sheet_option_id: UUID | None = None
    # If True, only pile_in is set (Out comes later)
    open_only: bool = False
    pile_in_at: datetime | None = None
    pile_out_at: datetime | None = None


class PileSheetsUpdate(BaseModel):
    sheets: int = Field(gt=0)


class PileOutRequest(BaseModel):
    pile_out_at: datetime | None = None


class PileOut(OrmModel):
    id: UUID
    job_id: UUID
    worker_id: UUID
    shift_id: UUID
    sheets: int
    is_custom: bool
    pile_in_at: datetime | None = None
    pile_out_at: datetime | None = None
    created_at: datetime
    series_no: int | None = None
    worker_name: str | None = None
    total_seconds: int | None = None


class CompanyDashboardOut(BaseModel):
    total_employees: int
    total_accounts: int
    total_machines: int
    total_workers: int = 0
    active_shift: ShiftOut | None
    open_jobs: int
    total_sheets: int
    allocated_sheets: int
    remaining_sheets: int
    recent_activity: list[dict] = []
    shift_worker_sheets: list[dict] = []
    machine_ups_charts: list[dict] = []


class EmployeeDashboardOut(BaseModel):
    current_shift: ShiftOut | None
    workers_on: int
    workers_off: int
    open_jobs: int
    total_machines: int
    total_sheets: int = 0
    allocated_sheets: int = 0
    remaining_sheets: int = 0
    previous_yellow_jobs: list[dict] = []
    workers_pile_in: list[dict] = []
    machine_charts: list[dict] = []
    job_sheet_bars: list[dict] = []
