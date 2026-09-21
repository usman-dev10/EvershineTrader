from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import init_db
from app.core.exceptions import AppError, app_error_handler, http_error_handler

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    from app.core.db import SessionLocal
    from app.services.auth_service import AuthService

    async with SessionLocal() as session:
        await AuthService(session).ensure_bootstrap_company()
    yield


app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(HTTPException, http_error_handler)
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "database": "postgres",
    }
