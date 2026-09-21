from fastapi import APIRouter

from app.api.v1 import auth, master, operations

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(master.router)
api_router.include_router(operations.router)
