from typing import Optional

from django.db import transaction

from apps.chat.services import create_game_event_message
from apps.matching.models import Match

from .models import Game, GameOption, GameQuestion, GameResponse, GameSession, GameSessionQuestion

SAME_PICK_RESULT_TEXT = "You both picked the same 😄"
DIFFERENT_PICK_RESULT_TEXT = "Opposites 👀 interesting"


def start_game_session(*, match_id: int, game_id: int, user_id: int) -> GameSession:
    """
    Start a gameplay session for a match.

    Returns the active session object. If an active session already exists for
    the same match+game, that session is returned.
    """
    match = (
        Match.objects.only("id", "user_a_id", "user_b_id", "status")
        .filter(id=match_id)
        .first()
    )
    if match is None:
        raise ValueError("Match not found.")
    if match.status != Match.Status.MATCHED:
        raise ValueError("Game sessions can only be started for matched users.")
    if user_id not in {match.user_a_id, match.user_b_id}:
        raise ValueError("User is not part of this match.")

    game = Game.objects.only("id", "name", "is_active").filter(id=game_id).first()
    if game is None:
        raise ValueError("Game not found.")
    if not game.is_active:
        raise ValueError("Game is not active.")

    with transaction.atomic():
        session, created = GameSession.objects.select_for_update().get_or_create(
            match_id=match.id,
            game_id=game.id,
            status=GameSession.Status.ACTIVE,
            defaults={
                "started_by_id": user_id,
                "current_question_index": 0,
            },
        )
    if created:
        create_game_event_message(
            match_id=match.id,
            sender_id=user_id,
            content=f"Started {game.name} 🎮",
            event_type="game_started",
            payload={
                "match_id": match.id,
                "session_id": session.id,
                "game_id": game.id,
                "game_name": game.name,
            },
            dedupe_key=f"game_started:{session.id}",
        )
    return session


def fetch_next_question(*, session_id: int) -> dict:
    """
    Fetch the current question for a game session based on current_question_index.

    Returns:
        {
            "question_text": str | None,
            "options": list[str],
        }
    """
    session = (
        GameSession.objects.only("id", "game_id", "match_id", "started_by_id", "current_question_index")
        .filter(id=session_id)
        .first()
    )
    if session is None:
        raise ValueError("Game session not found.")

    current_index = max(int(session.current_question_index or 0), 0)
    question = (
        GameQuestion.objects.filter(game_id=session.game_id, is_active=True)
        .order_by("order", "id")[current_index : current_index + 1]
        .first()
    )
    if question is None:
        return {"question_id": None, "question_text": None, "options": []}

    options = list(
        GameOption.objects.filter(question_id=question.id)
        .order_by("order", "id")
        .values_list("option_text", flat=True)
    )

    create_game_event_message(
        match_id=session.match_id,
        sender_id=session.started_by_id,
        content=f"🎮 {question.question_text}",
        event_type="game_question",
        payload={
            "match_id": session.match_id,
            "session_id": session.id,
            "game_id": session.game_id,
            "question_id": question.id,
            "question_text": question.question_text,
            "options": options,
        },
        dedupe_key=f"game_question:{session.id}:{question.id}",
    )
    return {
        "question_id": question.id,
        "question_text": question.question_text,
        "options": options,
    }


def submit_game_response(
    *,
    session_id: int,
    user_id: int,
    question_id: int,
    selected_option_id: Optional[int] = None,
    text_answer: str = "",
) -> dict:
    """
    Save a user's game response and advance session state when both users answered.

    Returns an updated session state payload.
    """
    with transaction.atomic():
        session = (
            GameSession.objects.select_for_update()
            .select_related("match")
            .filter(id=session_id)
            .first()
        )
        if session is None:
            raise ValueError("Game session not found.")
        if session.status != GameSession.Status.ACTIVE:
            raise ValueError("Game session is not active.")

        participant_ids = {session.match.user_a_id, session.match.user_b_id}
        if user_id not in participant_ids:
            raise ValueError("User is not part of this match session.")

        ordered_question_ids = list(
            GameQuestion.objects.filter(game_id=session.game_id, is_active=True)
            .order_by("order", "id")
            .values_list("id", flat=True)
        )
        if not ordered_question_ids:
            session.status = GameSession.Status.COMPLETED
            session.save(update_fields=["status"])
            return {
                "session_id": session.id,
                "status": session.status,
                "current_question_index": session.current_question_index,
                "both_answered": True,
                "is_completed": True,
            }

        current_index = max(int(session.current_question_index or 0), 0)
        if current_index >= len(ordered_question_ids):
            session.status = GameSession.Status.COMPLETED
            session.save(update_fields=["status"])
            return {
                "session_id": session.id,
                "status": session.status,
                "current_question_index": session.current_question_index,
                "both_answered": True,
                "is_completed": True,
            }

        expected_question_id = ordered_question_ids[current_index]
        if int(question_id) != int(expected_question_id):
            raise ValueError("Submitted question is not the current session question.")

        question = GameQuestion.objects.filter(
            id=question_id,
            game_id=session.game_id,
            is_active=True,
        ).first()
        if question is None:
            raise ValueError("Question not found for this session.")

        selected_option = None
        if selected_option_id is not None:
            selected_option = GameOption.objects.filter(
                id=selected_option_id,
                question_id=question.id,
            ).first()
            if selected_option is None:
                raise ValueError("Selected option does not belong to the question.")

        response, response_created = GameResponse.objects.update_or_create(
            session_id=session.id,
            user_id=user_id,
            question_id=question.id,
            defaults={
                "selected_option_id": selected_option.id if selected_option else None,
                "text_answer": (text_answer or "").strip(),
            },
        )

        if response_created:
            answer_text = (
                selected_option.option_text
                if selected_option is not None
                else (response.text_answer or "").strip()
            )
            if answer_text:
                create_game_event_message(
                    match_id=session.match_id,
                    sender_id=user_id,
                    content=answer_text,
                    event_type="game_answer",
                    payload={
                        "match_id": session.match_id,
                        "session_id": session.id,
                        "question_id": question.id,
                        "selected_option_id": selected_option.id if selected_option else None,
                        "answer_text": answer_text,
                    },
                    dedupe_key=f"game_answer:{session.id}:{question.id}:{user_id}",
                )

        answered_user_ids = set(
            GameResponse.objects.filter(session_id=session.id, question_id=question.id)
            .values_list("user_id", flat=True)
            .distinct()
        )
        both_answered = participant_ids.issubset(answered_user_ids)

        is_completed = False
        result_text = None
        if both_answered:
            result_text = generate_question_result(
                session_id=session.id,
                question_id=question.id,
            )
            create_game_event_message(
                match_id=session.match_id,
                sender_id=session.started_by_id,
                content=result_text,
                event_type="game_result",
                payload={
                    "match_id": session.match_id,
                    "session_id": session.id,
                    "question_id": question.id,
                    "result_text": result_text,
                },
                dedupe_key=f"game_result:{session.id}:{question.id}",
            )
            next_index = current_index + 1
            if next_index >= len(ordered_question_ids):
                session.status = GameSession.Status.COMPLETED
                session.current_question_index = current_index
                is_completed = True
                session.save(update_fields=["status", "current_question_index"])
            else:
                session.current_question_index = next_index
                session.save(update_fields=["current_question_index"])

        return {
            "session_id": session.id,
            "status": session.status,
            "current_question_index": session.current_question_index,
            "both_answered": both_answered,
            "is_completed": is_completed or session.status == GameSession.Status.COMPLETED,
            "result_text": result_text,
        }


def generate_question_result(*, session_id: int, question_id: int) -> str:
    """
    Generate a simple result text for a question after both users answered.
    """
    session = (
        GameSession.objects.select_related("match")
        .only("id", "match__user_a_id", "match__user_b_id")
        .filter(id=session_id)
        .first()
    )
    if session is None:
        raise ValueError("Game session not found.")

    participant_ids = {session.match.user_a_id, session.match.user_b_id}
    responses = list(
        GameResponse.objects.filter(
            session_id=session.id,
            question_id=question_id,
            user_id__in=participant_ids,
        )
        .order_by("created_at", "id")
        .only("user_id", "selected_option_id", "text_answer")
    )
    if len({response.user_id for response in responses}) < 2:
        raise ValueError("Both users have not answered yet.")

    first, second = responses[0], responses[1]
    if first.selected_option_id and second.selected_option_id:
        if first.selected_option_id == second.selected_option_id:
            return SAME_PICK_RESULT_TEXT
        return DIFFERENT_PICK_RESULT_TEXT

    first_text = (first.text_answer or "").strip().lower()
    second_text = (second.text_answer or "").strip().lower()
    if first_text and second_text and first_text == second_text:
        return SAME_PICK_RESULT_TEXT
    return DIFFERENT_PICK_RESULT_TEXT


def calculate_game_result(session_id: int) -> dict:
    """
    Calculate aggregate game result for a session by comparing both users' answers.

    Returns:
        {
            "total": int,    # total comparable questions
            "matched": int,  # answer matches between both users
            "summary": str,
        }
    """
    session = (
        GameSession.objects.select_related("match")
        .only("id", "match__user_a_id", "match__user_b_id")
        .filter(id=session_id)
        .first()
    )
    if session is None:
        raise ValueError("Game session not found.")

    participant_ids = {session.match.user_a_id, session.match.user_b_id}

    ordered_question_ids = list(
        GameSessionQuestion.objects.filter(session_id=session.id)
        .order_by("order", "id")
        .values_list("question_id", flat=True)
    )
    if not ordered_question_ids:
        ordered_question_ids = list(
            GameResponse.objects.filter(
                session_id=session.id,
                user_id__in=participant_ids,
            )
            .order_by("question_id")
            .values_list("question_id", flat=True)
            .distinct()
        )

    question_text_map = dict(
        GameQuestion.objects.filter(id__in=ordered_question_ids).values_list("id", "question_text")
    )

    response_rows = list(
        GameResponse.objects.filter(
            session_id=session.id,
            user_id__in=participant_ids,
            question_id__in=ordered_question_ids,
        )
        .select_related("selected_option")
        .only(
            "question_id",
            "user_id",
            "selected_option_id",
            "selected_option__option_text",
            "text_answer",
        )
    )
    response_map = {(row.question_id, row.user_id): row for row in response_rows}

    user_a_id = session.match.user_a_id
    user_b_id = session.match.user_b_id

    questions: list[dict] = []
    total = 0
    matched = 0

    for question_id in ordered_question_ids:
        user_a_response = response_map.get((question_id, user_a_id))
        user_b_response = response_map.get((question_id, user_b_id))

        user_a_value = _serialize_response_value(user_a_response)
        user_b_value = _serialize_response_value(user_b_response)

        is_match = _responses_match(user_a_response, user_b_response)
        if user_a_response is not None and user_b_response is not None:
            total += 1
            if is_match:
                matched += 1

        questions.append(
            {
                "question": question_text_map.get(question_id, f"Question {question_id}"),
                "user_a": user_a_value,
                "user_b": user_b_value,
                "match": is_match,
            }
        )

    if matched >= 3:
        summary = "Cosmic sync. Three for three."
    elif matched == 2:
        summary = "Strong alignment."
    elif matched == 1:
        summary = "Some differences."
    else:
        summary = "Opposites attract."

    return {
        "total": total,
        "matched": matched,
        "summary": summary,
        "questions": questions,
    }


def _serialize_response_value(response: GameResponse | None) -> str | None:
    if response is None:
        return None
    if response.selected_option_id:
        if response.selected_option_id and response.selected_option is not None:
            return response.selected_option.option_text
        return f"Option {response.selected_option_id}"
    value = (response.text_answer or "").strip()
    return value or None


def _responses_match(first: GameResponse | None, second: GameResponse | None) -> bool:
    if first is None or second is None:
        return False

    if first.selected_option_id and second.selected_option_id:
        return first.selected_option_id == second.selected_option_id

    first_text = (first.text_answer or "").strip().lower()
    second_text = (second.text_answer or "").strip().lower()
    return bool(first_text and second_text and first_text == second_text)
