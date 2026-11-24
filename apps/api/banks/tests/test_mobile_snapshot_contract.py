import json
from pathlib import Path

SNAPSHOT = (
    Path(__file__).resolve().parents[4]
    / "apps"
    / "mobile"
    / "src"
    / "lib"
    / "vietqr"
    / "bankApps.snapshot.json"
)


def _shape(value):
    if isinstance(value, dict):
        return {k: _shape(v) for k, v in value.items()}
    return type(value).__name__


def test_mobile_snapshot_matches_live_response_shape(get):
    live = get().json()
    snap = json.loads(SNAPSHOT.read_text())
    assert set(snap) == set(live)
    assert type(snap["stale"]) is type(live["stale"])
    assert type(snap["updated_at"]) is type(live["updated_at"])
    live_app = next(a for a in live["apps"] if a["app_id"] == "mb")
    for app in snap["apps"]:
        assert set(app) == set(live_app)
        assert set(app["autofill"]) == set(live_app["autofill"])
        assert all(isinstance(v, bool) for v in app["autofill"].values())
        for key in ("logo", "bank_code", "bin", "ios_scheme", "android_package"):
            assert app[key] is None or isinstance(app[key], str)
