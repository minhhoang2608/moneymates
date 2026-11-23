import os

# Test-only value, not a secret. Must be set before the real settings load.
os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-not-a-secret")

os.environ.setdefault("CACHE_BACKEND", "locmem")

from .settings import *  # noqa: E402,F403
