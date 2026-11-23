import json

import httpx
import pytest

from core import views as core_views

from .conftest import BILL, JPEG, reply


@pytest.fixture(autouse=True)
def _bill_reply(fake):
    fake.script["m1"] = reply(BILL)


def test_valid_bill(post_bill, fake):
    r = post_bill(categories=json.dumps(["Ăn uống", "Cà phê"]))
    assert r.status_code == 200
    assert r.json() == {
        "amount": 345000,
        "currency": "VND",
        "shop": "Bánh căn Nhà Chung",
        "date": "2026-11-22",
        "category": "Ăn uống",
    }


@pytest.mark.parametrize("amount", ["345000", 345000.0])
def test_amount_coerced_to_int(post_bill, fake, amount):
    fake.script["m1"] = reply({**BILL, "amount": amount})
    amt = post_bill().json()["amount"]
    assert amt == 345000 and isinstance(amt, int)


def test_all_null(post_bill, fake):
    fake.script["m1"] = reply({"amount": None, "shop": None, "date": None, "category": None})
    r = post_bill(categories=json.dumps(["Ăn uống"]))
    assert r.json() == {
        "amount": None,
        "currency": "VND",
        "shop": None,
        "date": None,
        "category": None,
    }


@pytest.mark.parametrize("bad", ["22/11/2026", "2026-13-01", 5])
def test_bad_date_null(post_bill, fake, bad):
    fake.script["m1"] = reply({**BILL, "date": bad})
    assert post_bill().json()["date"] is None


def test_negative_amount_null(post_bill, fake):
    fake.script["m1"] = reply({**BILL, "amount": -5})
    assert post_bill().json()["amount"] is None


def test_image_sent_as_data_url_to_vision_models(post_bill, fake, settings, monkeypatch):
    settings.OPENROUTER_VISION_MODELS = ["v1"]
    seen = {}

    def spy(url, **kw):
        seen.update(kw["json"])
        r = reply(BILL)
        r.request = httpx.Request("POST", url)
        return r

    monkeypatch.setattr(httpx, "post", spy)
    assert post_bill().status_code == 200
    assert seen["model"] == "v1"
    part = seen["messages"][1]["content"][1]
    assert part["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_category_picked_from_list(post_bill, fake):
    fake.script["m1"] = reply({**BILL, "category": "Cà phê"})
    assert post_bill(categories=json.dumps(["Ăn uống", "Cà phê"])).json()["category"] == "Cà phê"


def test_unknown_or_missing_categories_null(post_bill, fake):
    fake.script["m1"] = reply({**BILL, "category": "Du lịch"})
    assert post_bill(categories=json.dumps(["Ăn uống"])).json()["category"] is None
    assert post_bill().json()["category"] is None


def test_fallback_to_second_model(post_bill, fake):
    fake.script["m1"] = httpx.TimeoutException("t")
    assert post_bill().status_code == 200
    assert fake.calls == ["m1", "m2"]


def test_malformed_json_tries_next(post_bill, fake):
    fake.script["m1"] = reply("not json")
    assert post_bill().status_code == 200
    assert fake.calls == ["m1", "m2"]


def test_all_models_fail_502(post_bill, fake):
    fake.script["m1"] = httpx.TimeoutException("t")
    fake.script["m2"] = httpx.Response(500, json={})
    r = post_bill()
    assert r.status_code == 502
    assert r.json() == {"error": "ai_unavailable"}


def test_quota(post_bill, fake, settings):
    settings.AI_LIMIT_PER_MINUTE = 1
    assert post_bill().status_code == 200
    n = len(fake.calls)
    r = post_bill()
    assert r.status_code == 429
    assert r.json() == {"error": "quota_exceeded"}
    assert len(fake.calls) == n


@pytest.mark.parametrize("flag", ["ai_parse_bill", "ai_enabled"])
def test_flag_disabled(post_bill, fake, monkeypatch, flag):
    monkeypatch.setitem(core_views.FEATURES, flag, False)
    r = post_bill()
    assert r.status_code == 403
    assert r.json() == {"error": "ai_disabled"}
    assert fake.calls == []


@pytest.mark.parametrize(
    "kwargs",
    [
        {"image": JPEG + b"\x00" * 1_600_000},
        {"image": b"%PDF-1.4 hello"},
        {"image": b"just text", "name": "bill.jpg"},
        {"image": None},
        {"categories": "not json"},
        {"categories": json.dumps({"a": 1})},
        {"categories": json.dumps([1])},
        {"device": None},
    ],
)
def test_invalid_input(post_bill, fake, kwargs):
    r = post_bill(**kwargs)
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_input"}
    assert fake.calls == []


def test_wrong_secret_401(post_bill, fake):
    r = post_bill(secret="nope")
    assert r.status_code == 401
    assert r.json() == {"error": "unauthorized"}
    assert fake.calls == []
