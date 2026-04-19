from django.utils import timezone
from rest_framework import serializers

from .models import BirthDetails, Kundali


class BirthDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BirthDetails
        fields = [
            "date_of_birth",
            "time_of_birth",
            "place_of_birth",
            "latitude",
            "longitude",
            "is_default_location",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_date_of_birth(self, value):
        if value >= timezone.localdate():
            raise serializers.ValidationError("date_of_birth must be in the past.")
        return value

    def validate(self, attrs):
        has_lat = attrs.get("latitude", None) is not None
        has_lon = attrs.get("longitude", None) is not None
        if has_lat != has_lon:
            raise serializers.ValidationError("latitude and longitude must be provided together.")
        return attrs

    def validate_latitude(self, value):
        if value is not None and (value < -90 or value > 90):
            raise serializers.ValidationError("latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and (value < -180 or value > 180):
            raise serializers.ValidationError("longitude must be between -180 and 180.")
        return value


class KundaliSerializer(serializers.ModelSerializer):
    class Meta:
        model = Kundali
        fields = [
            "lagna",
            "moon_sign",
            "sun_sign",
            "chart_data",
            "insights",
            "scores",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
