import httpx
import pytest

from core import views as core_views

from .conftest import GOOD, SECRET, reply


def test_valid_request_returns_parsed_json(post, fake):
    r = post()
    assert r.status_code == 200
    assert r.json() == {
        "amount": 200000,
        "currency": "VND",
        "note": "Tiền xăng",
        "category": "Di chuyển",
        "payer": "Bình",
    }


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": ""},
        {"text": "   "},
        {"text": 5},
        {"text": "x" * 501},
        {"text": "a", "categories": "Ăn uống"},
        {"text": "a", "members": [1, {}]},
    ],
)
def test_invalid_input_400(post, fake, body):
    r = post(body)
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_input"}
    assert fake.calls == []


def test_members_optional(post, fake):
    fake.script["m1"] = reply({**GOOD, "payer": "Bình"})
    r = post({"text": "xăng 200k"})
    assert r.status_code == 200
    assert r.json()["payer"] is None
    assert r.json()["category"] is None


def test_custom_category_selected(post, fake):
    fake.script["m1"] = reply({**GOOD, "category": "Cà phê"})
    assert post().json()["category"] == "Cà phê"


def test_category_match_is_case_insensitive_and_uses_request_spelling(post, fake):
    fake.script["m1"] = reply({**GOOD, "category": "cà phê"})
    assert post().json()["category"] == "Cà phê"


def test_unknown_category_becomes_null(post, fake):
    fake.script["m1"] = reply({**GOOD, "category": "Du lịch"})
    assert post().json()["category"] is None


def test_unknown_payer_becomes_null(post, fake):
    fake.script["m1"] = reply({**GOOD, "payer": "Zed"})
    assert post().json()["payer"] is None


def test_null_fields_pass_through(post, fake):
    fake.script["m1"] = reply({"amount": None, "note": None, "category": None, "payer": None})
    assert post().json() == {
        "amount": None,
        "currency": "VND",
        "note": None,
        "category": None,
        "payer": None,
    }


@pytest.mark.parametrize(
    "raw,expected",
    [
        (200000.0, 200000),
        ("200000", 200000),
        (200000.4, 200000),
        ("1500.5", 1501),
        (9007199254740993, 9007199254740993),
        ("9007199254740993", 9007199254740993),
        (-5, None),
        ("abc", None),
    ],
)
def test_amount_float_or_string_coerced_to_int(post, fake, raw, expected):
    fake.script["m1"] = reply({**GOOD, "amount": raw})
    amount = post().json()["amount"]
    assert amount == expected
    assert amount is None or type(amount) is int


def test_note_is_capped(post, fake):
    fake.script["m1"] = reply({**GOOD, "note": "  " + "a" * 300})
    assert len(post().json()["note"]) == 100


def test_wrong_or_missing_app_secret_401(post, fake):
    for secret in ("wrong", None, ""):
        r = post(secret=secret)
        assert r.status_code == 401
        assert r.json() == {"error": "unauthorized"}
    assert fake.calls == []


def test_empty_server_secret_rejects_everything(post, fake, settings):
    settings.APP_SHARED_SECRET = ""
    assert post(secret="").status_code == 401


def test_feature_flag_off_403_ai_disabled(post, fake, monkeypatch):
    for flag in ("ai_enabled", "ai_parse_text"):
        monkeypatch.setattr(core_views, "FEATURES", {"ai_enabled": True, "ai_parse_text": True})
        core_views.FEATURES[flag] = False
        monkeypatch.setattr("ai.views.FEATURES", core_views.FEATURES)
        r = post()
        assert r.status_code == 403
        assert r.json() == {"error": "ai_disabled"}
    assert fake.calls == []


def test_openrouter_never_really_called(post):
    # The autouse guard fails on any real send; a normal request must still pass.
    assert post().status_code == 200
    assert httpx.Client.send is not None


def test_env_example_has_placeholders_only():
    from pathlib import Path

    text = (Path(__file__).resolve().parents[2] / ".env.example").read_text()
    values = dict(line.split("=", 1) for line in text.splitlines() if "=" in line)
    for key in ("OPENROUTER_API_KEY", "APP_SHARED_SECRET"):
        assert values[key] == ""
    for key in ("OPENROUTER_TIMEOUT_S", "AI_LIMIT_PER_MINUTE", "AI_LIMIT_PER_DAY"):
        assert key in values
    assert SECRET not in text
