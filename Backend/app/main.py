from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import init_db
from app.core.exceptions import AppError, app_error_handler, envelope, http_error_handler

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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    loc = first.get("loc", ())
    field = loc[-1] if loc else "body"
    msg = first.get("msg", "Invalid request.")
    return JSONResponse(
        status_code=400,
        content=envelope(
            error={
                "code": "VALIDATION_ERROR",
                "message": f"{field}: {msg}",
            }
        ),
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content=envelope(
            error={
                "code": "SERVER_ERROR",
                "message": "Something went wrong. Please try again.",
            }
        ),
    )


app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "database": "postgres",
    }
