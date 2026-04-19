from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    KundaliProfile,
    PersonalityOption,
    PersonalityQuestion,
    PersonalityResponse,
    Trait,
    User,
    UserProfileImage,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    model = User
    list_display = ("id", "phone_number", "email", "name", "gender", "preference", "is_staff")
    ordering = ("id",)
    fieldsets = (
        (None, {"fields": ("phone_number", "email", "password")}),
        (
            "Personal Info",
            {
                "fields": (
                    "name",
                    "date_of_birth",
                    "gender",
                    "preference",
                    "birth_place",
                    "birth_time",
                    "latitude",
                    "longitude",
                    "is_birth_time_default",
                )
            },
        ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("phone_number", "email", "name", "password1", "password2", "is_staff", "is_superuser"),
            },
        ),
    )


class PersonalityOptionInline(admin.TabularInline):
    model = PersonalityOption
    extra = 1


@admin.register(PersonalityQuestion)
class PersonalityQuestionAdmin(admin.ModelAdmin):
    list_display = ("id", "question_text", "category", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("question_text",)
    inlines = [PersonalityOptionInline]


@admin.register(PersonalityOption)
class PersonalityOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "option_text")
    list_filter = ("question__category",)
    search_fields = ("option_text", "question__question_text")


@admin.register(PersonalityResponse)
class PersonalityResponseAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "question", "selected_option")
    search_fields = ("user__email", "question__question_text", "selected_option__option_text")
    list_filter = ("question__category",)


@admin.register(Trait)
class TraitAdmin(admin.ModelAdmin):
    list_display = ("id", "user")
    search_fields = ("user__email", "user__name")


@admin.register(KundaliProfile)
class KundaliProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "lagna", "sun_sign", "moon_sign", "nakshatra", "nakshatra_pada", "is_accurate")
    search_fields = ("user__email", "user__name", "lagna", "sun_sign", "moon_sign", "nakshatra")
    list_filter = ("is_accurate", "lagna", "moon_sign", "varna", "gana", "nadi")


@admin.register(UserProfileImage)
class UserProfileImageAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "display_order", "created_at")
    search_fields = ("user__email", "user__name")
    list_filter = ("created_at",)
    ordering = ("user_id", "display_order", "id")
