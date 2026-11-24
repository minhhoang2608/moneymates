import httpx
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

SECRET = "test-secret"
ANDROID = {
    "apps": [
        {"appId": "mb", "appName": "MB Bank", "appLogo": "https://l/mb.png", "autofill": 1},
        {"appId": "momo", "appName": "MoMo", "appLogo": "https://l/momo.png", "autofill": 0},
    ]
}
IOS = {
    "apps": [
        {"appId": "MB", "appName": "MB Bank", "appLogo": "https://l/mb.png", "autofill": 0},
        {"appId": "vcb", "appName": "Vietcombank", "appLogo": "https://l/vcb.png", "autofill": 1},
    ]
}
BANKS = {
    "data": [
        {"code": "MB", "bin": "970422", "shortName": "MB"},
        {"code": "VCB", "bin": "970436", "shortName": "Vietcombank"},
    ]
}


class FakeVietQR:
    def __init__(self):
        self.calls = []
        self.fail = None
        self.routes = {
            "/v2/android-app-deeplinks": ANDROID,
            "/v2/ios-app-deeplinks": IOS,
            "/v2/banks": BANKS,
        }

    def __call__(self, url, **kwargs):
        self.calls.append(url)
        if self.fail is not None:
            if isinstance(self.fail, Exception):
                raise self.fail
            return self.fail(url)
        path = "/" + url.split("/", 3)[3]
        resp = httpx.Response(200, json=self.routes[path])
        resp.request = httpx.Request("GET", url)
        return resp


def status(code):
    def make(url):
        resp = httpx.Response(code, json={})
        resp.request = httpx.Request("GET", url)
        return resp

    return make


@pytest.fixture(autouse=True)
def fake(settings, monkeypatch):
    cache.clear()
    settings.APP_SHARED_SECRET = SECRET
    settings.BANKS_CACHE_TTL_S = 86400
    f = FakeVietQR()
    monkeypatch.setattr(httpx, "get", f)

    def no_network(*a, **k):
        raise AssertionError("real network call attempted")

    monkeypatch.setattr(httpx.Client, "send", no_network)
    return f


@pytest.fixture
def get():
    def _get(device="dev-1", secret=SECRET):
        headers = {}
        if device is not None:
            headers["HTTP_X_DEVICE_ID"] = device
        if secret is not None:
            headers["HTTP_X_APP_SECRET"] = secret
        return APIClient().get("/banks/apps", **headers)

    return _get
