"""Contract check: the mobile bill fixture (single source of truth) matches the endpoint."""

import json
from pathlib import Path

import pytest

from .conftest import JPEG, reply

FIXTURE = Path(__file__).resolve().parents[4] / "apps" / "mobile" / "e2e" / "fixtures" / "bill.json"
DATA = json.loads(FIXTURE.read_text(encoding="utf-8"))
CONTRACT = DATA["contract"]
RESPONSE = DATA["response"]
CATEGORIES = [RESPONSE["category"], "Khác"]


def _model_output():
    return {k: v for k, v in RESPONSE.items() if k != "currency"}


def test_app_shaped_request_accepted(post_bill, fake):
    fake.script["m1"] = reply(_model_output())
    assert CONTRACT["path"] == "/ai/parse-bill"
    r = post_bill(
        image=JPEG,
        categories=json.dumps(CATEGORIES),
        name=CONTRACT["imageName"],
    )
    assert r.status_code == 200


@pytest.mark.parametrize("which", ["device", "secret"])
def test_missing_device_or_secret_rejected(post_bill, which):
    kwargs = {"device": None} if which == "device" else {"secret": None}
    r = post_bill(categories=json.dumps(CATEGORIES), **kwargs)
    assert r.status_code in (400, 401)


def test_view_response_keys_match_fixture(post_bill, fake):
    fake.script["m1"] = reply(_model_output())
    body = post_bill(categories=json.dumps(CATEGORIES)).json()
    assert body == RESPONSE
    assert sorted(body) == sorted(CONTRACT["responseKeys"])
    assert isinstance(body["amount"], int)


def test_all_null_matches_nullable_contract(post_bill, fake):
    fake.script["m1"] = reply({"amount": None, "shop": None, "date": None, "category": None})
    body = post_bill(categories=json.dumps(CATEGORIES)).json()
    assert sorted(body) == sorted(CONTRACT["responseKeys"])
    assert body["currency"] == "VND"
    assert all(v is None for k, v in body.items() if k != "currency")
