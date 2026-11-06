import logging
from datetime import timedelta
from typing import Dict, List, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone

from apps.notifications.services import notify_daily_recommendation
from apps.realtime.models import Match as RealtimeMatch
from apps.users.services import calculate_kundali
from apps.users.models import KundaliProfile, Trait
from apps.users.services import calculate_user_final_match, generate_match_insight

from .models import DailyRecommendation, Match, RecommendationGenerationJob, RecommendationQueue, Swipe, UserBlock

User = get_user_model()
logger = logging.getLogger(__name__)

DEFAULT_RECOMMENDATION_LIMIT = 50
DEFAULT_DAILY_RECOMMENDATION_LIMIT = 10


def _preferred_genders(preference: str) -> Optional[List[str]]:
    normalized = str(preference or "").strip().lower()
    if normalized == "everyone":
        return None
    if normalized in {"male", "female"}:
        return [normalized]
    return None


def _age_from_dob(date_of_birth) -> Optional[int]:
    if date_of_birth is None:
        return None
    today = timezone.localdate()
    years = today.year - date_of_birth.year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        years -= 1
    return years


def _candidate_queryset(user, *, after_id: int = 0):
    queryset = (
        User.objects.filter(
            is_active=True,
            is_staff=False,
            is_superuser=False,
            trait_profile__isnull=False,
            kundali_profile__isnull=False,
            pk__gt=after_id,
        )
        .exclude(pk=user.pk)
        .select_related("trait_profile", "kundali_profile")
    )
    queryset = queryset.filter(
        Q(privacy_settings__profile_visible=True)
        | Q(privacy_settings__profile_visible__isnull=True)
    )

    preferred = _preferred_genders(user.preference)
    if preferred is not None:
        queryset = queryset.filter(gender__in=preferred)

    user_gender = str(user.gender or "").strip().lower()
    if user_gender in {"male", "female"}:
        queryset = queryset.filter(Q(preference="everyone") | Q(preference=user_gender))
    else:
        queryset = queryset.filter(preference="everyone")

    swiped = Swipe.objects.filter(user_id=user.id, target_user_id=OuterRef("pk"))
    matched = Match.objects.filter(status=Match.Status.MATCHED).filter(
        Q(user_a_id=user.id, user_b_id=OuterRef("pk"))
        | Q(user_b_id=user.id, user_a_id=OuterRef("pk"))
    )
    queued = RecommendationQueue.objects.filter(user_id=user.id, target_user_id=OuterRef("pk"))
    blocked = RealtimeMatch.objects.filter(status=RealtimeMatch.Status.BLOCKED).filter(
        Q(user_a_id=user.id, user_b_id=OuterRef("pk"))
        | Q(user_b_id=user.id, user_a_id=OuterRef("pk"))
    )
    safety_blocked = UserBlock.objects.filter(
        Q(blocker_id=user.id, blocked_user_id=OuterRef("pk"))
        | Q(blocker_id=OuterRef("pk"), blocked_user_id=user.id)
    )
    return (
        queryset.annotate(
            _swiped=Exists(swiped), _matched=Exists(matched), _queued=Exists(queued),
            _blocked=Exists(blocked), _safety_blocked=Exists(safety_blocked),
        )
        .filter(_swiped=False, _matched=False, _queued=False, _blocked=False, _safety_blocked=False)
        .order_by("id")
    )


def _bootstrap_kundali_profile(user) -> Optional[KundaliProfile]:
    try:
        payload = calculate_kundali(
            date_of_birth=user.date_of_birth,
            birth_time=user.birth_time,
            latitude=user.latitude,
            longitude=user.longitude,
            place_of_birth=user.birth_place,
        )
    except Exception:
        logger.exception("Unable to bootstrap kundali for user_id=%s", user.id)
        return None

    defaults = {
        "lagna": payload.get("lagna", ""),
        "sun_sign": payload.get("sun_sign", ""),
        "moon_sign": payload.get("moon_sign", ""),
        "ascendant_degree": payload.get("ascendant_degree"),
        "nakshatra": payload.get("nakshatra", ""),
        "nakshatra_pada": payload.get("nakshatra_pada") or 1,
        "varna": payload.get("varna", ""),
        "vashya": payload.get("vashya", ""),
        "gana": payload.get("gana", ""),
        "yoni": payload.get("yoni", ""),
        "nadi": payload.get("nadi", ""),
        "bhakoot": payload.get("bhakoot", ""),
        "timezone_name": payload.get("timezone_name", ""),
        "chart_data": payload.get("chart_data", {}),
        "is_accurate": bool(payload.get("is_accurate", False)),
    }

    profile, _ = KundaliProfile.objects.update_or_create(user=user, defaults=defaults)
    return profile


def _has_required_profiles(user) -> bool:
    trait_profile = None
    kundali_profile = None

    try:
        trait_profile = user.trait_profile
    except Trait.DoesNotExist:
        trait_profile, _ = Trait.objects.get_or_create(user=user, defaults={"traits": {}})

    try:
        kundali_profile = user.kundali_profile
    except KundaliProfile.DoesNotExist:
        kundali_profile = _bootstrap_kundali_profile(user)

    if trait_profile is None or kundali_profile is None:
        return False

    # Keep relations hot on the in-memory instance to avoid extra reads.
    user.trait_profile = trait_profile
    user.kundali_profile = kundali_profile
    return True


def enqueue_recommendations_for_user(
    user_id: int, *, retry_failed: bool = False
) -> RecommendationGenerationJob | None:
    user = User.objects.filter(pk=user_id, is_active=True, is_staff=False, is_superuser=False).first()
    if user is None:
        return None
    job, _ = RecommendationGenerationJob.objects.get_or_create(user_id=user_id)
    if job.status == RecommendationGenerationJob.Status.FAILED and (job.attempts < 5 or retry_failed):
        job.status = RecommendationGenerationJob.Status.PENDING
        job.locked_at = None
        job.last_error = ""
        if retry_failed and job.attempts >= 5:
            job.cursor_id = 0
            job.candidates_scanned = 0
            job.attempts = 0
        job.save(update_fields=["status", "locked_at", "last_error", "cursor_id", "candidates_scanned", "attempts", "updated_at"])
    return job


def _score_candidate_pair(user, candidate):
    scores = calculate_user_final_match(user, candidate)
    insight = generate_match_insight(
        user.trait_profile.traits or {},
        candidate.trait_profile.traits or {},
        {"kundali_score": scores["kundali_score"], "match_type": scores["match_type"]},
    )
    return scores, insight


def process_one_recommendation_batch(*, stale_after_minutes: int = 10) -> bool:
    """Score one bounded batch. Called by the separate recommendation worker."""
    now = timezone.now()
    stale_before = now - timedelta(minutes=stale_after_minutes)
    with transaction.atomic():
        job = (
            RecommendationGenerationJob.objects.select_for_update()
            .filter(
                Q(status=RecommendationGenerationJob.Status.PENDING)
                | Q(status=RecommendationGenerationJob.Status.RUNNING, locked_at__lt=stale_before)
                | Q(status=RecommendationGenerationJob.Status.RUNNING, locked_at__isnull=True)
            )
            .order_by("updated_at", "id")
            .first()
        )
        if job is None:
            return False
        job.status = RecommendationGenerationJob.Status.RUNNING
        job.locked_at = now
        job.save(update_fields=["status", "locked_at", "updated_at"])
        job_id = job.id

    try:
        user = User.objects.select_related("trait_profile", "kundali_profile").get(pk=job.user_id)
        if not _has_required_profiles(user):
            RecommendationGenerationJob.objects.filter(pk=job_id).update(
                status=RecommendationGenerationJob.Status.FAILED,
                locked_at=None,
                last_error="User profile is missing required recommendation data.",
                attempts=F("attempts") + 1,
            )
            return True
        user = User.objects.select_related("trait_profile", "kundali_profile").get(pk=job.user_id)
        candidates = list(_candidate_queryset(user, after_id=job.cursor_id)[:job.batch_size])
        if not candidates:
            RecommendationGenerationJob.objects.filter(pk=job_id).update(
                status=RecommendationGenerationJob.Status.COMPLETED,
                locked_at=None,
                last_error="",
                updated_at=timezone.now(),
            )
            return True

        reverse_swipes = set(
            Swipe.objects.filter(target_user_id=user.id, user_id__in=[item.id for item in candidates])
            .values_list("user_id", flat=True)
        )
        rows = []
        for candidate in candidates:
            try:
                scores, insight = _score_candidate_pair(user, candidate)
            except Exception:
                logger.exception(
                    "Unable to score recommendation pair user_id=%s target_user_id=%s",
                    user.id,
                    candidate.id,
                )
                continue
            shared = {
                "kundali_score": scores["kundali_score"],
                "personality_score": scores["personality_score"],
                "final_score": scores["final_score"],
                "match_type": scores["match_type"],
                "processed": True,
            }
            rows.append(RecommendationQueue(
                user_id=user.id,
                target_user_id=candidate.id,
                insight_text=insight,
                **shared,
            ))
            # A newly completed profile is also evaluated for the eligible person's feed.
            if candidate.id not in reverse_swipes:
                reverse_insight = generate_match_insight(
                    candidate.trait_profile.traits or {},
                    user.trait_profile.traits or {},
                    {"kundali_score": scores["kundali_score"], "match_type": scores["match_type"]},
                )
                rows.append(RecommendationQueue(
                    user_id=candidate.id,
                    target_user_id=user.id,
                    insight_text=reverse_insight,
                    **shared,
                ))

        with transaction.atomic():
            RecommendationQueue.objects.bulk_create(rows, batch_size=400, ignore_conflicts=True)
            RecommendationGenerationJob.objects.filter(pk=job_id).update(
                cursor_id=candidates[-1].id,
                candidates_scanned=F("candidates_scanned") + len(candidates),
                status=RecommendationGenerationJob.Status.PENDING,
                locked_at=None,
                last_error="",
                updated_at=timezone.now(),
            )
        return True
    except Exception as exc:
        logger.exception("Recommendation batch failed for job_id=%s", job_id)
        with transaction.atomic():
            current = RecommendationGenerationJob.objects.select_for_update().get(pk=job_id)
            current.attempts += 1
            current.status = (
                RecommendationGenerationJob.Status.FAILED
                if current.attempts >= 5
                else RecommendationGenerationJob.Status.PENDING
            )
            current.locked_at = None
            current.last_error = str(exc)[:4000]
            current.save(update_fields=["attempts", "status", "locked_at", "last_error", "updated_at"])
        return True


def get_recommendations_for_user(
    user_id: int,
    *,
    limit: int = DEFAULT_RECOMMENDATION_LIMIT,
    use_cache: bool = True,
) -> List[Dict[str, object]]:
    """Return already prepared recommendation rows without running scoring on the request."""
    safe_limit = max(1, min(int(limit or DEFAULT_RECOMMENDATION_LIMIT), 100))
    swiped = Swipe.objects.filter(user_id=user_id).values_list("target_user_id", flat=True)
    matched = Match.objects.filter(status=Match.Status.MATCHED, user_a_id=user_id).values_list("user_b_id", flat=True)
    reverse_matched = Match.objects.filter(status=Match.Status.MATCHED, user_b_id=user_id).values_list("user_a_id", flat=True)
    blocked = RealtimeMatch.objects.filter(status=RealtimeMatch.Status.BLOCKED, user_a_id=user_id).values_list("user_b_id", flat=True)
    reverse_blocked = RealtimeMatch.objects.filter(status=RealtimeMatch.Status.BLOCKED, user_b_id=user_id).values_list("user_a_id", flat=True)
    safety_blocked = UserBlock.objects.filter(blocker_id=user_id).values_list("blocked_user_id", flat=True)
    reverse_safety_blocked = UserBlock.objects.filter(blocked_user_id=user_id).values_list("blocker_id", flat=True)
    rows = (
        RecommendationQueue.objects.filter(
            user_id=user_id,
            status__in=[RecommendationQueue.Status.READY, RecommendationQueue.Status.SHOWN],
            target_user__is_active=True,
        )
        .exclude(target_user_id__in=swiped)
        .exclude(target_user_id__in=matched)
        .exclude(target_user_id__in=reverse_matched)
        .exclude(target_user_id__in=blocked)
        .exclude(target_user_id__in=reverse_blocked)
        .exclude(target_user_id__in=safety_blocked)
        .exclude(target_user_id__in=reverse_safety_blocked)
        .select_related("target_user", "target_user__kundali_profile")
        .prefetch_related("target_user__profile_images")
        .order_by("-final_score", "id")[:safe_limit]
    )
    return [
        {
            "user_id": row.target_user_id,
            "name": row.target_user.name,
            "age": _age_from_dob(row.target_user.date_of_birth),
            "compatibility_score": round(row.final_score),
            "kundali_score": round(row.kundali_score),
            "personality_score": round(row.personality_score),
            "insight": row.insight_text,
        }
        for row in rows
    ]


def refresh_daily_recommendations(*, top_n: int = DEFAULT_DAILY_RECOMMENDATION_LIMIT) -> dict:
    """
    Refresh daily snapshots from precomputed recommendation rows.

    This command does not calculate scores; generation remains in the background worker.
    """
    safe_top_n = max(5, min(int(top_n or DEFAULT_DAILY_RECOMMENDATION_LIMIT), 10))
    user_ids = list(User.objects.values_list("id", flat=True).order_by("id"))

    users_processed = 0
    total_created = 0
    for user_id in user_ids:
        ranked = get_recommendations_for_user(user_id, limit=safe_top_n, use_cache=False)
        rows = [
            DailyRecommendation(
                user_id=user_id,
                recommended_user_id=item["user_id"],
                score=item["compatibility_score"],
            )
            for item in ranked
        ]
        with transaction.atomic():
            DailyRecommendation.objects.filter(user_id=user_id).delete()
            if rows:
                DailyRecommendation.objects.bulk_create(rows, batch_size=100)
        if rows:
            top_name = ranked[0].get("name") if ranked else None
            notify_daily_recommendation(user_id=user_id, top_match_name=top_name)
        users_processed += 1
        total_created += len(rows)

    return {
        "users_processed": users_processed,
        "recommendations_created": total_created,
        "top_n": safe_top_n,
    }


def ensure_daily_recommendations_for_user(
    user_id: int,
    *,
    top_n: int = DEFAULT_DAILY_RECOMMENDATION_LIMIT,
) -> List[DailyRecommendation]:
    safe_top_n = max(1, min(int(top_n or DEFAULT_DAILY_RECOMMENDATION_LIMIT), 10))
    today = timezone.localdate()

    swiped_target_ids = Swipe.objects.filter(user_id=user_id).values_list("target_user_id", flat=True)
    matched_ids = Match.objects.filter(status=Match.Status.MATCHED, user_a_id=user_id).values_list("user_b_id", flat=True)
    reverse_matched_ids = Match.objects.filter(status=Match.Status.MATCHED, user_b_id=user_id).values_list("user_a_id", flat=True)
    blocked_ids = RealtimeMatch.objects.filter(status=RealtimeMatch.Status.BLOCKED, user_a_id=user_id).values_list("user_b_id", flat=True)
    reverse_blocked_ids = RealtimeMatch.objects.filter(status=RealtimeMatch.Status.BLOCKED, user_b_id=user_id).values_list("user_a_id", flat=True)
    safety_blocked_ids = UserBlock.objects.filter(blocker_id=user_id).values_list("blocked_user_id", flat=True)
    reverse_safety_blocked_ids = UserBlock.objects.filter(blocked_user_id=user_id).values_list("blocker_id", flat=True)
    existing = list(
        DailyRecommendation.objects.filter(user_id=user_id, created_at__date=today)
        .exclude(recommended_user_id__in=swiped_target_ids)
        .exclude(recommended_user_id__in=matched_ids)
        .exclude(recommended_user_id__in=reverse_matched_ids)
        .exclude(recommended_user_id__in=blocked_ids)
        .exclude(recommended_user_id__in=reverse_blocked_ids)
        .exclude(recommended_user_id__in=safety_blocked_ids)
        .exclude(recommended_user_id__in=reverse_safety_blocked_ids)
        .select_related("recommended_user")
        .prefetch_related("recommended_user__profile_images")
        .order_by("-score", "id")[:safe_top_n]
    )
    if existing:
        return existing

    enqueue_recommendations_for_user(user_id)
    ranked = get_recommendations_for_user(user_id, limit=safe_top_n, use_cache=False)
    rows = [
        DailyRecommendation(
            user_id=user_id,
            recommended_user_id=item["user_id"],
            score=item["compatibility_score"],
        )
        for item in ranked
    ]

    with transaction.atomic():
        DailyRecommendation.objects.filter(user_id=user_id).delete()
        if rows:
            DailyRecommendation.objects.bulk_create(rows, batch_size=100)

    if ranked:
        top_name = ranked[0].get("name")
        notify_daily_recommendation(user_id=user_id, top_match_name=top_name)

    return list(
        DailyRecommendation.objects.filter(user_id=user_id)
        .select_related("recommended_user")
        .prefetch_related("recommended_user__profile_images")
        .order_by("-score", "id")[:safe_top_n]
    )
