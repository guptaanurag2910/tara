import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BirthDetails, Kundali
from .services.interpretation_service import generate_insights, generate_scores
from .services.kundali_service import calculate_kundali_payload

logger = logging.getLogger(__name__)


@receiver(post_save, sender=BirthDetails)
def regenerate_kundali_on_birthdetails_save(sender, instance: BirthDetails, **kwargs):
    try:
        payload = calculate_kundali_payload(
            date_of_birth=instance.date_of_birth,
            time_of_birth=instance.time_of_birth,
            place_of_birth=instance.place_of_birth,
            latitude=float(instance.latitude) if instance.latitude is not None else None,
            longitude=float(instance.longitude) if instance.longitude is not None else None,
        )
        resolved = payload.get("resolved_coordinates") or {}
        resolved_lat = resolved.get("latitude")
        resolved_lon = resolved.get("longitude")
        latitude_for_user = resolved_lat if resolved_lat is not None else instance.latitude
        longitude_for_user = resolved_lon if resolved_lon is not None else instance.longitude
        if resolved_lat is not None and resolved_lon is not None:
            # Keep stored coordinates in sync with resolved values.
            BirthDetails.objects.filter(pk=instance.pk).update(latitude=resolved_lat, longitude=resolved_lon)

        user = instance.user
        user.date_of_birth = instance.date_of_birth
        user.birth_time = instance.time_of_birth
        user.birth_place = instance.place_of_birth
        user.latitude = latitude_for_user
        user.longitude = longitude_for_user
        user.is_default_location = instance.is_default_location
        user.is_birth_time_default = instance.time_of_birth is None
        user.save(
            update_fields=[
                "date_of_birth",
                "birth_time",
                "birth_place",
                "latitude",
                "longitude",
                "is_default_location",
                "is_birth_time_default",
            ]
        )

        insights = generate_insights(payload)
        scores = generate_scores(payload)

        Kundali.objects.update_or_create(
            birth_details=instance,
            defaults={
                "user": instance.user,
                "lagna": payload["lagna"],
                "moon_sign": payload["moon_sign"],
                "sun_sign": payload["sun_sign"],
                "chart_data": payload["chart_data"],
                "insights": insights,
                "scores": scores,
            },
        )
    except Exception:
        logger.exception("Failed to auto-generate kundali for birth_details_id=%s", instance.id)
