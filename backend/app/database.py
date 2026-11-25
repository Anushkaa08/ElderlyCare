"""
Database adapter  (Member 4 integration point)
----------------------------------------------
Routers only use the functions in this file. Working SQLite version included so the
backend runs standalone. Member 4 can replace the internals; keep function names/return shapes.
DB file path: env ELDERLYCARE_DB (default: elderlycare.db)
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional


def _path() -> str:
    return os.getenv("ELDERLYCARE_DB", "elderlycare.db")


@contextmanager
def conn():
    c = sqlite3.connect(_path())
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db() -> None:
    with conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT NOT NULL,
                phone TEXT, emergency_contact TEXT, medical_conditions TEXT
            );
            CREATE TABLE IF NOT EXISTS vitals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                heart_rate INTEGER, spo2 INTEGER, temperature REAL,
                systolic_bp INTEGER, diastolic_bp INTEGER,
                status TEXT NOT NULL, timestamp TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                vital_id INTEGER REFERENCES vitals(id) ON DELETE SET NULL,
                type TEXT NOT NULL, severity TEXT NOT NULL, message TEXT NOT NULL,
                timestamp TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_vitals_patient_time ON vitals(patient_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_patient_time ON alerts(patient_id, timestamp);
            """
        )
        if c.execute("SELECT COUNT(*) FROM patients").fetchone()[0] == 0:
            c.execute(
                "INSERT INTO patients (name, age, gender, phone, emergency_contact, medical_conditions)"
                " VALUES (?,?,?,?,?,?)",
                ("Demo Patient", 72, "Male", "9999999999", "Family Member - 8888888888", "Hypertension"),
            )


# ---------- patients ----------
def list_patients() -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM patients ORDER BY id")]


def get_patient(pid: int) -> Optional[dict]:
    with conn() as c:
        r = c.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
        return dict(r) if r else None


def create_patient(data: dict) -> dict:
    with conn() as c:
        cur = c.execute(
            "INSERT INTO patients (name, age, gender, phone, emergency_contact, medical_conditions)"
            " VALUES (:name,:age,:gender,:phone,:emergency_contact,:medical_conditions)",
            data,
        )
        pid = cur.lastrowid
    return get_patient(pid)


def update_patient(pid: int, changes: dict) -> Optional[dict]:
    if changes:
        cols = ", ".join(f"{k}=:{k}" for k in changes)
        with conn() as c:
            c.execute(f"UPDATE patients SET {cols} WHERE id=:_id", {**changes, "_id": pid})
    return get_patient(pid)


# ---------- vitals ----------
def insert_vital(pid: int, v: dict, status: str) -> dict:
    ts = now_iso()
    with conn() as c:
        cur = c.execute(
            "INSERT INTO vitals (patient_id, heart_rate, spo2, temperature, systolic_bp,"
            " diastolic_bp, status, timestamp) VALUES (?,?,?,?,?,?,?,?)",
            (pid, v["heart_rate"], v["spo2"], v["temperature"], v["systolic_bp"],
             v["diastolic_bp"], status, ts),
        )
        row = c.execute("SELECT * FROM vitals WHERE id=?", (cur.lastrowid,)).fetchone()
        return dict(row)


def latest_vital(pid: int) -> Optional[dict]:
    with conn() as c:
        r = c.execute(
            "SELECT * FROM vitals WHERE patient_id=? ORDER BY id DESC LIMIT 1", (pid,)
        ).fetchone()
        return dict(r) if r else None


def vital_history(pid: int, start: Optional[str], end: Optional[str], limit: int) -> list[dict]:
    q, args = "SELECT * FROM vitals WHERE patient_id=?", [pid]
    if start:
        q += " AND timestamp >= ?"; args.append(start)
    if end:
        q += " AND timestamp <= ?"; args.append(end)
    q += " ORDER BY id DESC LIMIT ?"; args.append(limit)
    with conn() as c:
        rows = [dict(r) for r in c.execute(q, args)]
    return list(reversed(rows))  # oldest -> newest (chart friendly)


# ---------- alerts ----------
def _alert(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["acknowledged"] = bool(d["acknowledged"])
    return d


def insert_alert(pid: int, vital_id: Optional[int], a: dict) -> dict:
    with conn() as c:
        cur = c.execute(
            "INSERT INTO alerts (patient_id, vital_id, type, severity, message, timestamp)"
            " VALUES (?,?,?,?,?,?)",
            (pid, vital_id, a["type"], a["severity"], a["message"], now_iso()),
        )
        return _alert(c.execute("SELECT * FROM alerts WHERE id=?", (cur.lastrowid,)).fetchone())


def list_alerts(pid: Optional[int], severity: Optional[str],
                acknowledged: Optional[bool], limit: int) -> list[dict]:
    q, args = "SELECT * FROM alerts WHERE 1=1", []
    if pid is not None:
        q += " AND patient_id=?"; args.append(pid)
    if severity:
        q += " AND severity=?"; args.append(severity)
    if acknowledged is not None:
        q += " AND acknowledged=?"; args.append(int(acknowledged))
    q += " ORDER BY id DESC LIMIT ?"; args.append(limit)
    with conn() as c:
        return [_alert(r) for r in c.execute(q, args)]


def acknowledge_alert(aid: int) -> Optional[dict]:
    with conn() as c:
        c.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (aid,))
        r = c.execute("SELECT * FROM alerts WHERE id=?", (aid,)).fetchone()
        return _alert(r) if r else None


# ---------- settings ----------
def get_settings() -> Optional[dict]:
    with conn() as c:
        r = c.execute("SELECT data FROM settings WHERE id=1").fetchone()
        return json.loads(r["data"]) if r else None


def save_settings(data: dict) -> dict:
    with conn() as c:
        c.execute(
            "INSERT INTO settings (id, data) VALUES (1, ?) "
            "ON CONFLICT(id) DO UPDATE SET data=excluded.data",
            (json.dumps(data),),
        )
    return data
