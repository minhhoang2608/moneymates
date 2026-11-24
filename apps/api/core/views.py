import logging

from django.db import connection
from rest_framework.response import Response
from rest_framework.views import APIView

# Fixed flags for v1; no DB and no auth.
FEATURES = {"ai_enabled": True, "ai_parse_text": True, "ai_parse_bill": True}


logger = logging.getLogger(__name__)


class HealthView(APIView):
    def get(self, request):
        if request.query_params.get("db") != "1":
            return Response({"status": "ok"})
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        except Exception as exc:
            logger.warning("health db check failed (%s)", type(exc).__name__)
            return Response({"status": "error", "db": "error"}, status=503)
        return Response({"status": "ok", "db": "ok"})


class FeaturesView(APIView):
    def get(self, request):
        return Response(dict(FEATURES))
