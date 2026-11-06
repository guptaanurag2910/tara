from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.chat.models import Message
from apps.games.models import GameResponse, GameSession
from apps.realtime.models import Match as RealtimeMatch
from apps.notifications.models import Notification

from .models import (
    DailyRecommendation,
    DatePlan,
    DateSafetyCheckIn,
    GameNightSession,
    Match,
    ModerationAction,
    RecommendationQueue,
    SafetyAppeal,
    SafetyAuditEvent,
    SafetyReport,
    Swipe,
    UserBlock,
)

User = get_user_model()


def is_blocked_between(user_a_id: int, user_b_id: int) -> bool:
    if not user_a_id or not user_b_id:
        return False
    return UserBlock.objects.filter(
        Q(blocker_id=user_a_id, blocked_user_id=user_b_id)
        | Q(blocker_id=user_b_id, blocked_user_id=user_a_id)
    ).exists()


def is_user_restricted(user_id: int, scope: str) -> bool:
    return ModerationAction.objects.filter(
        subject_id=user_id,
        action_type=ModerationAction.ActionType.RESTRICTION,
        reversed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).filter(Q(scope="") | Q(scope="all") | Q(scope=scope)).exists()


def _pair_ids(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def _audit(actor, action: str, *, report=None, subject_user_id=None, metadata=None):
    SafetyAuditEvent.objects.create(
        actor=actor,
        report=report,
        action=action,
        subject_user_id=subject_user_id,
        metadata=metadata or {},
    )


class BlockInputSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(min_value=1)


class ReportInputSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=SafetyReport.Category.choices)
    target_type = serializers.ChoiceField(choices=SafetyReport.TargetType.choices)
    target_id = serializers.CharField(max_length=64)
    details = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class DatePlanInputSerializer(serializers.Serializer):
    activity = serializers.CharField(max_length=160)
    scheduled_at = serializers.DateTimeField()
    public_venue = serializers.CharField(max_length=255)
    is_public_venue = serializers.BooleanField()
    share_with_trusted_contact = serializers.BooleanField(required=False, default=False)
    trusted_contact_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    trusted_contact_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)

    def validate(self, attrs):
        if attrs["scheduled_at"] <= timezone.now():
            raise serializers.ValidationError({"scheduled_at": "Choose a future date and time."})
        if not attrs["is_public_venue"]:
            raise serializers.ValidationError({"is_public_venue": "Choose a public venue for an in-person plan."})
        if attrs["share_with_trusted_contact"] and not (attrs.get("trusted_contact_name") and attrs.get("trusted_contact_phone")):
            raise serializers.ValidationError({"trusted_contact_phone": "Add a trusted contact's name and phone, or turn off sharing."})
        return attrs


class DateSafetyCheckInInputSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=DateSafetyCheckIn.Status.choices)
    details = serializers.CharField(required=False, allow_blank=True, max_length=1000)


class SafetyBlockView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "block"

    def get(self, request):
        rows = UserBlock.objects.filter(blocker=request.user).select_related("blocked_user")
        return Response([{"user_id": row.blocked_user_id, "name": row.blocked_user.name, "created_at": row.created_at} for row in rows])

    def post(self, request):
        serializer = BlockInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        blocked_id = serializer.validated_data["user_id"]
        if blocked_id == request.user.id:
            raise serializers.ValidationError({"user_id": "You cannot block your own account."})
        target = get_object_or_404(User, pk=blocked_id, is_staff=False, is_superuser=False)
        left_id, right_id = _pair_ids(request.user.id, target.id)
        matched_id = Match.objects.filter(user_a_id=left_id, user_b_id=right_id, status=Match.Status.MATCHED).values_list("id", flat=True).first()
        with transaction.atomic():
            row, created = UserBlock.objects.get_or_create(blocker=request.user, blocked_user=target)
            RealtimeMatch.objects.update_or_create(
                user_a_id=left_id,
                user_b_id=right_id,
                defaults={"status": RealtimeMatch.Status.BLOCKED},
            )
            Match.objects.filter(user_a_id=left_id, user_b_id=right_id).update(
                status=Match.Status.BLOCKED, is_visible=False, updated_at=timezone.now()
            )
            RecommendationQueue.objects.filter(
                Q(user_id__in=(left_id, right_id), target_user_id__in=(left_id, right_id))
            ).delete()
            DailyRecommendation.objects.filter(
                Q(user_id=left_id, recommended_user_id=right_id)
                | Q(user_id=right_id, recommended_user_id=left_id)
            ).delete()
            Swipe.objects.filter(
                Q(user_id=left_id, target_user_id=right_id)
                | Q(user_id=right_id, target_user_id=left_id)
            ).update(action=Swipe.Action.PASS, note="", note_delivered_at=None, updated_at=timezone.now())
            GameSession.objects.filter(match__user_a_id=left_id, match__user_b_id=right_id, status__in=[GameSession.Status.INVITED, GameSession.Status.ACTIVE]).update(status=GameSession.Status.EXPIRED)
            GameNightSession.objects.filter(
                user_a_id=left_id, user_b_id=right_id, status=GameNightSession.Status.ACTIVE
            ).update(status=GameNightSession.Status.PASSED)
            if matched_id:
                Notification.objects.filter(action_url=f"/chat/{matched_id}").delete()
            _audit(request.user, "user_blocked", subject_user_id=target.id)
        if matched_id:
            channel_layer = get_channel_layer()
            if channel_layer:
                event = {"type": "safety.close"}
                async_to_sync(channel_layer.group_send)(f"match_{matched_id}", event)
                async_to_sync(channel_layer.group_send)(f"chat_match_{matched_id}", event)
        return Response({"blocked": True, "created": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, user_id: int):
        row = get_object_or_404(UserBlock, blocker=request.user, blocked_user_id=user_id)
        row.delete()
        _audit(request.user, "user_unblocked", subject_user_id=user_id)
        # Deliberately do not restore the match or contact channel automatically.
        return Response(status=status.HTTP_204_NO_CONTENT)


class SafetyConnectionActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "block"

    def post(self, request, match_id: int):
        action = serializers.ChoiceField(choices=["pause", "resume", "unmatch"]).run_validation(request.data.get("action"))
        match = get_object_or_404(
            Match.objects.filter(Q(user_a=request.user) | Q(user_b=request.user)),
            pk=match_id,
        )
        if is_blocked_between(match.user_a_id, match.user_b_id) or match.status == Match.Status.BLOCKED:
            raise serializers.ValidationError({"detail": "A blocked connection cannot be changed here."})
        if match.status not in {Match.Status.MATCHED, Match.Status.UNMATCHED}:
            raise serializers.ValidationError({"detail": "Only confirmed matches can be paused or unmatched."})
        if action in {"pause", "resume"} and match.status != Match.Status.MATCHED:
            raise serializers.ValidationError({"detail": "This connection is no longer active."})
        with transaction.atomic():
            if action == "pause":
                match.is_visible = False
            elif action == "resume":
                match.is_visible = True
            else:
                match.status = Match.Status.UNMATCHED
                match.is_visible = False
            match.save(update_fields=["status", "is_visible", "updated_at"])
            if action == "unmatch":
                GameSession.objects.filter(match=match, status__in=[GameSession.Status.INVITED, GameSession.Status.ACTIVE]).update(status=GameSession.Status.EXPIRED)
                RecommendationQueue.objects.filter(Q(user_id=match.user_a_id, target_user_id=match.user_b_id) | Q(user_id=match.user_b_id, target_user_id=match.user_a_id)).delete()
                DailyRecommendation.objects.filter(Q(user_id=match.user_a_id, recommended_user_id=match.user_b_id) | Q(user_id=match.user_b_id, recommended_user_id=match.user_a_id)).delete()
            _audit(request.user, f"connection_{action}", subject_user_id=_other_user(match, request.user.id).id, metadata={"match_id": match.id})
        channel_layer = get_channel_layer()
        if channel_layer and action in {"pause", "unmatch"}:
            event = {"type": "safety.close"}
            async_to_sync(channel_layer.group_send)(f"chat_match_{match.id}", event)
            async_to_sync(channel_layer.group_send)(f"match_{match.id}", event)
        return Response({"match_id": match.id, "action": action, "status": match.status, "is_visible": match.is_visible})


def _participant_match(match_id: int, reporter):
    return get_object_or_404(
        Match.objects.filter(status__in=[Match.Status.MATCHED, Match.Status.BLOCKED]).filter(
            Q(user_a=reporter) | Q(user_b=reporter)
        ),
        pk=match_id,
    )


def _other_user(match: Match, actor_id: int):
    return match.user_b if match.user_a_id == actor_id else match.user_a


def _resolve_report_target(reporter, target_type: str, target_id: str):
    try:
        object_id = int(target_id)
    except (TypeError, ValueError):
        raise serializers.ValidationError({"target_id": "Choose a valid item to report."})

    if target_type == SafetyReport.TargetType.PROFILE:
        target = get_object_or_404(User, pk=object_id, is_staff=False, is_superuser=False)
        if target.id == reporter.id:
            raise serializers.ValidationError({"target_id": "You cannot report your own profile."})
        return target, {"type": "profile", "user_id": target.id}

    if target_type == SafetyReport.TargetType.CHAT_MESSAGE:
        message = get_object_or_404(Message.objects.select_related("match", "sender"), pk=object_id)
        if reporter.id not in (message.match.user_a_id, message.match.user_b_id):
            raise serializers.ValidationError({"target_id": "This message is not in your conversation."})
        related = list(Message.objects.filter(match=message.match, created_at__gte=message.created_at - timedelta(minutes=5), created_at__lte=message.created_at + timedelta(minutes=5)).order_by("created_at")[:20])
        evidence = {
            "type": "chat_message", "message_id": message.id, "match_id": message.match_id,
            "sender_id": message.sender_id, "reported_at": message.created_at.isoformat(),
            "content": message.content[:5000],
            "context": [{"message_id": item.id, "sender_id": item.sender_id, "created_at": item.created_at.isoformat(), "content": item.content[:1000]} for item in related],
        }
        return _other_user(message.match, reporter.id), evidence

    if target_type == SafetyReport.TargetType.CONVERSATION:
        match = _participant_match(object_id, reporter)
        last_messages = Message.objects.filter(match=match).order_by("-created_at")[:20]
        evidence = {"type": "conversation", "match_id": match.id, "context": [{"message_id": item.id, "sender_id": item.sender_id, "created_at": item.created_at.isoformat(), "content": item.content[:1000]} for item in reversed(list(last_messages))]}
        return _other_user(match, reporter.id), evidence

    if target_type in (SafetyReport.TargetType.GAME_SESSION, SafetyReport.TargetType.GAME_PHOTO):
        if target_type == SafetyReport.TargetType.GAME_SESSION:
            session = get_object_or_404(GameSession.objects.select_related("match", "category"), pk=object_id)
            match = session.match
            evidence = {"type": target_type, "session_id": session.id, "category": getattr(session.category, "slug", None), "status": session.status, "match_id": match.id}
        else:
            response = get_object_or_404(GameResponse.objects.select_related("session__match", "question"), pk=object_id)
            session = response.session
            match = session.match
            evidence = {"type": target_type, "response_id": response.id, "session_id": session.id, "question_id": response.question_id, "caption": response.photo_caption, "match_id": match.id}
        if reporter.id not in (match.user_a_id, match.user_b_id):
            raise serializers.ValidationError({"target_id": "This game is not part of your conversation."})
        return _other_user(match, reporter.id), evidence

    if target_type == SafetyReport.TargetType.GAME_NIGHT:
        room = get_object_or_404(GameNightSession.objects.prefetch_related("messages"), pk=object_id)
        if reporter.id not in (room.user_a_id, room.user_b_id):
            raise serializers.ValidationError({"target_id": "This room is not yours."})
        other_id = room.user_b_id if room.user_a_id == reporter.id else room.user_a_id
        evidence = {"type": target_type, "room_id": room.id, "game_kind": room.game_kind, "status": room.status, "messages": [{"sender_id": msg.sender_id, "created_at": msg.created_at.isoformat(), "content": msg.content} for msg in room.messages.all()]}
        return get_object_or_404(User, pk=other_id), evidence

    if target_type == SafetyReport.TargetType.PROFILE_PHOTO:
        from apps.users.models import UserProfileImage
        photo = get_object_or_404(UserProfileImage.objects.select_related("user"), pk=object_id)
        target = photo.user
        if target.id == reporter.id:
            raise serializers.ValidationError({"target_id": "You cannot report your own photo."})
        return target, {"type": target_type, "photo_id": photo.id, "owner_id": target.id}

    raise serializers.ValidationError({"target_type": "This content type cannot be reported."})


class SafetyReportCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "report"

    def post(self, request):
        serializer = ReportInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        reported_user, evidence = _resolve_report_target(request.user, values["target_type"], values["target_id"])
        urgent = values["category"] == SafetyReport.Category.UNDERAGE
        if values["category"] == SafetyReport.Category.HARASSMENT and any(token in values.get("details", "").lower() for token in ("threat", "stalking", "blackmail", "sextortion")):
            urgent = True
        report = SafetyReport.objects.create(
            reporter=request.user,
            reported_user=reported_user,
            category=values["category"],
            target_type=values["target_type"],
            target_id=values["target_id"],
            details=values.get("details", ""),
            evidence_snapshot=evidence,
            priority=SafetyReport.Priority.URGENT if urgent else SafetyReport.Priority.STANDARD,
        )
        _audit(request.user, "report_submitted", report=report, subject_user_id=reported_user.id, metadata={"category": report.category, "priority": report.priority})
        return Response({"id": report.id, "status": report.status, "priority": report.priority, "detail": "Your report was received."}, status=status.HTTP_201_CREATED)


class MySafetyReportsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = SafetyReport.objects.filter(reporter=request.user).order_by("-created_at")
        return Response([{"id": row.id, "category": row.category, "status": row.status, "created_at": row.created_at, "updated_at": row.updated_at} for row in rows])


class DatePlanView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _match(self, match_id, user):
        match = get_object_or_404(Match.objects.filter(status=Match.Status.MATCHED).filter(Q(user_a=user) | Q(user_b=user)), pk=match_id)
        if is_blocked_between(match.user_a_id, match.user_b_id):
            from django.http import Http404
            raise Http404("This connection is no longer available.")
        return match

    def _payload(self, plan, user):
        data = {
            "id": plan.id, "match_id": plan.match_id, "activity": plan.activity,
            "scheduled_at": plan.scheduled_at, "public_venue": plan.public_venue,
            "is_public_venue": plan.is_public_venue, "share_with_trusted_contact": plan.share_with_trusted_contact,
            "created_by_id": plan.created_by_id, "updated_at": plan.updated_at,
        }
        if plan.created_by_id == user.id:
            data["trusted_contact_name"] = plan.trusted_contact_name
            data["trusted_contact_phone"] = plan.trusted_contact_phone
            if plan.share_with_trusted_contact:
                data["share_text"] = f"I'm meeting {plan.match.user_b.name if plan.match.user_a_id == user.id else plan.match.user_a.name} at {plan.public_venue} for {plan.activity} on {timezone.localtime(plan.scheduled_at).strftime('%Y-%m-%d %H:%M %Z')}. I'll check in with you after."
        return data

    def get(self, request, match_id):
        match = self._match(match_id, request.user)
        plan = DatePlan.objects.filter(match=match).select_related("match__user_a", "match__user_b").first()
        if plan is None:
            return Response({"date_plan": None, "my_check_in": None})
        check_in = DateSafetyCheckIn.objects.filter(plan=plan, user=request.user).first()
        return Response({"date_plan": self._payload(plan, request.user), "my_check_in": {"status": check_in.status, "details": check_in.details, "updated_at": check_in.updated_at} if check_in else None})

    def put(self, request, match_id):
        match = self._match(match_id, request.user)
        serializer = DatePlanInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan, created = DatePlan.objects.update_or_create(
            match=match,
            defaults={**serializer.validated_data, "created_by": request.user},
        )
        _audit(request.user, "date_plan_created" if created else "date_plan_updated", subject_user_id=_other_user(match, request.user.id).id, metadata={"match_id": match.id, "plan_id": plan.id})
        return Response(self._payload(plan, request.user), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DateSafetyCheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, match_id):
        match = get_object_or_404(Match.objects.filter(status__in=[Match.Status.MATCHED, Match.Status.BLOCKED]).filter(Q(user_a=request.user) | Q(user_b=request.user)), pk=match_id)
        plan = get_object_or_404(DatePlan, match=match)
        serializer = DateSafetyCheckInInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if values["status"] == DateSafetyCheckIn.Status.SAFE and timezone.now() < plan.scheduled_at:
            raise serializers.ValidationError({"status": "A safe check-in is available after the planned time."})
        checkin, _ = DateSafetyCheckIn.objects.update_or_create(plan=plan, user=request.user, defaults=values)
        report_id = None
        if values["status"] == DateSafetyCheckIn.Status.CONCERN:
            other = _other_user(match, request.user.id)
            report = SafetyReport.objects.create(
                reporter=request.user, reported_user=other,
                category=SafetyReport.Category.UNSAFE_CONTENT,
                target_type=SafetyReport.TargetType.CONVERSATION, target_id=str(match.id),
                details=values.get("details", "Safety concern submitted from post-date check-in."),
                evidence_snapshot={"type": "date_safety_check_in", "match_id": match.id, "plan_id": plan.id, "activity": plan.activity, "scheduled_at": plan.scheduled_at.isoformat(), "public_venue": plan.public_venue, "check_in_id": checkin.id},
                priority=SafetyReport.Priority.URGENT,
            )
            report_id = report.id
            _audit(request.user, "date_safety_concern_reported", report=report, subject_user_id=other.id, metadata={"match_id": match.id, "plan_id": plan.id})
        else:
            _audit(request.user, "date_safety_check_in", subject_user_id=_other_user(match, request.user.id).id, metadata={"match_id": match.id, "plan_id": plan.id})
        return Response({"status": checkin.status, "report_id": report_id, "detail": "Your check-in was saved." if report_id is None else "Your safety concern was sent to our safety team."}, status=status.HTTP_200_OK)


class SafetyAppealCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, action_id: int):
        action = get_object_or_404(ModerationAction, pk=action_id, subject=request.user)
        if action.action_type not in {ModerationAction.ActionType.RESTRICTION, ModerationAction.ActionType.SUSPENSION, ModerationAction.ActionType.BAN}:
            raise serializers.ValidationError({"detail": "This decision cannot be appealed through this form."})
        statement = serializers.CharField(max_length=2000).run_validation(request.data.get("statement", ""))
        appeal, created = SafetyAppeal.objects.get_or_create(action=action, appellant=request.user, defaults={"statement": statement})
        if not created:
            raise serializers.ValidationError({"detail": "An appeal for this decision is already open."})
        _audit(request.user, "appeal_submitted", subject_user_id=request.user.id, metadata={"appeal_id": appeal.id, "action_id": action.id})
        return Response({"id": appeal.id, "status": appeal.status}, status=status.HTTP_201_CREATED)


class MyModerationActionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = ModerationAction.objects.filter(
            subject=request.user,
            action_type__in=[ModerationAction.ActionType.RESTRICTION, ModerationAction.ActionType.SUSPENSION, ModerationAction.ActionType.BAN],
            reversed_at__isnull=True,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("-created_at")
        return Response([{
            "id": row.id, "action_type": row.action_type, "reason_code": row.reason_code,
            "notes": row.notes, "created_at": row.created_at, "expires_at": row.expires_at,
            "appeal_status": row.appeals.order_by("-created_at").values_list("status", flat=True).first(),
        } for row in rows])


class IsSafetyModerator(permissions.BasePermission):
    message = "You do not have permission to review safety cases."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.groups.filter(name__in=["Moderators", "Senior Moderators", "Safety Admins"]).exists()))


class ModerationQueueView(APIView):
    permission_classes = [IsSafetyModerator]

    def get(self, request):
        status_filter = request.query_params.get("status")
        rows = SafetyReport.objects.select_related("reporter", "reported_user", "assigned_to").order_by("priority", "created_at")
        if status_filter in SafetyReport.Status.values:
            rows = rows.filter(status=status_filter)
        page = rows[:100]
        _audit(request.user, "moderation_queue_viewed", metadata={"count": len(page)})
        SafetyAuditEvent.objects.bulk_create([
            SafetyAuditEvent(actor=request.user, report=row, action="moderation_evidence_viewed", subject_user_id=row.reported_user_id)
            for row in page
        ])
        return Response([{"id": row.id, "category": row.category, "priority": row.priority, "status": row.status, "target_type": row.target_type, "target_id": row.target_id, "reporter_id": row.reporter_id, "reported_user_id": row.reported_user_id, "assigned_to_id": row.assigned_to_id, "details": row.details, "evidence": row.evidence_snapshot, "created_at": row.created_at} for row in page])


class ModerationActionView(APIView):
    permission_classes = [IsSafetyModerator]

    def post(self, request, report_id: int):
        report = get_object_or_404(SafetyReport.objects.select_related("reported_user"), pk=report_id)
        action_type = serializers.ChoiceField(choices=ModerationAction.ActionType.choices).run_validation(request.data.get("action_type"))
        reason_code = serializers.RegexField(regex=r"^[a-z0-9_]{2,40}$").run_validation(str(request.data.get("reason_code", "")).strip().lower())
        notes = serializers.CharField(required=False, allow_blank=True, max_length=1000).run_validation(request.data.get("notes", ""))
        if action_type == ModerationAction.ActionType.REINSTATEMENT and not request.user.is_superuser:
            raise permissions.PermissionDenied("Only a safety administrator can reinstate an account.")
        expires_at = None
        if action_type == ModerationAction.ActionType.RESTRICTION:
            raw_expires = request.data.get("expires_at")
            if not raw_expires:
                raise serializers.ValidationError({"expires_at": "A temporary restriction needs an end time."})
            expires_at = serializers.DateTimeField().run_validation(raw_expires)
            if expires_at <= timezone.now():
                raise serializers.ValidationError({"expires_at": "Choose a future end time."})
        with transaction.atomic():
            action = ModerationAction.objects.create(
                report=report, subject=report.reported_user, actor=request.user, action_type=action_type,
                reason_code=reason_code, scope=str(request.data.get("scope", ""))[:32], notes=notes, expires_at=expires_at,
            )
            if report.reported_user and action_type in {ModerationAction.ActionType.SUSPENSION, ModerationAction.ActionType.BAN}:
                report.reported_user.is_active = False
                report.reported_user.save(update_fields=["is_active"])
            if report.reported_user and action_type == ModerationAction.ActionType.REINSTATEMENT:
                report.reported_user.is_active = True
                report.reported_user.save(update_fields=["is_active"])
            report.status = SafetyReport.Status.ACTIONED if action_type != ModerationAction.ActionType.WARNING else SafetyReport.Status.CLOSED
            report.save(update_fields=["status", "updated_at"])
            _audit(request.user, "moderation_action_created", report=report, subject_user_id=report.reported_user_id, metadata={"action_id": action.id, "action_type": action_type, "reason_code": reason_code})
        return Response({"id": action.id, "action_type": action.action_type, "report_status": report.status}, status=status.HTTP_201_CREATED)


class ModerationAppealsQueueView(APIView):
    permission_classes = [IsSafetyModerator]

    def get(self, request):
        rows = SafetyAppeal.objects.select_related("appellant", "action", "action__subject", "action__report").order_by("created_at")
        status_filter = request.query_params.get("status")
        if status_filter in SafetyAppeal.Status.values:
            rows = rows.filter(status=status_filter)
        page = list(rows[:100])
        SafetyAuditEvent.objects.bulk_create([
            SafetyAuditEvent(actor=request.user, report=row.action.report, action="moderation_appeal_viewed", subject_user_id=row.action.subject_id, metadata={"appeal_id": row.id})
            for row in page
        ])
        return Response([{
            "id": row.id, "status": row.status, "statement": row.statement, "outcome_note": row.outcome_note,
            "created_at": row.created_at, "action_id": row.action_id, "action_type": row.action.action_type,
            "reason_code": row.action.reason_code, "subject_user_id": row.action.subject_id,
            "appellant_id": row.appellant_id, "report_id": row.action.report_id,
        } for row in page])


class ModerationAppealReviewView(APIView):
    permission_classes = [IsSafetyModerator]

    def post(self, request, appeal_id: int):
        appeal = get_object_or_404(SafetyAppeal.objects.select_related("action", "action__subject", "action__report"), pk=appeal_id)
        next_status = serializers.ChoiceField(choices=[SafetyAppeal.Status.UPHELD, SafetyAppeal.Status.OVERTURNED]).run_validation(request.data.get("status"))
        outcome = serializers.CharField(max_length=1000).run_validation(request.data.get("outcome_note", ""))
        if appeal.status not in {SafetyAppeal.Status.SUBMITTED, SafetyAppeal.Status.IN_REVIEW}:
            raise serializers.ValidationError({"detail": "This appeal has already been reviewed."})
        with transaction.atomic():
            appeal.status = next_status
            appeal.outcome_note = outcome
            appeal.reviewer = request.user
            appeal.save(update_fields=["status", "outcome_note", "reviewer", "updated_at"])
            if next_status == SafetyAppeal.Status.OVERTURNED:
                action = appeal.action
                action.reversed_at = timezone.now()
                action.reversed_by = request.user
                action.reversal_reason = outcome
                action.save(update_fields=["reversed_at", "reversed_by", "reversal_reason"])
                active_lock = ModerationAction.objects.filter(
                    subject=action.subject,
                    action_type__in=[ModerationAction.ActionType.SUSPENSION, ModerationAction.ActionType.BAN],
                    reversed_at__isnull=True,
                ).exclude(pk=action.pk).exists()
                if action.subject and not active_lock:
                    action.subject.is_active = True
                    action.subject.save(update_fields=["is_active"])
            _audit(request.user, "moderation_appeal_reviewed", report=appeal.action.report, subject_user_id=appeal.action.subject_id, metadata={"appeal_id": appeal.id, "status": appeal.status})
        return Response({"id": appeal.id, "status": appeal.status, "reviewer_id": appeal.reviewer_id})
