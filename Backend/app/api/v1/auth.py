from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.exceptions import envelope
from app.schemas.common import LoginRequest, LoginResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result: LoginResponse = await AuthService(db).login(body.phone, body.password)
    return envelope(data=result.model_dump(mode="json"))


@router.post("/logout")
async def logout():
    return envelope(data=None)
