import logging
import time
from datetime import UTC, datetime

from django.conf import settings
from django.core.cache import cache

from .client import BanksUnavailable, fetch_registry
from .merge import merge

logger = logging.getLogger(__name__)
FRESH = "banks:apps:fresh"
LAST_GOOD = "banks:apps:last_good"


def _cache_get(key):
    try:
        return cache.get(key)
    except Exception as exc:
        logger.warning("banks cache get failed (%s)", type(exc).__name__)
        return None


def _cache_set(key, value, ttl):
    try:
        cache.set(key, value, ttl)
    except Exception as exc:
        logger.warning("banks cache set failed (%s)", type(exc).__name__)


def get_apps():
    """Return (payload, stale). Raise BanksUnavailable if VietQR is down and nothing is cached."""
    cached = _cache_get(FRESH)
    if cached is not None:
        return cached, False
    t0 = time.monotonic()
    try:
        apps = merge(*fetch_registry())
    except BanksUnavailable as exc:
        last_good = _cache_get(LAST_GOOD)
        logger.warning(
            "banks outcome=%s stale=%s latency=%.2fs",
            exc,
            last_good is not None,
            time.monotonic() - t0,
        )
        if last_good is None:
            raise
        return last_good, True
    payload = {
        "updated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "apps": apps,
    }
    _cache_set(FRESH, payload, settings.BANKS_CACHE_TTL_S)
    _cache_set(LAST_GOOD, payload, None)
    logger.info("banks outcome=ok latency=%.2fs", time.monotonic() - t0)
    return payload, False
