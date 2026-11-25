from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Query
from .. import database as db
from ..schemas import Alert

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=list[Alert])
def list_alerts(
    patient_id: Optional[int] = None,
    severity: Optional[Literal["warning", "critical"]] = None,
    acknowledged: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
):
    return db.list_alerts(patient_id, severity, acknowledged, limit)


@router.patch("/{alert_id}/acknowledge", response_model=Alert)
def acknowledge(alert_id: int):
    a = db.acknowledge_alert(alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    return a
