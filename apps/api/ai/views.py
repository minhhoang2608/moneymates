import unicodedata

from rest_framework.response import Response
from rest_framework.views import APIView

from core.views import FEATURES

from .client import AIUnavailable, call_openrouter
from .limits import AppSecretPermission, check_device_limit
from .prompts import build_messages
from .serializers import ParseTextRequestSerializer


def _norm(value):
    return unicodedata.normalize("NFC", value).strip().casefold()


def _pick(value, allowed):
    if not isinstance(value, str) or not allowed:
        return None
    wanted = _norm(value)
    for item in allowed:
        if _norm(item) == wanted:
            return item
    return None


def _amount(value):
    if isinstance(value, bool) or value is None:
        return None
    try:
        amount = int(round(float(str(value).replace(",", "").strip())))
    except (TypeError, ValueError, OverflowError):
        return None
    return amount if amount >= 0 else None


def _note(value):
    if not isinstance(value, str):
        return None
    value = value.strip()[:100].strip()
    return value or None


def _err(code, status):
    return Response({"error": code}, status=status)


class ParseTextView(APIView):
    permission_classes = [AppSecretPermission]

    def permission_denied(self, request, message=None, code=None):
        return_value = _err("unauthorized", 401)
        raise _Respond(return_value)

    def handle_exception(self, exc):
        if isinstance(exc, _Respond):
            return exc.response
        return super().handle_exception(exc)

    def post(self, request):
        if not (FEATURES.get("ai_enabled") and FEATURES.get("ai_parse_text")):
            return _err("ai_disabled", 403)
        ser = ParseTextRequestSerializer(data=request.data)
        device_id = request.headers.get("X-Device-Id", "").strip()
        if not device_id or len(device_id) > 100 or not ser.is_valid():
            return _err("invalid_input", 400)
        if not check_device_limit(device_id):
            return _err("quota_exceeded", 429)
        data = ser.validated_data
        categories = data.get("categories", [])
        members = data.get("members", [])
        try:
            raw = call_openrouter(build_messages(data["text"], categories, members))
        except AIUnavailable:
            return _err("ai_unavailable", 502)
        return Response(
            {
                "amount": _amount(raw.get("amount")),
                "currency": "VND",
                "note": _note(raw.get("note")),
                "category": _pick(raw.get("category"), categories),
                "payer": _pick(raw.get("payer"), members),
            }
        )


class _Respond(Exception):
    def __init__(self, response):
        self.response = response
