import os
import tempfile

os.environ["ELDERLYCARE_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app import monitoring  # noqa: E402


def test_all():
    with TestClient(app) as c:
        assert c.get("/api/health").json() == {"status": "ok"}

        # patients
        assert len(c.get("/api/patients").json()) == 1
        assert c.get("/api/patients/999").status_code == 404
        r = c.put("/api/patients/1", json={"age": 73})
        assert r.status_code == 200 and r.json()["age"] == 73
        assert c.post("/api/patients", json={"name": "", "age": 200}).status_code == 422
        assert c.post("/api/patients", json={"name": "Ram", "age": 80, "gender": "Male"}).status_code == 201

        # vitals + alerts
        assert c.get("/api/vitals/1/latest").status_code == 404
        n = c.post("/api/vitals/1/simulate?scenario=normal").json()
        assert n["status"] == "normal" and n["alerts"] == []
        w = c.post("/api/vitals/1/simulate?scenario=warning").json()
        assert w["status"] in ("warning", "critical") and w["alerts"]
        k = c.post("/api/vitals/1/simulate?scenario=critical").json()
        assert k["status"] == "critical"
        assert c.post("/api/vitals/1/simulate?scenario=bad").status_code == 422
        assert c.post("/api/vitals/99/simulate").status_code == 404
        assert c.get("/api/vitals/1/latest").json()["id"] == k["id"]
        h = c.get("/api/vitals/1/history?limit=2").json()
        assert len(h) == 2 and h[0]["id"] < h[1]["id"]

        alerts = c.get("/api/alerts?patient_id=1&severity=critical").json()
        assert alerts
        a = c.patch(f"/api/alerts/{alerts[0]['id']}/acknowledge").json()
        assert a["acknowledged"] is True
        assert c.patch("/api/alerts/9999/acknowledge").status_code == 404

        # settings
        s = c.get("/api/settings").json()
        s["refresh_interval_sec"] = 10
        assert c.put("/api/settings", json=s).json()["refresh_interval_sec"] == 10


def test_rules():
    st, al = monitoring.evaluate_vitals(
        {"heart_rate": 80, "spo2": 98, "temperature": 36.8, "systolic_bp": 118, "diastolic_bp": 76})
    assert st == "normal" and not al
    st, _ = monitoring.evaluate_vitals(
        {"heart_rate": 130, "spo2": 98, "temperature": 36.8, "systolic_bp": 118, "diastolic_bp": 76})
    assert st == "critical"
