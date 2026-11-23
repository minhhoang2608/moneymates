import importlib
from pathlib import Path

import dj_database_url
import pytest
from django.core.exceptions import ImproperlyConfigured
from rest_framework.test import APIClient

from config import settings

README = Path(__file__).resolve().parents[2] / "README.md"
PG = "postgres://u:p@localhost:5432/db"


def load(monkeypatch, **env):
    monkeypatch.setenv("DJANGO_SECRET_KEY", "real-key")
    for k in ("DATABASE_URL", "CACHE_BACKEND", "DJANGO_DEBUG", "ALLOWED_HOSTS"):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        if v is None:
            monkeypatch.delenv(k, raising=False)
        else:
            monkeypatch.setenv(k, v)
    return importlib.reload(settings)


@pytest.fixture(autouse=True)
def restore():
    yield
    importlib.reload(settings)


def test_psycopg_importable():
    import psycopg  # noqa: F401

    assert dj_database_url.parse(PG)["ENGINE"] == "django.db.backends.postgresql"


def test_cache_db_with_postgres_url(monkeypatch):
    c = load(monkeypatch, DATABASE_URL=PG).CACHES["default"]
    assert c["BACKEND"].endswith("DatabaseCache")
    assert c["LOCATION"] == "django_cache"


def test_cache_db_when_forced(monkeypatch):
    c = load(monkeypatch, CACHE_BACKEND="db", DATABASE_URL="sqlite:///x.db").CACHES
    assert c["default"]["BACKEND"].endswith("DatabaseCache")


@pytest.mark.parametrize(
    "env", [{}, {"DATABASE_URL": "sqlite:///x.db"}, {"DATABASE_URL": PG, "CACHE_BACKEND": "locmem"}]
)
def test_cache_locmem(monkeypatch, env):
    c = load(monkeypatch, **env).CACHES["default"]
    assert c["BACKEND"].endswith("LocMemCache")


def test_rejects_change_me_when_not_debug(monkeypatch):
    monkeypatch.setenv("DJANGO_SECRET_KEY", "change-me")
    monkeypatch.delenv("DJANGO_DEBUG", raising=False)
    try:
        with pytest.raises(ImproperlyConfigured):
            importlib.reload(settings)
    finally:
        monkeypatch.undo()
        importlib.reload(settings)


def test_debug_defaults_off_and_real_key_loads(monkeypatch):
    assert load(monkeypatch).DEBUG is False


def test_allowed_hosts_csv(monkeypatch):
    m = load(monkeypatch, ALLOWED_HOSTS="api.example.com, www.example.com ,")
    assert m.ALLOWED_HOSTS == ["api.example.com", "www.example.com"]


def test_renderers_json_only():
    assert settings.REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] == [
        "rest_framework.renderers.JSONRenderer"
    ]
    assert "django.contrib.staticfiles" not in settings.INSTALLED_APPS


@pytest.mark.django_db
def test_health_browser_accept_returns_json():
    r = APIClient().get("/health", HTTP_ACCEPT="text/html,application/xhtml+xml,*/*;q=0.8")
    assert r.status_code == 200
    assert r["Content-Type"].startswith("application/json")


def test_readme_deploy_section_order():
    t = README.read_text()
    assert "Deploy on Hawk Host" in t
    t = t[t.index("Deploy on Hawk Host") :]
    keys = [
        "config/wsgi.py",
        "application",
        "requirements.txt",
        ".env.example",
        "migrate",
        "createcachetable",
        "tmp/restart.txt",
        "/health",
    ]
    idx = [t.index(k) for k in keys]
    assert idx == sorted(idx)
    assert "localhost" in t and "URL-encode" in t
