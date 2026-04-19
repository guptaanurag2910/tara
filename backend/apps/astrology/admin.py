from django.contrib import admin

from .models import BirthDetails, Kundali


@admin.register(BirthDetails)
class BirthDetailsAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "date_of_birth", "time_of_birth", "place_of_birth", "updated_at")
    search_fields = ("user__email", "user__name", "place_of_birth")
    ordering = ("-updated_at",)


@admin.register(Kundali)
class KundaliAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "lagna", "moon_sign", "sun_sign", "updated_at")
    search_fields = ("user__email", "user__name", "lagna", "moon_sign", "sun_sign")
    ordering = ("-updated_at",)
