import pandas as pd
import numpy as np
import os
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# Dataset path
DATA_PATH = "data/cardio_train.csv"

# Load dataset (Kaggle dataset uses semicolon separator)
df = pd.read_csv(DATA_PATH, sep=";")

print("Dataset loaded:", df.shape)
print(df.head())

# Convert age from days to years
df["age"] = (df["age"] / 365.25).round(2)

# Remove invalid values
df = df[
    (df["ap_hi"] > 0) &
    (df["ap_lo"] > 0) &
    (df["ap_hi"] > df["ap_lo"]) &
    (df["height"] > 100) &
    (df["height"] < 250) &
    (df["weight"] > 30) &
    (df["weight"] < 300)
].copy()

# Features
features = [
    "age",
    "gender",
    "height",
    "weight",
    "ap_hi",
    "ap_lo",
    "cholesterol",
    "gluc",
    "smoke",
    "alco",
    "active"
]

X = df[features]
y = df["cardio"]

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=3,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)

# Evaluation
predictions = model.predict(X_test)

print("\n========== MODEL RESULTS ==========")
print("Accuracy:", round(accuracy_score(y_test, predictions) * 100, 2), "%")
print("\nClassification Report:\n")
print(classification_report(y_test, predictions))
print("\nConfusion Matrix:\n")
print(confusion_matrix(y_test, predictions))

# Save model
os.makedirs("models", exist_ok=True)

joblib.dump(
    {
        "model": model,
        "features": features
    },
    "models/cardio_model.pkl"
)

print("\nModel saved at backend/models/cardio_model.pkl")