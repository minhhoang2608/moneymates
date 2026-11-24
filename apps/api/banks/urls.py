from django.urls import re_path

from .views import BankAppsView

urlpatterns = [re_path(r"^banks/apps/?$", BankAppsView.as_view())]
