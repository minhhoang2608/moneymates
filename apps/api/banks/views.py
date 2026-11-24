from rest_framework.response import Response
from rest_framework.views import APIView

from ai.limits import AppSecretPermission

from .client import BanksUnavailable
from .service import get_apps


class _Respond(Exception):
    def __init__(self, response):
        self.response = response


class BankAppsView(APIView):
    permission_classes = [AppSecretPermission]

    def permission_denied(self, request, message=None, code=None):
        raise _Respond(Response({"error": "unauthorized"}, status=401))

    def handle_exception(self, exc):
        if isinstance(exc, _Respond):
            return exc.response
        return super().handle_exception(exc)

    def get(self, request):
        device_id = request.headers.get("X-Device-Id", "").strip()
        if not device_id or len(device_id) > 100:
            return Response({"error": "unauthorized"}, status=401)
        try:
            payload, stale = get_apps()
        except BanksUnavailable:
            return Response({"error": "banks_unavailable"}, status=503)
        return Response(
            {"updated_at": payload["updated_at"], "stale": stale, "apps": payload["apps"]}
        )
