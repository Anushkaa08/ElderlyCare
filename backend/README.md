# ElderlyCare – Backend (Member 2: FastAPI)

Hardware-free elderly health monitoring. Vitals are **simulated**.

## Run
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows   (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- API docs (Swagger): http://localhost:8000/docs
- Test: `pytest -q`
- SQLite file `elderlycare.db` auto-creates on first start (with 1 demo patient). Change path with env `ELDERLYCARE_DB`.

## Endpoints
| Method | URL | Purpose |
|---|---|---|
| GET | /api/health | health check |
| GET / POST | /api/patients | list / create patient |
| GET / PUT | /api/patients/{id} | profile / update |
| POST | /api/vitals/{id}/simulate?scenario=normal\|warning\|critical | generate + store reading, create alerts |
| GET | /api/vitals/{id}/latest | latest stored reading |
| GET | /api/vitals/{id}/history?start=&end=&limit= | history (oldest→newest, for charts) |
| GET | /api/alerts?patient_id=&severity=&acknowledged=&limit= | alerts list |
| PATCH | /api/alerts/{id}/acknowledge | mark alert read |
| GET / PUT | /api/settings | thresholds / preferences |

Vital fields: `heart_rate, spo2, temperature, systolic_bp, diastolic_bp, status, timestamp`.

## Structure & integration
```
app/main.py        app + CORS + error handlers
app/schemas.py     validation models
app/routers/       patients, vitals, alerts, settings
app/monitoring.py  <- Member 3 plugs in here: generate_vitals(scenario), evaluate_vitals(v)
app/database.py    <- Member 4 plugs in here (SQLite functions used by routers)
tests/test_api.py
```
Routers never touch SQL or rules directly, so Member 3/4 only replace those two files
(keep function names + return shapes).

## Frontend (Member 1)
CORS allows `localhost:5173` (Vite) and `localhost:3000`. Base URL: `http://localhost:8000`.
For live dashboard: call `POST /api/vitals/1/simulate` every few seconds (interval = settings.refresh_interval_sec),
then show returned reading + `alerts`.
