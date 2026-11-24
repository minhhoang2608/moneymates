import httpx
from django.conf import settings


class BanksUnavailable(Exception):
    pass


def _rows(payload):
    """The registry rows, whether wrapped in `apps`/`data` or sent as a bare list."""
    if isinstance(payload, dict):
        payload = payload.get("apps", payload.get("data"))
    if not isinstance(payload, list):
        raise ValueError("unexpected payload")
    return [r for r in payload if isinstance(r, dict)]


def _get(path):
    resp = httpx.get(
        f"{settings.VIETQR_API_BASE.rstrip('/')}{path}", timeout=settings.BANKS_TIMEOUT_S
    )
    resp.raise_for_status()
    return _rows(resp.json())


def fetch_registry():
    """Return (android, ios, banks) rows. All-or-nothing: any failure raises BanksUnavailable."""
    try:
        android = _get("/v2/android-app-deeplinks")
        ios = _get("/v2/ios-app-deeplinks")
        banks = _get("/v2/banks")
    except (httpx.HTTPError, ValueError) as exc:
        raise BanksUnavailable(type(exc).__name__) from exc
    if not android and not ios:
        raise BanksUnavailable("empty")
    return android, ios, banks
