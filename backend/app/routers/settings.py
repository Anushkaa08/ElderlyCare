from fastapi import APIRouter
from .. import database as db
from ..schemas import Settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("", response_model=Settings)
def get_settings():
    return db.get_settings() or Settings().model_dump()


@router.put("", response_model=Settings)
def update_settings(body: Settings):
    return db.save_settings(body.model_dump())
