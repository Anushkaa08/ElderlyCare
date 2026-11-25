"""
test_database.py - Simple end-to-end tests for the ElderlyCare database module.

Run from the PROJECT ROOT (the folder that contains the `database` folder):

    python -m database.test_database

No pytest or other external libraries are needed.

The tests use a temporary database file that is created fresh and deleted at
the end, so your real database/elderlycare.db is never touched.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from . import db, operations as ops

# ---------------------------------------------------------------------------
# Point the module at a throw-away database
# ---------------------------------------------------------------------------
_TEMP_DIR = tempfile.TemporaryDirectory(prefix="elderlycare_test_")
TEST_DB_PATH = Path(_TEMP_DIR.name) / "test_elderlycare.db"


def _test_connection():
    """Same as db.get_connection(), but always uses the temporary test database."""
    return db.get_connection(TEST_DB_PATH)


# operations.py calls get_connection() with no arguments, so swap it for the test one.
ops.get_connection = _test_connection

# ---------------------------------------------------------------------------
# Demo data (realistic values for an elderly patient)
# ---------------------------------------------------------------------------
PATIENT = {
    "name": "Ramesh Kumar",
    "age": 72,
    "gender": "Male",
    "contact": "+91 98765 43210",
    "address": "12, Gandhi Nagar, Ghaziabad, Uttar Pradesh",
    "medical_history": "Hypertension (since 2015), Type 2 Diabetes",
}

# (recorded_at UTC, heart_rate, spo2, temperature, systolic, diastolic, status)
READINGS = [
    ("2026-11-20T06:30:00Z", 74, 97.0, 36.6, 124, 82, "Normal"),
    ("2026-11-21T06:30:00Z", 78, 96.5, 36.7, 128, 84, "Normal"),
    ("2026-11-22T06:30:00Z", 88, 94.0, 37.4, 138, 88, "Warning"),
    ("2026-11-22T18:15:00Z", 96, 93.0, 37.8, 146, 92, "Warning"),
    ("2026-11-23T06:30:00Z", 118, 89.5, 38.6, 164, 102, "Critical"),
    ("2026-11-24T06:30:00Z", 80, 96.0, 36.9, 130, 85, "Normal"),
]

# Shared between tests (later tests build on earlier ones)
state: dict = {}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_initialize_database():
    db.initialize_database(TEST_DB_PATH)
    assert TEST_DB_PATH.exists(), "database file was not created"

    with db.get_connection(TEST_DB_PATH) as conn:
        tables = {
            r["name"] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        fk_on = conn.execute("PRAGMA foreign_keys").fetchone()[0]

    expected = {"patients", "vital_readings", "alerts"}
    assert expected <= tables, f"missing tables: {expected - tables}"
    assert fk_on == 1, "foreign keys are not enabled"

    # Running it a second time must be harmless
    db.initialize_database(TEST_DB_PATH)
    return "tables patients, vital_readings, alerts created; foreign keys ON"


def test_add_patient():
    patient = ops.add_patient(**PATIENT)
    assert isinstance(patient["patient_id"], int), "no patient_id returned"
    assert patient["name"] == PATIENT["name"]
    assert patient["created_at"].endswith("Z"), "created_at is not UTC ISO 8601"
    state["patient_id"] = patient["patient_id"]
    return f"patient saved with patient_id={patient['patient_id']}"


def test_get_patient():
    patient = ops.get_patient(state["patient_id"])
    assert patient is not None, "patient not found"
    for field, value in PATIENT.items():
        assert patient[field] == value, f"{field}: expected {value!r}, got {patient[field]!r}"
    assert ops.get_patient(9999) is None, "unknown patient should return None"
    return f"found {patient['name']}, age {patient['age']}; unknown ID returns None"


def test_add_vital_readings():
    pid = state["patient_id"]
    ids = []
    for ts, hr, spo2, temp, sys_bp, dia_bp, status in READINGS:
        saved = ops.add_vital_reading(
            pid, hr, spo2, temp, sys_bp, dia_bp, status, recorded_at=ts
        )
        assert saved["patient_id"] == pid
        assert saved["recorded_at"] == ts, "timestamp was changed while saving"
        ids.append(saved["reading_id"])
    assert len(set(ids)) == len(READINGS), "reading IDs are not unique"
    state["reading_ids"] = ids
    return f"{len(ids)} readings saved (Normal, Warning and Critical)"


def test_get_latest_reading():
    latest = ops.get_latest_reading(state["patient_id"])
    expected = READINGS[-1]
    assert latest is not None, "no latest reading returned"
    assert latest["recorded_at"] == expected[0], (
        f"expected {expected[0]}, got {latest['recorded_at']}"
    )
    assert latest["heart_rate"] == expected[1]
    assert latest["status"] == expected[6]
    return f"latest reading is {latest['recorded_at']} (HR {latest['heart_rate']}, {latest['status']})"


def test_get_vital_history():
    pid = state["patient_id"]

    history = ops.get_vital_history(pid)
    assert len(history) == len(READINGS), f"expected {len(READINGS)} rows, got {len(history)}"
    times = [r["recorded_at"] for r in history]
    assert times == sorted(times, reverse=True), "history is not newest-first"

    limited = ops.get_vital_history(pid, limit=3)
    assert len(limited) == 3, "limit=3 did not return 3 rows"
    assert limited[0]["recorded_at"] == READINGS[-1][0]

    oldest_first = ops.get_vital_history(pid, newest_first=False)
    assert oldest_first[0]["recorded_at"] == READINGS[0][0], "oldest-first order is wrong"
    return f"{len(history)} readings returned newest-first; limit and ordering work"


def test_get_history_by_date():
    pid = state["patient_id"]

    # Whole days: 22 and 23 Nov -> 3 readings (two on the 22nd, one on the 23rd)
    by_day = ops.get_history_by_date(pid, "2026-11-22", "2026-11-23")
    assert len(by_day) == 3, f"expected 3 readings, got {len(by_day)}"
    assert all("2026-11-22" <= r["recorded_at"][:10] <= "2026-11-23" for r in by_day)

    # Exact time window: only the 22 Nov evening reading
    window = ops.get_history_by_date(
        pid, "2026-11-22T12:00:00Z", "2026-11-22T23:59:59Z"
    )
    assert len(window) == 1 and window[0]["recorded_at"] == "2026-11-22T18:15:00Z", (
        "time-of-day filtering returned the wrong rows"
    )

    # A range with no data
    empty = ops.get_history_by_date(pid, "2026-01-01", "2026-01-31")
    assert empty == [], "empty range should return an empty list"

    # Start after end must be rejected
    try:
        ops.get_history_by_date(pid, "2026-11-24", "2026-11-20")
    except ops.ValidationError:
        pass
    else:
        raise AssertionError("start_date after end_date was not rejected")
    return "day range, time window, empty range and invalid range all behave correctly"


def test_add_alert():
    pid = state["patient_id"]
    critical_reading_id = state["reading_ids"][4]    # the Critical reading on 23 Nov

    alert = ops.add_alert(
        pid, critical_reading_id, "MULTIPLE_VITALS", "CRITICAL",
        "Critical: heart rate 118 bpm, SpO2 89.5%, temperature 38.6 C, BP 164/102",
    )
    assert alert["is_read"] == 0, "new alert should start unread"
    assert alert["reading_id"] == critical_reading_id
    assert alert["created_at"].endswith("Z")

    warning = ops.add_alert(
        pid, state["reading_ids"][2], "SPO2", "WARNING",
        "Warning: SpO2 dropped to 94.0%",
    )
    state["alert_id"] = alert["alert_id"]
    state["second_alert_id"] = warning["alert_id"]
    return f"2 alerts saved (alert_id {alert['alert_id']} and {warning['alert_id']}), both unread"


def test_get_alerts():
    pid = state["patient_id"]

    alerts = ops.get_alerts(pid)
    assert len(alerts) == 2, f"expected 2 alerts, got {len(alerts)}"
    assert alerts[0]["alert_id"] > alerts[1]["alert_id"], "alerts are not newest-first"

    unread = ops.get_alerts(pid, unread_only=True)
    assert len(unread) == 2, "both alerts should be unread"
    return "2 alerts returned newest-first; both unread"


def test_mark_alert_as_read():
    pid = state["patient_id"]

    updated = ops.mark_alert_as_read(state["alert_id"])
    assert updated["is_read"] == 1, "alert was not marked as read"

    unread = ops.get_alerts(pid, unread_only=True)
    assert len(unread) == 1, f"expected 1 unread alert left, got {len(unread)}"
    assert unread[0]["alert_id"] == state["second_alert_id"]

    # Marking again is harmless; an unknown alert is an error
    assert ops.mark_alert_as_read(state["alert_id"])["is_read"] == 1
    try:
        ops.mark_alert_as_read(9999)
    except ops.AlertNotFoundError:
        pass
    else:
        raise AssertionError("unknown alert_id was not rejected")
    return f"alert {state['alert_id']} is now read; 1 unread alert remains"


# ---------------------------------------------------------------------------
# Tiny test runner
# ---------------------------------------------------------------------------
TESTS = [
    ("1. Initialize the database", test_initialize_database),
    ("2. Add a sample patient", test_add_patient),
    ("3. Retrieve patient details", test_get_patient),
    ("4. Add multiple vital readings", test_add_vital_readings),
    ("5. Retrieve the latest vital reading", test_get_latest_reading),
    ("6. Retrieve historical readings", test_get_vital_history),
    ("7. Retrieve readings between two dates", test_get_history_by_date),
    ("8. Add a sample alert", test_add_alert),
    ("9. Retrieve patient alerts", test_get_alerts),
    ("10. Mark an alert as read", test_mark_alert_as_read),
]


def run_all() -> bool:
    print("=" * 66)
    print(" ElderlyCare - Database Tests")
    print(f" Temporary test database: {TEST_DB_PATH}")
    print("=" * 66)

    passed = 0
    for title, test in TESTS:
        try:
            details = test()
        except AssertionError as exc:
            print(f"[FAILED]  {title}\n          Reason: {exc}")
        except KeyError as exc:
            print(f"[FAILED]  {title}\n          Reason: an earlier test did not "
                  f"finish, so {exc} is missing")
        except Exception as exc:  # any unexpected error should not stop the run
            print(f"[FAILED]  {title}\n          Error: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"[SUCCESS] {title}\n          {details}")

    print("=" * 66)
    total = len(TESTS)
    if passed == total:
        print(f" RESULT: ALL {total} TESTS PASSED")
    else:
        print(f" RESULT: {passed} passed, {total - passed} FAILED (out of {total})")
    print("=" * 66)
    return passed == total


def main() -> int:
    try:
        ok = run_all()
    finally:
        _TEMP_DIR.cleanup()          # delete the temporary database
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())