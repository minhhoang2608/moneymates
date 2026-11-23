from .conftest import BODY


def test_minute_limit_429_quota_exceeded(post, fake, settings):
    settings.AI_LIMIT_PER_MINUTE = 2
    assert post().status_code == 200
    assert post().status_code == 200
    r = post()
    assert r.status_code == 429
    assert r.json() == {"error": "quota_exceeded"}
    assert len(fake.calls) == 2


def test_day_limit_429(post, settings):
    settings.AI_LIMIT_PER_DAY = 1
    assert post().status_code == 200
    r = post()
    assert r.status_code == 429
    assert r.json() == {"error": "quota_exceeded"}


def test_limit_is_per_device(post, settings):
    settings.AI_LIMIT_PER_MINUTE = 1
    assert post(device="a").status_code == 200
    assert post(device="a").status_code == 429
    assert post(device="b").status_code == 200


def test_missing_device_id_400(post, fake):
    r = post(device=None)
    assert r.status_code == 400
    assert r.json() == {"error": "invalid_input"}
    assert fake.calls == []


def test_invalid_input_does_not_consume_quota(post, settings):
    settings.AI_LIMIT_PER_MINUTE = 1
    assert post({"text": ""}).status_code == 400
    assert post(BODY).status_code == 200
