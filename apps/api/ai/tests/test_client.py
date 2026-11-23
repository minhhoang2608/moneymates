import httpx

from .conftest import GOOD, reply


def _err(status):
    return httpx.Response(status, json={"error": "x"})


def test_fallback_on_timeout(post, fake):
    fake.script["m1"] = httpx.ReadTimeout("slow")
    assert post().status_code == 200
    assert fake.calls == ["m1", "m2"]


def test_fallback_on_network_error(post, fake):
    fake.script["m1"] = httpx.ConnectError("down")
    assert post().status_code == 200


def test_fallback_on_5xx(post, fake):
    fake.script["m1"] = _err(503)
    assert post().status_code == 200
    assert fake.calls == ["m1", "m2"]


def test_fallback_on_429(post, fake):
    fake.script["m1"] = _err(429)
    assert post().status_code == 200


def test_fallback_on_malformed_json(post, fake):
    fake.script["m1"] = reply("not json at all")
    assert post().status_code == 200
    assert fake.calls == ["m1", "m2"]


def test_fallback_on_unexpected_shape(post, fake):
    fake.script["m1"] = httpx.Response(200, json={"nope": 1})
    assert post().status_code == 200


def test_first_model_success_stops(post, fake):
    assert post().status_code == 200
    assert fake.calls == ["m1"]


def test_all_models_fail_502_ai_unavailable(post, fake):
    fake.script["m1"] = httpx.ReadTimeout("slow")
    fake.script["m2"] = _err(500)
    r = post()
    assert r.status_code == 502
    assert r.json() == {"error": "ai_unavailable"}


def test_no_models_configured_502(post, fake, settings):
    settings.OPENROUTER_MODELS = []
    r = post()
    assert r.status_code == 502
    assert r.json() == {"error": "ai_unavailable"}


def test_request_uses_json_mode_and_does_not_leak_key_in_body(post, fake, monkeypatch):
    seen = {}

    def spy(url, **kwargs):
        seen.update(kwargs)
        r = reply(GOOD)
        r.request = httpx.Request("POST", url)
        return r

    monkeypatch.setattr(httpx, "post", spy)
    post()
    assert seen["json"]["response_format"] == {"type": "json_object"}
    assert "test-key" not in str(seen["json"])
    assert seen["timeout"] <= 10
