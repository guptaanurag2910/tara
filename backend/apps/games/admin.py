from django.contrib import admin
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.template.response import TemplateResponse
from django.urls import path

from .forms import GameQuestionUploadForm
from .models import Game, GameCategory, GameOption, GameQuestion, QuestionExposure
from .question_import_service import import_game_questions_rows, load_rows_from_uploaded_json


@admin.register(GameCategory)
class GameCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "emoji", "slug", "is_active")
    list_editable = ("is_active",)
    search_fields = ("name", "slug", "emoji", "description")
    prepopulated_fields = {"slug": ("name",)}
    list_per_page = 200
    show_full_result_count = False


class GameQuestionInline(admin.TabularInline):
    model = GameQuestion
    extra = 0
    fields = ("order", "game_type", "category", "question_text", "difficulty", "is_active")
    ordering = ("order", "id")
    show_change_link = True


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "emoji", "type", "is_active", "question_count", "created_at")
    list_filter = ("type", "is_active", "created_at")
    search_fields = ("name", "emoji", "description")
    inlines = [GameQuestionInline]
    save_on_top = True
    list_per_page = 50

    @admin.display(description="Questions")
    def question_count(self, obj):
        return obj.questions.count()


class GameOptionInline(admin.TabularInline):
    model = GameOption
    extra = 0
    fields = ("order", "option_text")
    ordering = ("order", "id")


@admin.register(GameQuestion)
class GameQuestionAdmin(admin.ModelAdmin):
    change_list_template = "admin/games/gamequestion/change_list.html"
    list_display = (
        "question_text",
        "category",
        "game_type",
        "is_active",
        "times_used",
    )
    list_editable = ("is_active",)
    list_select_related = ("category",)
    list_filter = ("category", "game_type", "is_active")
    search_fields = ("question_text",)
    autocomplete_fields = ("game", "category")
    inlines = [GameOptionInline]
    ordering = ("-id",)
    readonly_fields = ("created_at",)
    actions = ("activate_questions", "deactivate_questions")
    fieldsets = (
        ("Primary", {"fields": ("game", "category", "game_type", "question_text", "is_active")}),
        ("Behavior", {"fields": ("options", "trait_mapping", "tags", "difficulty", "times_used")}),
        ("Ordering", {"fields": ("order", "created_at")}),
    )
    save_on_top = True
    list_per_page = 200
    show_full_result_count = False

    @admin.action(description="Activate selected questions")
    def activate_questions(self, request, queryset):
        queryset.update(is_active=True)

    @admin.action(description="Deactivate selected questions")
    def deactivate_questions(self, request, queryset):
        queryset.update(is_active=False)

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "upload-json/",
                self.admin_site.admin_view(self.upload_json_view),
                name="games_gamequestion_upload_json",
            ),
        ]
        return custom_urls + urls

    def upload_json_view(self, request: HttpRequest) -> HttpResponse:
        if not self.has_add_permission(request):
            raise PermissionDenied

        if request.method == "POST":
            form = GameQuestionUploadForm(request.POST, request.FILES)
            if form.is_valid():
                game_name = form.cleaned_data.get("game_name") or "Imported Questions"
                game_type = form.cleaned_data.get("game_type") or Game.Type.CHOICE
                json_file = form.cleaned_data["json_file"]
                try:
                    rows = load_rows_from_uploaded_json(json_file)
                except Exception as exc:  # noqa: BLE001
                    form.add_error("json_file", f"Invalid JSON file: {exc}")
                else:
                    summary = import_game_questions_rows(
                        rows,
                        game_name=game_name,
                        game_type=game_type,
                        dry_run=False,
                    )
                    level = messages.SUCCESS if summary["errors"] == 0 else messages.WARNING
                    self.message_user(
                        request,
                        (
                            "Import complete. "
                            f"Processed: {summary['total_processed']} | "
                            f"Created: {summary['created']} | "
                            f"Skipped: {summary['skipped']} | "
                            f"Errors: {summary['errors']}"
                        ),
                        level=level,
                    )
                    for detail in summary["error_details"][:10]:
                        self.message_user(request, detail, level=messages.ERROR)
                    return redirect("..")
        else:
            form = GameQuestionUploadForm()

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": "Upload Game Questions JSON",
            "form": form,
        }
        return TemplateResponse(request, "admin/games/gamequestion/upload_json.html", context)


@admin.register(GameOption)
class GameOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "question", "order", "option_text")
    list_filter = ("question__game",)
    search_fields = ("option_text", "question__question_text", "question__game__name")
    autocomplete_fields = ("question",)
    list_select_related = ("question", "question__game")
    ordering = ("question", "order")
    list_editable = ("order",)
    list_per_page = 100


@admin.register(QuestionExposure)
class QuestionExposureAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "question", "seen_at")
    list_filter = ("seen_at", "question__game_type", "question__category")
    search_fields = (
        "user__email",
        "user__name",
        "question__question_text",
    )
    autocomplete_fields = ("user", "question")
    list_select_related = ("user", "question", "question__category")
    ordering = ("-seen_at", "id")
    list_per_page = 100
