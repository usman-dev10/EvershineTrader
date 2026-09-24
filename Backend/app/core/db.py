from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _build_engine():
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL must be a Postgres/Supabase URL "
            "(postgresql+asyncpg://...)."
        )
    return create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


settings = get_settings()
engine = _build_engine()
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _migrate_sqlite_machines(conn) -> None:
    cols = (await conn.execute(text("PRAGMA table_info(machines)"))).fetchall()
    if not cols:
        return

    col_names = {row[1] for row in cols}
    if "machine_number" not in col_names:
        await conn.execute(
            text(
                "ALTER TABLE machines ADD COLUMN machine_number TEXT NOT NULL DEFAULT ''"
            )
        )
        await conn.execute(
            text(
                """
                UPDATE machines
                SET machine_number = 'M-' || CAST(rowid AS TEXT)
                WHERE machine_number IS NULL OR machine_number = ''
                """
            )
        )

    indexes = (await conn.execute(text("PRAGMA index_list(machines)"))).fetchall()
    has_pair_unique = False
    stale_unique = False
    for idx in indexes:
        idx_name = idx[1]
        is_unique = bool(idx[2])
        if not is_unique or not idx_name:
            continue
        if idx_name == "uq_machines_company_number_name":
            has_pair_unique = True
            continue
        info = (
            await conn.execute(text(f'PRAGMA index_info("{idx_name}")'))
        ).fetchall()
        indexed_cols = {row[2] for row in info}
        if indexed_cols in (
            {"company_id", "name"},
            {"company_id", "machine_number"},
        ):
            stale_unique = True
            try:
                await conn.execute(text(f'DROP INDEX IF EXISTS "{idx_name}"'))
            except Exception:
                stale_unique = True

    # Table-level UNIQUE (sqlite_autoindex_*) cannot always be dropped — rebuild
    indexes_after = (
        await conn.execute(text("PRAGMA index_list(machines)"))
    ).fetchall()
    for idx in indexes_after:
        idx_name = idx[1]
        if not bool(idx[2]) or not idx_name:
            continue
        if idx_name == "uq_machines_company_number_name":
            has_pair_unique = True
            continue
        info = (
            await conn.execute(text(f'PRAGMA index_info("{idx_name}")'))
        ).fetchall()
        indexed_cols = {row[2] for row in info}
        if indexed_cols in (
            {"company_id", "name"},
            {"company_id", "machine_number"},
        ):
            stale_unique = True

    if stale_unique:
        await conn.execute(text("PRAGMA foreign_keys=OFF"))
        await conn.execute(
            text(
                """
                CREATE TABLE machines_migrated (
                    id CHAR(32) NOT NULL,
                    company_id CHAR(32) NOT NULL,
                    machine_number TEXT NOT NULL,
                    name TEXT NOT NULL,
                    status VARCHAR(20),
                    created_by CHAR(32),
                    created_at DATETIME,
                    updated_at DATETIME,
                    PRIMARY KEY (id)
                )
                """
            )
        )
        await conn.execute(
            text(
                """
                INSERT INTO machines_migrated
                    (id, company_id, machine_number, name, status, created_by, created_at, updated_at)
                SELECT
                    id, company_id,
                    CASE
                        WHEN machine_number IS NULL OR machine_number = ''
                        THEN 'M-' || CAST(rowid AS TEXT)
                        ELSE machine_number
                    END,
                    name, status, created_by, created_at, updated_at
                FROM machines
                """
            )
        )
        await conn.execute(text("DROP TABLE machines"))
        await conn.execute(
            text("ALTER TABLE machines_migrated RENAME TO machines")
        )
        await conn.execute(text("PRAGMA foreign_keys=ON"))
        has_pair_unique = False

    if not has_pair_unique:
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_machines_company_number_name
                ON machines (company_id, machine_number, name)
                """
            )
        )


async def init_db() -> None:
    """Create missing tables on Postgres/Supabase."""
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift_per_company
                ON shifts (company_id)
                WHERE status = 'open'
                """
            )
        )
        await conn.execute(text("DROP INDEX IF EXISTS uq_jobs_company_job_number"))
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_shift_job_number
                ON jobs (company_id, shift_id, job_number)
                WHERE job_number IS NOT NULL AND btrim(job_number) <> ''
                """
            )
        )


async def _migrate_sqlite_shifts(conn) -> None:
    cols = (await conn.execute(text("PRAGMA table_info(shifts)"))).fetchall()
    if not cols:
        return
    col_names = {row[1] for row in cols}
    if "original_start_time" not in col_names:
        await conn.execute(
            text("ALTER TABLE shifts ADD COLUMN original_start_time DATETIME")
        )
        await conn.execute(
            text(
                "UPDATE shifts SET original_start_time = start_time WHERE original_start_time IS NULL"
            )
        )
    if "original_end_time" not in col_names:
        await conn.execute(
            text("ALTER TABLE shifts ADD COLUMN original_end_time DATETIME")
        )
        await conn.execute(
            text(
                "UPDATE shifts SET original_end_time = end_time WHERE original_end_time IS NULL"
            )
        )


async def _migrate_sqlite_jobs_piles(conn) -> None:
    job_cols = (await conn.execute(text("PRAGMA table_info(jobs)"))).fetchall()
    if job_cols:
        machine_col = next((row for row in job_cols if row[1] == "machine_id"), None)
        # row: cid, name, type, notnull, dflt_value, pk
        if machine_col and int(machine_col[3]) == 1:
            await conn.execute(text("PRAGMA foreign_keys=OFF"))
            await conn.execute(
                text(
                    """
                    CREATE TABLE jobs_migrated (
                        id CHAR(32) NOT NULL PRIMARY KEY,
                        company_id CHAR(32) NOT NULL,
                        shift_id CHAR(32) NOT NULL,
                        machine_id CHAR(32),
                        job_number TEXT NOT NULL,
                        job_name TEXT NOT NULL,
                        total_sheets INTEGER NOT NULL DEFAULT 0,
                        dabbi BOOLEAN,
                        ups INTEGER,
                        status VARCHAR(20),
                        created_by CHAR(32),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    INSERT INTO jobs_migrated
                    (id, company_id, shift_id, machine_id, job_number, job_name,
                     total_sheets, dabbi, ups, status, created_by, created_at, updated_at)
                    SELECT
                        id, company_id, shift_id, machine_id, job_number, job_name,
                        total_sheets, dabbi, ups, status, created_by, created_at, updated_at
                    FROM jobs
                    """
                )
            )
            await conn.execute(text("DROP TABLE jobs"))
            await conn.execute(text("ALTER TABLE jobs_migrated RENAME TO jobs"))
            await conn.execute(
                text(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_company_job_number
                    ON jobs (company_id, job_number)
                    """
                )
            )
            await conn.execute(text("PRAGMA foreign_keys=ON"))

    pile_cols = (await conn.execute(text("PRAGMA table_info(job_piles)"))).fetchall()
    if not pile_cols:
        return
    col_names = {row[1] for row in pile_cols}
    if "pile_in_at" not in col_names:
        await conn.execute(text("ALTER TABLE job_piles ADD COLUMN pile_in_at DATETIME"))
        await conn.execute(
            text(
                "UPDATE job_piles SET pile_in_at = created_at WHERE pile_in_at IS NULL"
            )
        )
    if "pile_out_at" not in col_names:
        await conn.execute(text("ALTER TABLE job_piles ADD COLUMN pile_out_at DATETIME"))
        await conn.execute(
            text(
                "UPDATE job_piles SET pile_out_at = created_at WHERE pile_out_at IS NULL"
            )
        )

    emp_cols = (await conn.execute(text("PRAGMA table_info(employees)"))).fetchall()
    if emp_cols:
        emp_names = {row[1] for row in emp_cols}
        if "salary" not in emp_names:
            await conn.execute(
                text("ALTER TABLE employees ADD COLUMN salary INTEGER NOT NULL DEFAULT 0")
            )

    # Allow blank job numbers (nullable) and remove unique(company_id, job_number)
    job_cols = (await conn.execute(text("PRAGMA table_info(jobs)"))).fetchall()
    if job_cols:
        job_number_col = next((row for row in job_cols if row[1] == "job_number"), None)
        needs_job_number_nullable = job_number_col is not None and int(job_number_col[3]) == 1
        indexes = (
            await conn.execute(
                text(
                    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='jobs'"
                )
            )
        ).fetchall()
        index_names = {row[0] for row in indexes}
        needs_drop_unique = (
            "uq_jobs_company_job_number" in index_names
            or "sqlite_autoindex_jobs_1" in index_names
        )
        if needs_job_number_nullable or needs_drop_unique:
            await conn.execute(text("PRAGMA foreign_keys=OFF"))
            await conn.execute(text("DROP TABLE IF EXISTS jobs_migrated"))
            await conn.execute(
                text(
                    """
                    CREATE TABLE jobs_migrated (
                        id CHAR(32) NOT NULL PRIMARY KEY,
                        company_id CHAR(32) NOT NULL,
                        shift_id CHAR(32) NOT NULL,
                        machine_id CHAR(32),
                        job_number TEXT,
                        job_name TEXT NOT NULL,
                        total_sheets INTEGER NOT NULL DEFAULT 0,
                        dabbi BOOLEAN,
                        ups INTEGER,
                        status VARCHAR(20),
                        created_by CHAR(32),
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    INSERT INTO jobs_migrated
                    (id, company_id, shift_id, machine_id, job_number, job_name,
                     total_sheets, dabbi, ups, status, created_by, created_at, updated_at)
                    SELECT
                        id, company_id, shift_id, machine_id,
                        NULLIF(TRIM(job_number), ''),
                        job_name, total_sheets, dabbi, ups, status,
                        created_by, created_at, updated_at
                    FROM jobs
                    """
                )
            )
            await conn.execute(text("DROP TABLE jobs"))
            await conn.execute(text("ALTER TABLE jobs_migrated RENAME TO jobs"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))

    # Backfill missing job created_at so LIFO ordering works
    job_cols = (await conn.execute(text("PRAGMA table_info(jobs)"))).fetchall()
    if job_cols:
        null_jobs = (
            await conn.execute(
                text(
                    "SELECT id, job_number FROM jobs WHERE created_at IS NULL ORDER BY rowid ASC"
                )
            )
        ).fetchall()
        from datetime import datetime, timezone

        for idx, row in enumerate(null_jobs):
            job_id, job_number = row[0], row[1] or ""
            ts = None
            # Auto numbers look like J-YYYYMMDDHHMMSS-xxxx
            if isinstance(job_number, str) and job_number.startswith("J-") and len(job_number) >= 16:
                stamp = job_number[2:16]
                if stamp.isdigit():
                    try:
                        ts = datetime.strptime(stamp, "%Y%m%d%H%M%S").replace(
                            tzinfo=timezone.utc
                        )
                    except ValueError:
                        ts = None
            if ts is None:
                # Stable increasing times so older NULL rows stay below newer ones
                ts = datetime.fromtimestamp(1_577_836_800 + idx, tz=timezone.utc)
            await conn.execute(
                text("UPDATE jobs SET created_at = :ts WHERE id = :id"),
                {"ts": ts.isoformat(), "id": job_id},
            )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
