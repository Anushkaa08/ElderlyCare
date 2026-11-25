"""
operations.py - Database operations (CRUD) for the ElderlyCare project.

Every function opens its own short-lived connection through db.get_connection(),
uses parameterized SQL only, and returns plain dictionaries (or lists of them)
that FastAPI can send straight back as JSON.

Errors raised by this module:
    ValidationError        - bad input (wrong type, empty value, unknown field...)
    NotFoundError          - base class of the three "does not exist" errors below
      PatientNotFoundError
      ReadingNotFoundError
      AlertNotFoundError
    DatabaseError          - the database itself failed (imported from db.py)

Timestamps are stored and returned in UTC as ISO 8601: 2026-11-24T16:42:10Z
"""

from __future__ import annotations

import math
import sqlite3
from datetime import date, datetime, time, timezone
from typing import Any, Callable

try:  # normal use: from database.operations import ...
    from .db import DatabaseError, get_connection
except ImportError:  # running as a plain script from inside database/
    from db import DatabaseError, get_connection

__all__ = [
    "DatabaseError", "ValidationError", "NotFoundError",
    "PatientNotFoundError", "ReadingNotFoundError", "AlertNotFoundError",
    "add_patient", "get_patient", "get_all_patients", "update_patient",
    "add_vital_reading", "get_latest_reading", "get_vital_history",
    "get_history_by_date",
    "add_alert", "get_alerts", "mark_alert_as_read",
]

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ValidationError(ValueError):
    """The input given to a function is invalid."""


class NotFoundError(LookupError):
    """A requested record does not exist."""


class PatientNotFoundError(NotFoundError):
    pass


class ReadingNotFoundError(NotFoundError):
    pass


class AlertNotFoundError(NotFoundError):
    pass


# ---------------------------------------------------------------------------
# Allowed values (lowercase key -> value stored in the database)
# ---------------------------------------------------------------------------
GENDERS = {"male": "Male", "female": "Female", "other": "Other"}
STATUSES = {"normal": "Normal", "warning": "Warning", "critical": "Critical"}
ALERT_TYPES = {
    "heart_rate": "HEART_RATE",
    "spo2": "SPO2",
    "temperature": "TEMPERATURE",
    "blood_pressure": "BLOOD_PRESSURE",
    "multiple_vitals": "MULTIPLE_VITALS",
}
SEVERITIES = {"warning": "WARNING", "critical": "CRITICAL"}

MAX_LIMIT = 1000          # largest page size get_vital_history() will return
_TS_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
def _validate_id(value: Any, label: str) -> int:
    """IDs must be real integers >= 1 (True/False and strings are rejected)."""
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValidationError(f"{label} must be a positive integer")
    return value


def _clean_text(value: Any, label: str, required: bool = True,
                max_len: int = 500) -> str | None:
    if value is None:
        if required:
            raise ValidationError(f"{label} is required")
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{label} must be text")
    value = value.strip()
    if not value:
        if required:
            raise ValidationError(f"{label} cannot be empty")
        return None
    if len(value) > max_len:
        raise ValidationError(f"{label} is too long (max {max_len} characters)")
    return value


def _clean_age(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("age must be a whole number")
    if not 0 <= value <= 130:
        raise ValidationError("age must be between 0 and 130")
    return value


def _clean_choice(value: Any, label: str, options: dict[str, str]) -> str:
    """Case-insensitive match against an allowed list; returns the stored form."""
    if not isinstance(value, str):
        raise ValidationError(f"{label} must be text")
    canonical = options.get(value.strip().lower())
    if canonical is None:
        allowed = ", ".join(options.values())
        raise ValidationError(f"{label} must be one of: {allowed}")
    return canonical


def _clean_number(value: Any, label: str, as_int: bool = False) -> int | float:
    """Type check only - the database applies no health thresholds."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{label} must be a number")
    if not math.isfinite(value):
        raise ValidationError(f"{label} must be a finite number")
    return int(round(value)) if as_int else float(value)


def _to_utc_iso(value: Any, label: str, end_of_day: bool = False) -> str:
    """
    Convert a date/datetime/ISO string to the stored format (UTC, ISO 8601).

    - Strings with a timezone offset or 'Z' are converted to UTC.
    - Naive datetimes/strings (no timezone) are assumed to already be UTC.
    - A date-only value ("2026-11-24") means the start of that day, or the
      end of that day (23:59:59) when end_of_day=True.
    """
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime.combine(value, time(23, 59, 59) if end_of_day else time(0, 0, 0))
    elif isinstance(value, str) and value.strip():
        text = value.strip()
        try:
            if len(text) == 10:   # YYYY-MM-DD
                day = date.fromisoformat(text)
                dt = datetime.combine(day, time(23, 59, 59) if end_of_day else time(0, 0, 0))
            else:
                if text[-1] in "Zz":
                    text = text[:-1] + "+00:00"
                dt = datetime.fromisoformat(text)
        except ValueError:
            raise ValidationError(
                f"{label} must be an ISO 8601 date or datetime, "
                "e.g. 2026-11-24 or 2026-11-24T10:30:00Z"
            ) from None
    else:
        raise ValidationError(f"{label} must be a date, datetime or ISO 8601 string")

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime(_TS_FORMAT)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime(_TS_FORMAT)


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _ensure_patient_exists(conn: sqlite3.Connection, patient_id: int) -> None:
    found = conn.execute(
        "SELECT 1 FROM patients WHERE patient_id = ?", (patient_id,)
    ).fetchone()
    if found is None:
        raise PatientNotFoundError(f"Patient {patient_id} does not exist")


# Cleaner for every editable patient column (also defines the allowed fields)
_PATIENT_CLEANERS: dict[str, Callable[[Any], Any]] = {
    "name": lambda v: _clean_text(v, "name", max_len=100),
    "age": _clean_age,
    "gender": lambda v: _clean_choice(v, "gender", GENDERS),
    "contact": lambda v: _clean_text(v, "contact", max_len=100),
    "address": lambda v: _clean_text(v, "address", required=False, max_len=300),
    "medical_history": lambda v: _clean_text(
        v, "medical_history", required=False, max_len=5000),
}


# ===========================================================================
# PATIENT OPERATIONS
# ===========================================================================
def add_patient(name: str, age: int, gender: str, contact: str,
                address: str | None = None,
                medical_history: str | None = None) -> dict[str, Any]:
    """Insert a new patient and return the saved record (including patient_id)."""
    data = {
        "name": _PATIENT_CLEANERS["name"](name),
        "age": _PATIENT_CLEANERS["age"](age),
        "gender": _PATIENT_CLEANERS["gender"](gender),
        "contact": _PATIENT_CLEANERS["contact"](contact),
        "address": _PATIENT_CLEANERS["address"](address),
        "medical_history": _PATIENT_CLEANERS["medical_history"](medical_history),
    }
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO patients (name, age, gender, contact, address, medical_history) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (data["name"], data["age"], data["gender"], data["contact"],
             data["address"], data["medical_history"]),
        )
        row = conn.execute(
            "SELECT * FROM patients WHERE patient_id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


def get_patient(patient_id: int) -> dict[str, Any] | None:
    """Return one patient as a dict, or None if that patient does not exist."""
    patient_id = _validate_id(patient_id, "patient_id")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()
        return _row_to_dict(row)


def get_all_patients() -> list[dict[str, Any]]:
    """Return every patient (oldest registration first). Empty list if none."""
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM patients ORDER BY patient_id").fetchall()
        return [dict(r) for r in rows]


def update_patient(patient_id: int, patient_data: dict[str, Any]) -> dict[str, Any]:
    """
    Update only the fields present in patient_data and return the updated record.
    Editable fields: name, age, gender, contact, address, medical_history.
    """
    patient_id = _validate_id(patient_id, "patient_id")
    if not isinstance(patient_data, dict) or not patient_data:
        raise ValidationError("patient_data must be a non-empty dictionary")

    unknown = set(patient_data) - set(_PATIENT_CLEANERS)
    if unknown:
        raise ValidationError(
            f"Cannot update field(s): {', '.join(sorted(unknown))}. "
            f"Allowed: {', '.join(_PATIENT_CLEANERS)}"
        )

    cleaned = {col: _PATIENT_CLEANERS[col](val) for col, val in patient_data.items()}

    # Column names come only from the whitelist above (never from user input);
    # every VALUE goes through a ? placeholder.
    set_clause = ", ".join(f"{col} = ?" for col in cleaned)
    with get_connection() as conn:
        cur = conn.execute(
            f"UPDATE patients SET {set_clause} WHERE patient_id = ?",
            (*cleaned.values(), patient_id),
        )
        if cur.rowcount == 0:
            raise PatientNotFoundError(f"Patient {patient_id} does not exist")
        row = conn.execute(
            "SELECT * FROM patients WHERE patient_id = ?", (patient_id,)
        ).fetchone()
        return dict(row)


# ===========================================================================
# VITAL READING OPERATIONS
# ===========================================================================
def add_vital_reading(patient_id: int, heart_rate: int, spo2: float,
                      temperature: float, systolic_bp: int, diastolic_bp: int,
                      status: str, recorded_at: Any = None) -> dict[str, Any]:
    """
    Store one reading and return the saved record (including reading_id).
    The status is stored exactly as decided by the monitoring engine
    (Normal / Warning / Critical) - no thresholds are applied here.
    recorded_at is optional; when omitted the current UTC time is used.
    """
    patient_id = _validate_id(patient_id, "patient_id")
    values = (
        _clean_number(heart_rate, "heart_rate", as_int=True),
        _clean_number(spo2, "spo2"),
        _clean_number(temperature, "temperature"),
        _clean_number(systolic_bp, "systolic_bp", as_int=True),
        _clean_number(diastolic_bp, "diastolic_bp", as_int=True),
        _clean_choice(status, "status", STATUSES),
    )
    timestamp = (_to_utc_iso(recorded_at, "recorded_at")
                 if recorded_at is not None else _now_iso())

    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        cur = conn.execute(
            "INSERT INTO vital_readings (patient_id, heart_rate, spo2, temperature, "
            "systolic_bp, diastolic_bp, status, recorded_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (patient_id, *values, timestamp),
        )
        row = conn.execute(
            "SELECT * FROM vital_readings WHERE reading_id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


def get_latest_reading(patient_id: int) -> dict[str, Any] | None:
    """Return the newest reading for a patient, or None if there are no readings yet."""
    patient_id = _validate_id(patient_id, "patient_id")
    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        row = conn.execute(
            "SELECT * FROM vital_readings WHERE patient_id = ? "
            "ORDER BY recorded_at DESC, reading_id DESC LIMIT 1",
            (patient_id,),
        ).fetchone()
        return _row_to_dict(row)


def get_vital_history(patient_id: int, limit: int = 50, offset: int = 0,
                      newest_first: bool = True) -> list[dict[str, Any]]:
    """
    Return up to `limit` readings sorted by recorded_at (newest first by default).
    Use `offset` for paging, e.g. limit=50, offset=50 gives the next page.
    """
    patient_id = _validate_id(patient_id, "patient_id")
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= MAX_LIMIT:
        raise ValidationError(f"limit must be a whole number between 1 and {MAX_LIMIT}")
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise ValidationError("offset must be a whole number >= 0")

    direction = "DESC" if newest_first else "ASC"   # fixed choice, not user text
    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        rows = conn.execute(
            "SELECT * FROM vital_readings WHERE patient_id = ? "
            f"ORDER BY recorded_at {direction}, reading_id {direction} "
            "LIMIT ? OFFSET ?",
            (patient_id, limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def get_history_by_date(patient_id: int, start_date: Any, end_date: Any,
                        limit: int | None = None,
                        newest_first: bool = True) -> list[dict[str, Any]]:
    """
    Return readings with start_date <= recorded_at <= end_date.

    start_date / end_date may be:
      - "2026-11-20"             date only (UTC): start = 00:00:00, end = 23:59:59
      - "2026-11-20T08:00:00Z"   full ISO 8601 date and time (offsets such as
                                 +05:30 are converted to UTC)
      - a datetime.date or datetime.datetime object
    Optional `limit` caps the number of rows (None = no cap).
    """
    patient_id = _validate_id(patient_id, "patient_id")
    start = _to_utc_iso(start_date, "start_date")
    end = _to_utc_iso(end_date, "end_date", end_of_day=True)
    if start > end:
        raise ValidationError("start_date must not be later than end_date")
    if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or limit < 1):
        raise ValidationError("limit must be a positive whole number or None")

    direction = "DESC" if newest_first else "ASC"
    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        rows = conn.execute(
            "SELECT * FROM vital_readings "
            "WHERE patient_id = ? AND recorded_at BETWEEN ? AND ? "
            f"ORDER BY recorded_at {direction}, reading_id {direction} "
            "LIMIT ?",
            (patient_id, start, end, limit if limit is not None else -1),
        ).fetchall()
        return [dict(r) for r in rows]


# ===========================================================================
# ALERT OPERATIONS
# ===========================================================================
def add_alert(patient_id: int, reading_id: int | None, alert_type: str,
              severity: str, message: str) -> dict[str, Any]:
    """
    Store an alert (raised by the monitoring engine / backend) and return it.
    reading_id may be None; if given, it must belong to the same patient.
    is_read starts as 0 (unread).
    """
    patient_id = _validate_id(patient_id, "patient_id")
    if reading_id is not None:
        reading_id = _validate_id(reading_id, "reading_id")
    alert_type = _clean_choice(alert_type, "alert_type", ALERT_TYPES)
    severity = _clean_choice(severity, "severity", SEVERITIES)
    message = _clean_text(message, "message", max_len=1000)

    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        if reading_id is not None:
            reading = conn.execute(
                "SELECT patient_id FROM vital_readings WHERE reading_id = ?",
                (reading_id,),
            ).fetchone()
            if reading is None:
                raise ReadingNotFoundError(f"Reading {reading_id} does not exist")
            if reading["patient_id"] != patient_id:
                raise ValidationError(
                    f"Reading {reading_id} belongs to a different patient"
                )
        cur = conn.execute(
            "INSERT INTO alerts (patient_id, reading_id, alert_type, severity, "
            "message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (patient_id, reading_id, alert_type, severity, message, _now_iso()),
        )
        row = conn.execute(
            "SELECT * FROM alerts WHERE alert_id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


def get_alerts(patient_id: int, unread_only: bool = False) -> list[dict[str, Any]]:
    """Return a patient's alerts, newest first. Use unread_only=True for new ones."""
    patient_id = _validate_id(patient_id, "patient_id")
    sql = "SELECT * FROM alerts WHERE patient_id = ?"
    if unread_only:
        sql += " AND is_read = 0"
    sql += " ORDER BY created_at DESC, alert_id DESC"

    with get_connection() as conn:
        _ensure_patient_exists(conn, patient_id)
        return [dict(r) for r in conn.execute(sql, (patient_id,)).fetchall()]


def mark_alert_as_read(alert_id: int) -> dict[str, Any]:
    """Set is_read = 1 and return the updated alert. Safe to call more than once."""
    alert_id = _validate_id(alert_id, "alert_id")
    with get_connection() as conn:
        cur = conn.execute(
            "UPDATE alerts SET is_read = 1 WHERE alert_id = ?", (alert_id,)
        )
        if cur.rowcount == 0:
            raise AlertNotFoundError(f"Alert {alert_id} does not exist")
        row = conn.execute(
            "SELECT * FROM alerts WHERE alert_id = ?", (alert_id,)
        ).fetchone()
        return dict(row)