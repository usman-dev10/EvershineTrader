import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppError
from app.core.passwords import hash_password, verify_password
from app.core.security import create_access_token
from app.models.master import LoginAccount
from app.models.profile import Company, Profile
from app.schemas.common import LoginResponse, ProfileOut, SessionOut, normalize_phone

# Initial company owner account (seeded once into login_accounts — not demo login UI).
BOOTSTRAP_COMPANY_PHONE = "03001234567"
BOOTSTRAP_COMPANY_PASSWORD = "company123"
BOOTSTRAP_COMPANY_PROFILE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def login(self, phone: str, password: str) -> LoginResponse:
        phone = normalize_phone(phone)

        result = await self.db.execute(
            select(LoginAccount).where(LoginAccount.phone == phone)
        )
        account = result.scalar_one_or_none()
        if not account or not verify_password(password, account.password_hash):
            raise AppError(
                "INVALID_CREDENTIALS",
                "Incorrect phone number or password.",
                status_code=401,
            )

        # Upgrade legacy SHA-256 hashes to bcrypt after successful login
        if not account.password_hash.startswith("$2"):
            account.password_hash = hash_password(password)
            await self.db.commit()

        profile = await self.db.get(Profile, account.profile_id)
        if not profile:
            raise AppError("UNAUTHORIZED", "Profile not found.", 401)

        token = create_access_token(
            subject=str(profile.id),
            role=profile.role,
            company_id=str(profile.company_id),
        )
        return LoginResponse(
            profile=ProfileOut.model_validate(profile),
            session=SessionOut(access_token=token),
        )

    async def ensure_bootstrap_company(self) -> None:
        """Ensure one real company login account exists so Manage can create more."""
        company = await self._ensure_company()
        result = await self.db.execute(
            select(LoginAccount).where(
                LoginAccount.company_id == company.id,
                LoginAccount.role == "company",
            )
        )
        if result.scalar_one_or_none():
            return

        profile = await self.db.get(Profile, BOOTSTRAP_COMPANY_PROFILE_ID)
        if not profile:
            profile = Profile(
                id=BOOTSTRAP_COMPANY_PROFILE_ID,
                company_id=company.id,
                role="company",
                employee_id=None,
            )
            self.db.add(profile)

        phone_taken = await self.db.execute(
            select(LoginAccount).where(LoginAccount.phone == BOOTSTRAP_COMPANY_PHONE)
        )
        if phone_taken.scalar_one_or_none() is None:
            self.db.add(
                LoginAccount(
                    company_id=company.id,
                    phone=BOOTSTRAP_COMPANY_PHONE,
                    password_hash=hash_password(BOOTSTRAP_COMPANY_PASSWORD),
                    role="company",
                    profile_id=BOOTSTRAP_COMPANY_PROFILE_ID,
                )
            )
        await self.db.commit()

    async def _ensure_company(self) -> Company:
        result = await self.db.execute(
            select(Company).where(Company.email == "company@evershine.local")
        )
        company = result.scalar_one_or_none()
        if company:
            return company

        # Prefer existing demo company row if present from earlier runs
        legacy = await self.db.execute(
            select(Company).where(Company.email == "company@demo.com")
        )
        company = legacy.scalar_one_or_none()
        if company:
            return company

        company = Company(
            id=uuid.uuid4(),
            name="Evershine Trader",
            email="company@evershine.local",
        )
        self.db.add(company)
        await self.db.commit()
        await self.db.refresh(company)
        return company
