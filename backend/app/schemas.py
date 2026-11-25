"""Pydantic models = request/response validation for all APIs."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

Scenario = Literal["normal", "warning", "critical"]
Status = Literal["normal", "warning", "critical"]


class PatientBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=130)
    gender: Literal["Male", "Female", "Other"] = "Other"
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=100)
    medical_conditions: Optional[str] = Field(default=None, max_length=500)


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=100)
    medical_conditions: Optional[str] = Field(default=None, max_length=500)


class Patient(PatientBase):
    id: int


class Alert(BaseModel):
    id: int
    patient_id: int
    vital_id: Optional[int] = None
    type: str
    severity: Literal["warning", "critical"]
    message: str
    timestamp: str
    acknowledged: bool = False


class Vital(BaseModel):
    id: int
    patient_id: int
    heart_rate: int
    spo2: int
    temperature: float
    systolic_bp: int
    diastolic_bp: int
    status: Status
    timestamp: str


class VitalWithAlerts(Vital):
    alerts: list[Alert] = []


class Settings(BaseModel):
    hr_min: int = Field(default=60, ge=20, le=200)
    hr_max: int = Field(default=100, ge=20, le=250)
    spo2_min: int = Field(default=95, ge=50, le=100)
    temp_max: float = Field(default=37.5, ge=30, le=45)
    sys_max: int = Field(default=129, ge=80, le=250)
    dia_max: int = Field(default=84, ge=40, le=160)
    notifications_enabled: bool = True
    refresh_interval_sec: int = Field(default=5, ge=1, le=300)
