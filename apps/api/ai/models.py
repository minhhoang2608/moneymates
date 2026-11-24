from django.db import models


class AiCounter(models.Model):
    """Per-device request counter (PostgreSQL). Server-only infra table, like django_cache."""

    key = models.CharField(max_length=200, primary_key=True)
    count = models.IntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "ai_counter"

    def __str__(self):
        return self.key
