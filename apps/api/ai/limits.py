import hmac

from django.conf import settings
from django.core.cache import cache
from rest_framework.permissions import BasePermission


class AppSecretPermission(BasePermission):
    def has_permission(self, request, view):
        secret = settings.APP_SHARED_SECRET
        given = request.headers.get("X-App-Secret", "")
        return bool(secret) and hmac.compare_digest(given.encode(), secret.encode())


def _hit(key, limit, ttl):
    cache.add(key, 0, ttl)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, ttl)
        count = 1
    return count <= limit


def check_device_limit(device_id):
    """Count one request; return False when the device is over its limit."""
    minute_ok = _hit(f"ai:min:{device_id}", settings.AI_LIMIT_PER_MINUTE, 60)
    day_ok = _hit(f"ai:day:{device_id}", settings.AI_LIMIT_PER_DAY, 86400)
    return minute_ok and day_ok
