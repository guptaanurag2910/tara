import logging

from django.db import transaction
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BirthDetails, Kundali
from .serializers import BirthDetailsSerializer, KundaliSerializer
from .services.ephemeris_service import get_coordinates
from .services.horoscope_engine import get_cached_daily_horoscope
from .services.location_service import reverse_geocode, search_places

logger = logging.getLogger(__name__)


class BirthDetailsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        birth = BirthDetails.objects.filter(user=request.user).first()
        if birth is None:
            return Response({"detail": "Birth details not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(BirthDetailsSerializer(birth).data, status=status.HTTP_200_OK)

    def post(self, request):
        return self._upsert(request, partial=False)

    def put(self, request):
        return self._upsert(request, partial=False)

    def _upsert(self, request, partial: bool):
        existing = BirthDetails.objects.filter(user=request.user).first()
        serializer = BirthDetailsSerializer(instance=existing, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        payload = dict(serializer.validated_data)
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")
        place = payload.get("place_of_birth") or (existing.place_of_birth if existing else "")
        allow_geocode_fallback = bool(getattr(settings, "ASTRO_BIRTH_DETAILS_GEOCODE_FALLBACK", True))

        if latitude is None or longitude is None:
            if not allow_geocode_fallback:
                return Response(
                    {"detail": "latitude and longitude are required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                coords = get_coordinates(str(place))
                payload["latitude"] = coords.latitude
                payload["longitude"] = coords.longitude
                payload.setdefault("is_default_location", True)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                logger.exception("Failed geocoding place='%s'", place)
                return Response(
                    {"detail": "Could not resolve place to coordinates."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

        try:
            with transaction.atomic():
                if existing is None:
                    birth = BirthDetails.objects.create(user=request.user, **payload)
                else:
                    for field, value in payload.items():
                        setattr(existing, field, value)
                    existing.save()
                    birth = existing
        except Exception:
            logger.exception("Failed to save birth details for user_id=%s", request.user.id)
            return Response({"detail": "Could not save birth details right now."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(BirthDetailsSerializer(birth).data, status=status.HTTP_200_OK)


class KundaliView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        kundali = Kundali.objects.filter(user=request.user).first()
        if kundali is None:
            return Response({"detail": "Kundali not generated yet."}, status=status.HTTP_404_NOT_FOUND)
        return Response(KundaliSerializer(kundali).data, status=status.HTTP_200_OK)


class DailyHoroscopeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        kundali = Kundali.objects.filter(user=request.user).first()
        lagna_sign = kundali.lagna if kundali else None
        moon_sign = kundali.moon_sign if kundali else None

        payload = get_cached_daily_horoscope(
            user_id=request.user.id,
            lagna_sign=lagna_sign,
            moon_sign=moon_sign,
        )
        return Response(payload, status=status.HTTP_200_OK)


class LocationSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = str(request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response([], status=status.HTTP_200_OK)
        try:
            payload = search_places(query, limit=6)
            return Response(payload, status=status.HTTP_200_OK)
        except Exception:
            logger.exception("Failed location search for query='%s'", query)
            return Response(
                {"detail": "Could not fetch location suggestions right now."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class LocationReverseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        lat_raw = request.query_params.get("latitude")
        lon_raw = request.query_params.get("longitude")
        try:
            latitude = float(lat_raw)
            longitude = float(lon_raw)
        except (TypeError, ValueError):
            return Response(
                {"detail": "latitude and longitude are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if latitude < -90 or latitude > 90 or longitude < -180 or longitude > 180:
            return Response(
                {"detail": "latitude must be -90..90 and longitude must be -180..180."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = reverse_geocode(latitude, longitude)
            return Response(payload, status=status.HTTP_200_OK)
        except Exception:
            logger.exception("Failed reverse geocode for lat=%s lon=%s", latitude, longitude)
            return Response(
                {"detail": "Could not resolve the provided coordinates."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
