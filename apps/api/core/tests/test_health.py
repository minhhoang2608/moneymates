from rest_framework.test import APIClient


def test_health_returns_ok():
    r = APIClient().get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_trailing_slash():
    assert APIClient().get("/health/").status_code == 200
