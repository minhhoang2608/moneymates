import json

from django.conf import settings
from rest_framework import serializers


class StrictCharField(serializers.CharField):
    """CharField that rejects numbers and booleans instead of coercing them."""

    def to_internal_value(self, data):
        if not isinstance(data, str):
            self.fail("invalid")
        return super().to_internal_value(data)


class ParseTextRequestSerializer(serializers.Serializer):
    text = StrictCharField(max_length=500)
    categories = serializers.ListField(
        child=StrictCharField(max_length=100), required=False, max_length=50
    )
    members = serializers.ListField(
        child=StrictCharField(max_length=100), required=False, max_length=20
    )


JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG"


def sniff_image_mime(head):
    if head.startswith(JPEG_MAGIC):
        return "image/jpeg"
    if head.startswith(PNG_MAGIC):
        return "image/png"
    return None


class ParseBillRequestSerializer(serializers.Serializer):
    image = serializers.FileField()
    categories = serializers.JSONField(required=False)

    def validate_image(self, image):
        if image.size > settings.AI_BILL_MAX_BYTES:
            raise serializers.ValidationError("too_large")
        head = image.read(4)
        image.seek(0)
        if sniff_image_mime(head) is None:
            raise serializers.ValidationError("bad_type")
        return image

    def validate_categories(self, value):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                raise serializers.ValidationError("invalid") from None
        if not isinstance(value, list) or len(value) > 50:
            raise serializers.ValidationError("invalid")
        for item in value:
            if not isinstance(item, str) or len(item) > 100:
                raise serializers.ValidationError("invalid")
        return value
