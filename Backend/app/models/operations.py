import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ShiftTemplate(Base):
    __tablename__ = "shift_templates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    default_start_time: Mapped[str | None] = mapped_column(Text)
    default_end_time: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    shift_template_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    original_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    original_end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    closed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ShiftMachine(Base):
    """Machines selected to run during a shift."""

    __tablename__ = "shift_machines"
    __table_args__ = (UniqueConstraint("shift_id", "machine_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    shift_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("shifts.id"))
    machine_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("machines.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ShiftWorker(Base):
    __tablename__ = "shift_workers"
    __table_args__ = (UniqueConstraint("shift_id", "worker_id"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    shift_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("shifts.id"))
    worker_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("workers.id"))
    duty_status: Mapped[str] = mapped_column(String(10), default="off")
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    shift_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("shifts.id"))
    machine_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("machines.id"), nullable=True
    )
    job_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_name: Mapped[str] = mapped_column(Text, nullable=False)
    total_sheets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dabbi: Mapped[bool] = mapped_column(Boolean, default=False)
    ups: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JobPile(Base):
    __tablename__ = "job_piles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("companies.id"))
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("jobs.id"))
    worker_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("workers.id"))
    shift_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), ForeignKey("shifts.id"))
    sheets: Mapped[int] = mapped_column(Integer, nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    sheet_option_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    pile_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pile_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
