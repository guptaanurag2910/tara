from django.utils import timezone
from rest_framework import serializers
from apps.users.services.nakshatra_data import NAKSHATRAS

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
        today = timezone.localdate()
        if value >= today:
            raise serializers.ValidationError("date_of_birth must be in the past.")
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError("You must be 18+ to use Tara.")
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
    nakshatra = serializers.SerializerMethodField()
    nakshatra_pada = serializers.SerializerMethodField()
    birth_context = serializers.SerializerMethodField()
    calculation_settings = serializers.SerializerMethodField()

    class Meta:
        model = Kundali
        fields = [
            "lagna",
            "moon_sign",
            "sun_sign",
            "nakshatra",
            "nakshatra_pada",
            "birth_context",
            "calculation_settings",
            "chart_data",
            "insights",
            "scores",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _moon_longitude(self, obj):
        moon = (obj.chart_data or {}).get("planets", {}).get("moon", {})
        try:
            return float(moon["degree"]) % 360
        except (KeyError, TypeError, ValueError):
            return None

    def get_nakshatra(self, obj):
        longitude = self._moon_longitude(obj)
        return NAKSHATRAS[int(longitude / (360 / 27))] if longitude is not None else None

    def get_nakshatra_pada(self, obj):
        longitude = self._moon_longitude(obj)
        if longitude is None:
            return None
        span = 360 / 27
        return int((longitude % span) / (span / 4)) + 1

    def get_birth_context(self, obj):
        birth = obj.birth_details
        time_known = birth.time_of_birth is not None
        return {
            "date": birth.date_of_birth.isoformat(),
            "time": birth.time_of_birth.strftime("%H:%M") if time_known else None,
            "place": birth.place_of_birth,
            "timezone": (obj.chart_data or {}).get("timezone") or None,
            "time_known": time_known,
            "time_assumption": None if time_known else "12:00 local",
            "location_is_default": birth.is_default_location,
        }

    def get_calculation_settings(self, obj):
        return {
            "zodiac": "Sidereal",
            "ayanamsha": "Lahiri",
            "houses": "Whole sign",
            "ephemeris": "Swiss Ephemeris",
        }
