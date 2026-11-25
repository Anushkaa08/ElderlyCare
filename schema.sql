-- ElderlyCare - Database Schema (SQLite)
-- Module: Database & Health History
-- Timestamps: stored in UTC, ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)


PRAGMA foreign_keys = ON;


-- 1. PATIENTS

CREATE TABLE IF NOT EXISTS patients (
    patient_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    age             INTEGER NOT NULL CHECK (age BETWEEN 0 AND 130),
    gender          TEXT    NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    contact         TEXT    NOT NULL,
    address         TEXT,
    medical_history TEXT,
    created_at      TEXT    NOT NULL
                    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);


-- 2. VITAL_READINGS

CREATE TABLE IF NOT EXISTS vital_readings (
    reading_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id    INTEGER NOT NULL,
    heart_rate    INTEGER NOT NULL,
    spo2          REAL    NOT NULL,
    temperature   REAL    NOT NULL,
    systolic_bp   INTEGER NOT NULL,
    diastolic_bp  INTEGER NOT NULL,
    status        TEXT    NOT NULL
                  CHECK (status IN ('Normal', 'Warning', 'Critical')),
    recorded_at   TEXT    NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


-- 3. ALERTS

CREATE TABLE IF NOT EXISTS alerts (
    alert_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id  INTEGER NOT NULL,
    reading_id  INTEGER,
    alert_type  TEXT    NOT NULL
                CHECK (alert_type IN ('HEART_RATE', 'SPO2', 'TEMPERATURE',
                                      'BLOOD_PRESSURE', 'MULTIPLE_VITALS')),
    severity    TEXT    NOT NULL
                CHECK (severity IN ('WARNING', 'CRITICAL')),
    message     TEXT    NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0
                CHECK (is_read IN (0, 1)),
    created_at  TEXT    NOT NULL
                DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    FOREIGN KEY (patient_id) REFERENCES patients (patient_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (reading_id) REFERENCES vital_readings (reading_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);


-- INDEXES (history retrieval)

-- A patient's readings, newest first / within a date range
CREATE INDEX IF NOT EXISTS idx_readings_patient_time
    ON vital_readings (patient_id, recorded_at DESC);

-- Readings across all patients within a time window (daily/weekly trends)
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at
    ON vital_readings (recorded_at);

-- A patient's alerts, newest first
CREATE INDEX IF NOT EXISTS idx_alerts_patient_time
    ON alerts (patient_id, created_at DESC);

-- Unread alerts (notification badge)
CREATE INDEX IF NOT EXISTS idx_alerts_unread
    ON alerts (is_read, created_at DESC);

-- Alerts linked to a specific reading
CREATE INDEX IF NOT EXISTS idx_alerts_reading
    ON alerts (reading_id);