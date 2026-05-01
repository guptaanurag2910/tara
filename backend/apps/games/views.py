from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.matching.models import Match
from apps.services.game_question_service import get_random_questions

from .models import Game, GameCategory, GameOption, GameQuestion, GameResponse, GameSession
from .serializers import (
    CurrentQuestionSerializer,
    GameListSerializer,
    RespondGameSerializer,
    StartGameSessionResponseSerializer,
    StartGameSessionSerializer,
    SubmitGameAnswerSerializer,
)
from .services import fetch_next_question, get_session_questions_payload, start_game_session, submit_game_response


def _get_authorized_session_or_404(session_id: int, user):
    return get_object_or_404(
        GameSession.objects.select_related("match").filter(
            Q(match__user_a=user) | Q(match__user_b=user),
        ),
        id=session_id,
    )


class GameListView(generics.ListAPIView):
    serializer_class = GameListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Game.objects.filter(is_active=True).order_by("name", "id")


class StartGameSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = StartGameSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        match_id = serializer.validated_data["match_id"]
        category = serializer.validated_data["category"]
        user = request.user

        match = (
            Match.objects.only("id", "user_a_id", "user_b_id", "status")
            .filter(id=match_id)
            .first()
        )
        if match is None:
            raise ValidationError({"match_id": "Match not found."})

        if user.id not in {match.user_a_id, match.user_b_id}:
            raise ValidationError({"detail": "You are not part of this match."})

        if match.status != Match.Status.MATCHED:
            raise ValidationError({"detail": "Game can only start for matched users."})

        category_obj = (
            GameCategory.objects.only("id", "slug", "is_active")
            .filter(slug=category)
            .first()
        )
        if category_obj is None:
            raise ValidationError({"category": "Category not found."})
        if not category_obj.is_active:
            raise ValidationError({"category": "Category is inactive."})

        has_active_questions = GameQuestion.objects.filter(
            category_id=category_obj.id,
            is_active=True,
            game__is_active=True,
        ).exists()
        if not has_active_questions:
            raise ValidationError({"detail": "No active questions found for this category."})

        questions = get_random_questions(user=user, category=category, limit=3)
        if not questions:
            raise ValidationError(
                {"detail": "No questions available for this category right now."}
            )

        first_question = (
            GameQuestion.objects.filter(
                id=questions[0]["id"],
                is_active=True,
                game__is_active=True,
            )
            .only("id", "game_id")
            .first()
        )
        if first_question is None:
            raise ValidationError({"detail": "Could not resolve game for selected questions."})

        try:
            session = start_game_session(
                match_id=match.id,
                game_id=first_question.game_id,
                user_id=user.id,
                category_id=category_obj.id,
                question_ids=[question["id"] for question in questions],
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        session_questions = get_session_questions_payload(session_id=session.id)

        response_serializer = StartGameSessionResponseSerializer(
            {
                "session_id": session.id,
                "category": category,
                "questions": session_questions,
            }
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class SessionCurrentQuestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, session_id: int):
        _ = _get_authorized_session_or_404(session_id, request.user)
        try:
            payload = fetch_next_question(session_id=session_id)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        serializer = CurrentQuestionSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmitGameAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = SubmitGameAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data["session_id"]
        _ = _get_authorized_session_or_404(session_id, request.user)

        try:
            payload = submit_game_response(
                session_id=session_id,
                user_id=request.user.id,
                question_id=serializer.validated_data["question_id"],
                selected_option_id=serializer.validated_data.get("selected_option"),
                text_answer=serializer.validated_data.get("text_answer", ""),
            )
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc

        return Response(payload, status=status.HTTP_200_OK)


class RespondGameView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RespondGameSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data["session_id"]
        question_id = serializer.validated_data["question_id"]
        selected_option_id = serializer.validated_data["selected_option"]

        session = (
            GameSession.objects.select_related("match")
            .only("id", "game_id", "match__user_a_id", "match__user_b_id")
            .filter(id=session_id)
            .first()
        )
        if session is None:
            raise ValidationError({"session_id": "Session not found."})

        if request.user.id not in {session.match.user_a_id, session.match.user_b_id}:
            raise ValidationError({"detail": "You are not part of this match session."})

        question = (
            GameQuestion.objects.only("id", "game_id")
            .filter(id=question_id, game_id=session.game_id)
            .first()
        )
        if question is None:
            raise ValidationError({"question_id": "Question does not belong to this session."})

        option = (
            GameOption.objects.only("id", "question_id")
            .filter(id=selected_option_id, question_id=question.id)
            .first()
        )
        if option is None:
            raise ValidationError({"selected_option": "Selected option is invalid for this question."})

        GameResponse.objects.update_or_create(
            session_id=session.id,
            user_id=request.user.id,
            question_id=question.id,
            defaults={
                "selected_option_id": option.id,
                "text_answer": "",
            },
        )
        return Response({"success": True}, status=status.HTTP_200_OK)
