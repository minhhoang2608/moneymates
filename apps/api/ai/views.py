import base64
import math
import re
import unicodedata
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.views import FEATURES

from .client import AIUnavailable, call_openrouter
from .limits import AppSecretPermission, check_device_limit
from .prompts import build_bill_messages, build_messages
from .serializers import ParseBillRequestSerializer, ParseTextRequestSerializer, sniff_image_mime


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


_NUMBER = re.compile(r"^\d+(\.\d+)?$")


def _amount(value):
    """Coerce a model-provided amount to integer VND without float math on ints/strings."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        amount = int(round(value))
        return amount if amount >= 0 else None
    if isinstance(value, str):
        text = value.replace(",", "").strip()
        if not _NUMBER.match(text):
            return None
        return int(Decimal(text).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return None


def _note(value):
    if not isinstance(value, str):
        return None
    value = value.strip()[:100].strip()
    return value or None


def _err(code, status):
    return Response({"error": code}, status=status)


class _AIView(APIView):
    permission_classes = [AppSecretPermission]

    def permission_denied(self, request, message=None, code=None):
        raise _Respond(_err("unauthorized", 401))

    def handle_exception(self, exc):
        if isinstance(exc, _Respond):
            return exc.response
        return super().handle_exception(exc)


class ParseTextView(_AIView):
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


def _shop(value):
    if not isinstance(value, str):
        return None
    return value.strip()[:100].strip() or None


def _date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()):
        return None
    try:
        return date.fromisoformat(value.strip()).isoformat()
    except ValueError:
        return None


class ParseBillView(_AIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        if not (FEATURES.get("ai_enabled") and FEATURES.get("ai_parse_bill")):
            return _err("ai_disabled", 403)
        ser = ParseBillRequestSerializer(data=request.data)
        device_id = request.headers.get("X-Device-Id", "").strip()
        if not device_id or len(device_id) > 100 or not ser.is_valid():
            return _err("invalid_input", 400)
        if not check_device_limit(device_id):
            return _err("quota_exceeded", 429)
        data = ser.validated_data
        categories = data.get("categories", [])
        image = data["image"]
        raw_bytes = image.read()
        mime = sniff_image_mime(raw_bytes[:4])
        image_b64 = base64.b64encode(raw_bytes).decode("ascii")
        models = settings.OPENROUTER_VISION_MODELS or settings.OPENROUTER_MODELS
        try:
            raw = call_openrouter(build_bill_messages(image_b64, mime, categories), models=models)
        except AIUnavailable:
            return _err("ai_unavailable", 502)
        return Response(
            {
                "amount": _amount(raw.get("amount")),
                "currency": "VND",
                "shop": _shop(raw.get("shop")),
                "date": _date(raw.get("date")),
                "category": _pick(raw.get("category"), categories),
            }
        )


class _Respond(Exception):
    def __init__(self, response):
        self.response = response
