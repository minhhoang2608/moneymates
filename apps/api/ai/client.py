import json
import logging
import time

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OVERALL_DEADLINE_S = 20.0


class AIUnavailable(Exception):
    pass


def _call_model(model, messages, timeout):
    resp = httpx.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
        json={
            "model": model,
            "messages": messages,
            "response_format": {"type": "json_object"},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("not an object")
    return data


def call_openrouter(messages):
    """Try each configured model in order; raise AIUnavailable if all fail."""
    start = time.monotonic()
    for model in settings.OPENROUTER_MODELS:
        remaining = OVERALL_DEADLINE_S - (time.monotonic() - start)
        if remaining <= 0:
            break
        t0 = time.monotonic()
        try:
            data = _call_model(model, messages, min(settings.OPENROUTER_TIMEOUT_S, remaining))
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            logger.warning(
                "openrouter model=%s outcome=%s latency=%.2fs",
                model,
                type(exc).__name__,
                time.monotonic() - t0,
            )
            continue
        logger.info("openrouter model=%s outcome=ok latency=%.2fs", model, time.monotonic() - t0)
        return data
    raise AIUnavailable()
