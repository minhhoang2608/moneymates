import hmac
import logging
import random

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import BasePermission


class AppSecretPermission(BasePermission):
    def has_permission(self, request, view):
        secret = settings.APP_SHARED_SECRET
        given = request.headers.get("X-App-Secret", "")
        return bool(secret) and hmac.compare_digest(given.encode(), secret.encode())


logger = logging.getLogger(__name__)

_UPSERT = """
INSERT INTO ai_counter (key, count, expires_at)
VALUES (%s, 1, now() + make_interval(secs => %s))
ON CONFLICT (key) DO UPDATE SET
  count = CASE WHEN ai_counter.expires_at <= now() THEN 1 ELSE ai_counter.count + 1 END,
  expires_at = CASE WHEN ai_counter.expires_at <= now()
                    THEN EXCLUDED.expires_at ELSE ai_counter.expires_at END
RETURNING count
"""


def _hit_db(key, ttl):
    """Atomic counter in one statement (PostgreSQL)."""
    with connection.cursor() as cur:
        cur.execute(_UPSERT, [key, ttl])
        count = cur.fetchone()[0]
        if random.randrange(50) == 0:
            cur.execute("DELETE FROM ai_counter WHERE expires_at < now()")
    return count


def _hit_cache(key, ttl):
    cache.add(key, 0, ttl)
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, ttl)
        return 1


def _hit(key, limit, ttl):
    if connection.vendor == "postgresql":
        count = _hit_db(key, ttl)
    else:
        count = _hit_cache(key, ttl)
    return count <= limit


def check_device_limit(device_id):
    """Count one request; return False when the device is over its limit.

    Fails open: if the counter store is down, the request is let through.
    """
    try:
        minute_ok = _hit(f"ai:min:{device_id}", settings.AI_LIMIT_PER_MINUTE, 60)
        day_ok = _hit(f"ai:day:{device_id}", settings.AI_LIMIT_PER_DAY, 86400)
    except Exception as exc:
        logger.warning("ai limit check failed (%s); failing open", type(exc).__name__)
        return True
    return minute_ok and day_ok
