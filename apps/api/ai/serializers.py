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
