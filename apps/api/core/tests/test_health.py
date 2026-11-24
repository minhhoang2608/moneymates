import pytest
from rest_framework.test import APIClient


def test_health_returns_ok():
    r = APIClient().get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_trailing_slash():
    assert APIClient().get("/health/").status_code == 200


def test_health_db_ok(db):
    r = APIClient().get("/health?db=1")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok"}


def test_health_db_down_503_without_details(monkeypatch):
    from django.db import OperationalError, connection

    def boom(*a, **k):
        raise OperationalError("secret host details")

    monkeypatch.setattr(connection, "cursor", boom)
    r = APIClient().get("/health?db=1")
    assert r.status_code == 503
    assert r.json() == {"status": "error", "db": "error"}


@pytest.mark.django_db
def test_plain_health_runs_no_queries(django_assert_num_queries):
    with django_assert_num_queries(0):
        assert APIClient().get("/health").status_code == 200
