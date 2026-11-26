from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path
import joblib
import pandas as pd

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "cardio_model.pkl"

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
features = bundle["features"]


class HealthData(BaseModel):
    age: float
    gender: int
    height: float
    weight: float
    ap_hi: float
    ap_lo: float
    cholesterol: int
    gluc: int
    smoke: int
    alco: int
    active: int


@router.post("/predict")
def predict(data: HealthData):
    input_data = pd.DataFrame(
        [data.model_dump()],
        columns=features
    )

    prediction = int(model.predict(input_data)[0])
    probabilities = model.predict_proba(input_data)[0]

    return {
        "prediction": prediction,
        "class_label": (
            "Cardiovascular disease class predicted"
            if prediction == 1
            else "No cardiovascular disease class predicted"
        ),
        "probabilities": {
            "class_0": round(float(probabilities[0]), 4),
            "class_1": round(float(probabilities[1]), 4)
        },
        "model": "Random Forest",
        "notice": "Research prototype prediction, not a medical diagnosis."
    }