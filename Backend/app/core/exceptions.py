from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def envelope(data: Any = None, error: dict[str, str] | None = None, meta: dict | None = None):
    body: dict[str, Any] = {"data": data, "error": error}
    if meta is not None:
        body["meta"] = meta
    return body


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope(error={"code": exc.code, "message": exc.message}),
    )


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        error = {"code": str(detail["code"]), "message": str(detail.get("message", ""))}
    else:
        error = {"code": "HTTP_ERROR", "message": str(detail)}
    return JSONResponse(status_code=exc.status_code, content=envelope(error=error))
