from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from .. import database as db, monitoring
from ..schemas import Scenario, Vital, VitalWithAlerts

router = APIRouter(prefix="/api/vitals", tags=["Vitals"])


def _ensure_patient(patient_id: int):
    if not db.get_patient(patient_id):
        raise HTTPException(404, "Patient not found")


@router.post("/{patient_id}/simulate", response_model=VitalWithAlerts, status_code=201)
def simulate_vitals(patient_id: int, scenario: Scenario = "normal"):
    """Generate a simulated reading, store it, and create alerts if abnormal."""
    _ensure_patient(patient_id)
    reading = monitoring.generate_vitals(scenario)
    status, alerts = monitoring.evaluate_vitals(reading)
    saved = db.insert_vital(patient_id, reading, status)
    created = [db.insert_alert(patient_id, saved["id"], a) for a in alerts]
    return {**saved, "alerts": created}


@router.get("/{patient_id}/latest", response_model=Vital)
def latest_vitals(patient_id: int):
    _ensure_patient(patient_id)
    v = db.latest_vital(patient_id)
    if not v:
        raise HTTPException(404, "No readings yet. Call POST /simulate first.")
    return v


@router.get("/{patient_id}/history", response_model=list[Vital])
def vitals_history(
    patient_id: int,
    start: Optional[str] = Query(None, description="ISO datetime, e.g. 2026-11-25T00:00:00"),
    end: Optional[str] = Query(None, description="ISO datetime"),
    limit: int = Query(100, ge=1, le=1000),
):
    _ensure_patient(patient_id)
    return db.vital_history(patient_id, start, end, limit)
