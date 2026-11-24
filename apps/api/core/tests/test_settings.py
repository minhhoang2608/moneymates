import importlib
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

from config import settings

ENV_EXAMPLE = Path(__file__).resolve().parents[2] / ".env.example"


def test_settings_secret_from_env(monkeypatch):
    monkeypatch.setenv("DJANGO_SECRET_KEY", "from-env-value")
    try:
        assert importlib.reload(settings).SECRET_KEY == "from-env-value"
    finally:
        monkeypatch.undo()
        importlib.reload(settings)


def test_settings_requires_secret_when_not_debug(monkeypatch):
    monkeypatch.delenv("DJANGO_SECRET_KEY")
    monkeypatch.setenv("DJANGO_DEBUG", "0")
    try:
        with pytest.raises(ImproperlyConfigured):
            importlib.reload(settings)
    finally:
        monkeypatch.undo()
        importlib.reload(settings)


def test_example_env_file_has_only_placeholders():
    values = dict(
        line.split("=", 1) for line in ENV_EXAMPLE.read_text().splitlines() if "=" in line
    )
    for key in (
        "DJANGO_SECRET_KEY",
        "OPENROUTER_API_KEY",
        "OPENROUTER_MODELS",
        "APP_SHARED_SECRET",
    ):
        assert key in values
    assert values["OPENROUTER_API_KEY"] == ""
    assert values["APP_SHARED_SECRET"] == ""
    assert values["DJANGO_SECRET_KEY"] == "change-me"
    assert values["DATABASE_URL"].startswith("postgres://")


def _reload_with(monkeypatch, **env):
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    return importlib.reload(settings)


def test_postgres_gets_connect_timeout(monkeypatch):
    try:
        s = _reload_with(monkeypatch, DATABASE_URL="postgres://u:p@h:5432/d")
        assert s.DATABASES["default"]["OPTIONS"]["connect_timeout"] == 5
        s = _reload_with(monkeypatch, DB_CONNECT_TIMEOUT_S="2")
        assert s.DATABASES["default"]["OPTIONS"]["connect_timeout"] == 2
        s = _reload_with(monkeypatch, DATABASE_URL="postgres://u:p@h:5432/d?connect_timeout=9")
        assert s.DATABASES["default"]["OPTIONS"]["connect_timeout"] == 9
    finally:
        monkeypatch.undo()
        importlib.reload(settings)


def test_sqlite_has_no_connect_timeout(monkeypatch):
    try:
        s = _reload_with(monkeypatch, DATABASE_URL="sqlite:///x.sqlite3")
        assert "connect_timeout" not in s.DATABASES["default"].get("OPTIONS", {})
    finally:
        monkeypatch.undo()
        importlib.reload(settings)


def test_db_cache_is_culled(monkeypatch):
    try:
        s = _reload_with(monkeypatch, CACHE_BACKEND="db")
        opts = s.CACHES["default"]["OPTIONS"]
        assert opts["MAX_ENTRIES"] == 1000
        assert opts["CULL_FREQUENCY"] == 3
    finally:
        monkeypatch.undo()
        importlib.reload(settings)
