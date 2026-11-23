from django.urls import re_path

from .views import ParseBillView, ParseTextView

urlpatterns = [
    re_path(r"^ai/parse-text/?$", ParseTextView.as_view()),
    re_path(r"^ai/parse-bill/?$", ParseBillView.as_view()),
]
