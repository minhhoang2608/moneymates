from django.urls import re_path

from .views import ParseTextView

urlpatterns = [re_path(r"^ai/parse-text/?$", ParseTextView.as_view())]
