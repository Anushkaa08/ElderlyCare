from app.monitoring import generate_vitals, evaluate_vitals


def test_normal_scenario():
    vitals = generate_vitals("normal")
    status, alerts = evaluate_vitals(vitals)

    assert status == "normal"
    assert alerts == []


def test_warning_scenario():
    vitals = generate_vitals("warning")
    status, alerts = evaluate_vitals(vitals)

    assert status in ["warning", "critical"]
    assert len(alerts) > 0


def test_critical_scenario():
    vitals = generate_vitals("critical")
    status, alerts = evaluate_vitals(vitals)

    assert status == "critical"
    assert len(alerts) > 0