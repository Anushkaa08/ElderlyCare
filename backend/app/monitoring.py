"""
Monitoring adapter  (Member 3 integration point)
------------------------------------------------
Backend only calls these two functions:
    generate_vitals(scenario) -> dict
    evaluate_vitals(vitals)   -> (status, [alert dicts])

This file contains a simple working version so the backend runs standalone.
When Member 3's engine is ready, replace the bodies (keep the signatures/return shape).
"""
import random

ALERT_KEYS = ("type", "severity", "message")


def generate_vitals(scenario: str = "normal") -> dict:
    r = random.Random()
    if scenario == "critical":
        return {
            "heart_rate": r.choice([r.randint(35, 48), r.randint(125, 150)]),
            "spo2": r.randint(82, 89),
            "temperature": round(r.uniform(38.6, 40.2), 1),
            "systolic_bp": r.choice([r.randint(165, 195), r.randint(70, 78)]),
            "diastolic_bp": r.randint(102, 120),
        }
    if scenario == "warning":
        return {
            "heart_rate": r.choice([r.randint(52, 59), r.randint(101, 118)]),
            "spo2": r.randint(91, 94),
            "temperature": round(r.uniform(37.6, 38.4), 1),
            "systolic_bp": r.randint(130, 155),
            "diastolic_bp": r.randint(85, 98),
        }
    return {
        "heart_rate": r.randint(62, 95),
        "spo2": r.randint(96, 100),
        "temperature": round(r.uniform(36.3, 37.3), 1),
        "systolic_bp": r.randint(105, 125),
        "diastolic_bp": r.randint(65, 80),
    }


def _rank(level: str) -> int:
    return {"normal": 0, "warning": 1, "critical": 2}[level]


def evaluate_vitals(v: dict) -> tuple[str, list[dict]]:
    alerts: list[dict] = []

    def add(kind, severity, msg):
        alerts.append({"type": kind, "severity": severity, "message": msg})

    hr = v["heart_rate"]
    if hr < 50 or hr > 120:
        add("Heart Rate", "critical", f"Critical heart rate: {hr} bpm")
    elif hr < 60 or hr > 100:
        add("Heart Rate", "warning", f"Abnormal heart rate: {hr} bpm")

    s = v["spo2"]
    if s < 91:
        add("SpO2", "critical", f"Critical oxygen level: {s}%")
    elif s < 95:
        add("SpO2", "warning", f"Low oxygen level: {s}%")

    t = v["temperature"]
    if t > 38.5 or t < 35.0:
        add("Temperature", "critical", f"Critical temperature: {t} °C")
    elif t > 37.5 or t < 36.0:
        add("Temperature", "warning", f"Abnormal temperature: {t} °C")

    sy, di = v["systolic_bp"], v["diastolic_bp"]
    if sy >= 160 or sy < 80 or di >= 100 or di < 50:
        add("Blood Pressure", "critical", f"Critical blood pressure: {sy}/{di} mmHg")
    elif sy >= 130 or sy < 90 or di >= 85 or di < 60:
        add("Blood Pressure", "warning", f"Abnormal blood pressure: {sy}/{di} mmHg")

    status = "normal"
    for a in alerts:
        if _rank(a["severity"]) > _rank(status):
            status = a["severity"]
    return status, alerts
