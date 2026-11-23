import importlib
from pathlib import Path

import pytest

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
        with pytest.raises(RuntimeError):
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
