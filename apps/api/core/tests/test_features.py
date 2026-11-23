from rest_framework.test import APIClient


def test_features_flags_all_true():
    r = APIClient().get("/me/features")
    assert r.status_code == 200
    data = r.json()
    for key in ("ai_enabled", "ai_parse_text", "ai_parse_bill"):
        assert data[key] is True


def test_features_trailing_slash():
    assert APIClient().get("/me/features/").status_code == 200


def test_features_no_db_no_auth():
    # No django_db mark: pytest-django raises if the view touches the database.
    assert APIClient().get("/me/features").status_code == 200


def test_features_post_not_allowed():
    assert APIClient().post("/me/features").status_code == 405
