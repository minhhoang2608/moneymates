import httpx
from django.core.cache import cache

from banks.service import FRESH

from .conftest import status


def test_response_matches_contract(get, fake):
    resp = get()
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"updated_at", "stale", "apps"}
    assert body["stale"] is False
    assert body["updated_at"].endswith("Z")
    mb = next(a for a in body["apps"] if a["app_id"] == "mb")
    assert set(mb) == {
        "app_id",
        "name",
        "logo",
        "bank_code",
        "bin",
        "autofill",
        "ios_scheme",
        "android_package",
    }
    assert mb["autofill"] == {"android": True, "ios": False}
    assert mb["bin"] == "970422"


def test_second_request_within_ttl_uses_cache(get, fake):
    get()
    assert len(fake.calls) == 3
    resp = get()
    assert resp.status_code == 200
    assert len(fake.calls) == 3


def test_expired_ttl_and_vietqr_timeout_serves_last_good_stale(get, fake):
    first = get().json()
    cache.delete(FRESH)
    fake.fail = httpx.ReadTimeout("slow")
    body = get().json()
    assert body["stale"] is True
    assert body["apps"] == first["apps"]
    assert body["updated_at"] == first["updated_at"]


def test_expired_ttl_and_vietqr_5xx_serves_last_good_stale(get, fake):
    get()
    cache.delete(FRESH)
    fake.fail = status(500)
    assert get().json()["stale"] is True


def test_vietqr_down_and_empty_cache_returns_503(get, fake):
    fake.fail = httpx.ConnectError("down")
    resp = get()
    assert resp.status_code == 503
    assert resp.json() == {"error": "banks_unavailable"}


def test_malformed_payload_counts_as_failure(get, fake):
    fake.routes["/v2/banks"] = "oops"
    assert get().status_code == 503


def test_empty_app_list_counts_as_failure(get, fake):
    fake.routes["/v2/android-app-deeplinks"] = {"apps": []}
    fake.routes["/v2/ios-app-deeplinks"] = {"apps": []}
    assert get().status_code == 503


def test_failed_refresh_is_not_cached(get, fake):
    fake.fail = status(500)
    assert get().status_code == 503
    fake.fail = None
    assert get().status_code == 200


def test_missing_or_wrong_secret_401(get, fake):
    assert get(secret=None).status_code == 401
    assert get(secret="nope").status_code == 401
    assert get(secret=None).json() == {"error": "unauthorized"}
    assert fake.calls == []


def test_missing_device_id_401(get, fake):
    assert get(device=None).status_code == 401


def _break_cache(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("cache down")

    monkeypatch.setattr(cache, "get", boom)
    monkeypatch.setattr(cache, "set", boom)


def test_cache_down_fetches_live(get, fake, monkeypatch):
    _break_cache(monkeypatch)
    resp = get()
    assert resp.status_code == 200
    assert len(fake.calls) == 3


def test_cache_down_and_vietqr_down_503(get, fake, monkeypatch):
    _break_cache(monkeypatch)
    fake.fail = httpx.ConnectError("down")
    resp = get()
    assert resp.status_code == 503
    assert resp.json()["error"] == "banks_unavailable"
