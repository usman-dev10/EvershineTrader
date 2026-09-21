from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
import re


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


CNIC_RE = re.compile(r"^\d{5}-\d{7}-\d{1}$")
PHONE_RE = re.compile(r"^03\d{9}$")


def normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value.strip())
    if digits.startswith("92") and len(digits) == 12:
        digits = "0" + digits[2:]
    return digits


class LoginRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=20)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        phone = normalize_phone(v)
        if not PHONE_RE.match(phone):
            raise ValueError("Enter a valid Pakistani mobile number (03XXXXXXXXX).")
        return phone


class ProfileOut(OrmModel):
    id: UUID
    company_id: UUID
    role: str
    employee_id: UUID | None = None
    created_at: datetime | None = None


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    profile: ProfileOut
    session: SessionOut


class CompanyOut(OrmModel):
    id: UUID
    name: str
    email: str
    created_at: datetime | None = None


class AccountCreate(BaseModel):
    phone: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        phone = normalize_phone(v)
        if not PHONE_RE.match(phone):
            raise ValueError("Enter a valid Pakistani mobile number (03XXXXXXXXX).")
        return phone


class AccountUpdate(BaseModel):
    phone: str
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        phone = normalize_phone(v)
        if not PHONE_RE.match(phone):
            raise ValueError("Enter a valid Pakistani mobile number (03XXXXXXXXX).")
        return phone


class AccountOut(OrmModel):
    id: UUID
    company_id: UUID
    phone: str
    role: str
    created_at: datetime | None = None


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    father_name: str = Field(min_length=2, max_length=120)
    cnic: str
    phone: str
    position: str = Field(pattern="^(Contract|Salary)$")
    salary: int = Field(ge=0)
    is_worker: bool = False
    is_supervisor: bool = False
    joining_date: date

    @field_validator("cnic")
    @classmethod
    def cnic_ok(cls, v: str) -> str:
        value = v.strip()
        if not CNIC_RE.match(value):
            raise ValueError("CNIC must be in format 12345-1234567-1.")
        return value

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v: str) -> str:
        phone = normalize_phone(v)
        if not PHONE_RE.match(phone):
            raise ValueError("Enter a valid Pakistani mobile number (03XXXXXXXXX).")
        return phone


class EmployeeUpdate(EmployeeCreate):
    pass


class EmployeeOut(OrmModel):
    id: UUID
    company_id: UUID
    full_name: str
    father_name: str
    cnic: str
    phone: str
    position: str
    salary: int = 0
    is_worker: bool
    is_supervisor: bool
    joining_date: date


class MachineCreate(BaseModel):
    machine_number: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=80)


class MachineUpdate(MachineCreate):
    pass


class MachineOut(OrmModel):
    id: UUID
    company_id: UUID
    machine_number: str
    name: str
    status: str


class WorkerOut(OrmModel):
    id: UUID
    company_id: UUID
    name: str
    worker_code: str
    status: str


class SupervisorOut(OrmModel):
    id: UUID
    company_id: UUID
    name: str
    staff_code: str | None
    status: str


class SheetOptionCreate(BaseModel):
    quantity: int = Field(gt=0)


class SheetOptionOut(OrmModel):
    id: UUID
    company_id: UUID
    quantity: int
    status: str


class MachineReportJob(BaseModel):
    id: UUID
    job_number: str | None = None
    job_name: str
    total_sheets: int
    allocated_sheets: int
    remaining_sheets: int
    status: str
    dabbi: bool = False
    ups: int | None = None
    shift_id: UUID | None = None
    shift_name: str | None = None
    shift_date: date | None = None
    created_at: datetime | None = None
    employees: list[dict]


class MachineReportOut(BaseModel):
    machine: MachineOut
    month: str
    jobs: list[MachineReportJob]
