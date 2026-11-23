import json

import httpx
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

SECRET = "test-secret"
GOOD = {
    "amount": 200000,
    "note": "Tiền xăng",
    "category": "Di chuyển",
    "payer": "Bình",
}
BODY = {
    "text": "Bình trả tiền xăng hai trăm nghìn",
    "categories": ["Ăn uống", "Di chuyển", "Cà phê", "Khác"],
    "members": ["Tôi", "An", "Bình"],
}


def reply(payload):
    """An OpenRouter-style 200 response carrying `payload` as the message content."""
    content = payload if isinstance(payload, str) else json.dumps(payload)
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


class FakeOpenRouter:
    """Replaces httpx.post. `script` maps model name -> response or exception."""

    def __init__(self):
        self.script = {}
        self.calls = []

    def __call__(self, url, **kwargs):
        model = kwargs["json"]["model"]
        self.calls.append(model)
        result = self.script.get(model, reply(GOOD))
        if isinstance(result, Exception):
            raise result
        result.request = httpx.Request("POST", url)
        return result


@pytest.fixture(autouse=True)
def _isolate(settings, monkeypatch):
    cache.clear()
    settings.APP_SHARED_SECRET = SECRET
    settings.OPENROUTER_API_KEY = "test-key"
    settings.OPENROUTER_MODELS = ["m1", "m2"]
    settings.AI_LIMIT_PER_MINUTE = 20
    settings.AI_LIMIT_PER_DAY = 50
    fake = FakeOpenRouter()
    monkeypatch.setattr(httpx, "post", fake)

    def no_network(*a, **k):
        raise AssertionError("real network call attempted")

    monkeypatch.setattr(httpx.Client, "send", no_network)
    return fake


@pytest.fixture
def fake(_isolate):
    return _isolate


@pytest.fixture
def post():
    def _post(body=BODY, device="dev-1", secret=SECRET):
        headers = {}
        if device is not None:
            headers["HTTP_X_DEVICE_ID"] = device
        if secret is not None:
            headers["HTTP_X_APP_SECRET"] = secret
        return APIClient().post("/ai/parse-text", body, format="json", **headers)

    return _post
