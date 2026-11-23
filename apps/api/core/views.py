from rest_framework.response import Response
from rest_framework.views import APIView

# Fixed flags for v1; no DB and no auth.
FEATURES = {"ai_enabled": True, "ai_parse_text": True, "ai_parse_bill": True}


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class FeaturesView(APIView):
    def get(self, request):
        return Response(dict(FEATURES))
