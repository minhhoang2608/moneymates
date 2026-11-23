from django.urls import re_path

from .views import FeaturesView, HealthView

urlpatterns = [
    re_path(r"^health/?$", HealthView.as_view()),
    re_path(r"^me/features/?$", FeaturesView.as_view()),
]
