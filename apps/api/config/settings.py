import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "change-me":
    if DEBUG:
        # Insecure fallback, local development only.
        SECRET_KEY = "insecure-dev-only-key"
    else:
        raise ImproperlyConfigured(
            "DJANGO_SECRET_KEY must be set to a real value when DJANGO_DEBUG is off"
        )


def _csv(name):
    return [v.strip() for v in os.environ.get(name, "").split(",") if v.strip()]


ALLOWED_HOSTS = _csv("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "core",
    "ai",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
    )
}


def _caches():
    backend = os.environ.get("CACHE_BACKEND", "").strip().lower()
    engine = DATABASES["default"]["ENGINE"]
    if backend == "db" or (backend != "locmem" and engine == "django.db.backends.postgresql"):
        return {
            "default": {
                "BACKEND": "django.core.cache.backends.db.DatabaseCache",
                "LOCATION": "django_cache",
            }
        }
    return {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


CACHES = _caches()

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

USE_TZ = True
TIME_ZONE = "UTC"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
}

# Read now, used by later tickets (AI endpoints).
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODELS = _csv("OPENROUTER_MODELS")
OPENROUTER_VISION_MODELS = _csv("OPENROUTER_VISION_MODELS")
AI_BILL_MAX_BYTES = int(os.environ.get("AI_BILL_MAX_BYTES", str(1_500_000)))
APP_SHARED_SECRET = os.environ.get("APP_SHARED_SECRET", "")
OPENROUTER_TIMEOUT_S = float(os.environ.get("OPENROUTER_TIMEOUT_S", "10"))
AI_LIMIT_PER_MINUTE = int(os.environ.get("AI_LIMIT_PER_MINUTE", "20"))
AI_LIMIT_PER_DAY = int(os.environ.get("AI_LIMIT_PER_DAY", "50"))
