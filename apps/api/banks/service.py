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


def get_apps():
    """Return (payload, stale). Raise BanksUnavailable if VietQR is down and nothing is cached."""
    cached = cache.get(FRESH)
    if cached is not None:
        return cached, False
    t0 = time.monotonic()
    try:
        apps = merge(*fetch_registry())
    except BanksUnavailable as exc:
        last_good = cache.get(LAST_GOOD)
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
    cache.set(FRESH, payload, settings.BANKS_CACHE_TTL_S)
    cache.set(LAST_GOOD, payload, None)
    logger.info("banks outcome=ok latency=%.2fs", time.monotonic() - t0)
    return payload, False
