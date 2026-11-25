from fastapi import APIRouter, HTTPException
from .. import database as db
from ..schemas import Patient, PatientCreate, PatientUpdate

router = APIRouter(prefix="/api/patients", tags=["Patients"])


@router.get("", response_model=list[Patient])
def list_patients():
    return db.list_patients()


@router.get("/{patient_id}", response_model=Patient)
def get_patient(patient_id: int):
    p = db.get_patient(patient_id)
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@router.post("", response_model=Patient, status_code=201)
def create_patient(body: PatientCreate):
    return db.create_patient(body.model_dump())


@router.put("/{patient_id}", response_model=Patient)
def update_patient(patient_id: int, body: PatientUpdate):
    if not db.get_patient(patient_id):
        raise HTTPException(404, "Patient not found")
    return db.update_patient(patient_id, body.model_dump(exclude_unset=True))
