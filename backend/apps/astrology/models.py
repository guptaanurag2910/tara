from django.conf import settings
from django.db import models


class BirthDetails(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="astrology_birth_details")
    date_of_birth = models.DateField()
    time_of_birth = models.TimeField(null=True, blank=True)
    place_of_birth = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_default_location = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user"], name="unique_astrology_birth_details_per_user"),
        ]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"BirthDetails(user_id={self.user_id}, place={self.place_of_birth})"


class Kundali(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="astrology_kundalis")
    birth_details = models.OneToOneField(BirthDetails, on_delete=models.CASCADE, related_name="kundali")
    lagna = models.CharField(max_length=32)
    moon_sign = models.CharField(max_length=32)
    sun_sign = models.CharField(max_length=32)
    chart_data = models.JSONField(default=dict, blank=True)
    insights = models.JSONField(default=dict, blank=True)
    scores = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user"], name="unique_astrology_kundali_per_user"),
        ]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Kundali(user_id={self.user_id}, lagna={self.lagna})"
