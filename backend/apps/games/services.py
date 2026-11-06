from typing import Optional

from django.db import transaction

from apps.chat.services import create_game_event_message
from apps.matching.models import Match
from apps.notifications.services import notify_game_turn

from .models import Game, GameOption, GameQuestion, GameResponse, GameSession, GameSessionQuestion

SAME_PICK_RESULT_TEXT = "You both picked the same 😄"
DIFFERENT_PICK_RESULT_TEXT = "Opposites 👀 interesting"
SESSION_QUESTION_LIMIT = 5


def _serialize_question_payload(question: GameQuestion) -> dict:
    return {
        "id": question.id,
        "question_text": question.question_text,
        "options": question.options or [],
        "game_type": question.game_type,
    }


def _ensure_session_question_ids(
    session: GameSession,
    *,
    preferred_question_ids: Optional[list[int]] = None,
    limit: int = SESSION_QUESTION_LIMIT,
) -> list[int]:
    existing_ids = list(
        GameSessionQuestion.objects.filter(session_id=session.id)
        .order_by("order", "id")
        .values_list("question_id", flat=True)
    )
    if existing_ids:
        return existing_ids

    ordered_game_question_ids = list(
        GameQuestion.objects.filter(game_id=session.game_id, is_active=True)
        .order_by("order", "id")
        .values_list("id", flat=True)
    )
    if not ordered_game_question_ids:
        return []

    # When a caller picked a specific set for this session, keep that set
    # intact. The fallback limit is only for older sessions without one.
    target_limit = len(preferred_question_ids) if preferred_question_ids else limit

    valid_ids = set(ordered_game_question_ids)
    response_question_ids = list(
        GameResponse.objects.filter(session_id=session.id)
        .order_by("created_at", "id")
        .values_list("question_id", flat=True)
        .distinct()
    )

    ordered_ids: list[int] = []
    for source in (preferred_question_ids or [], response_question_ids, ordered_game_question_ids):
        for question_id in source:
            normalized_id = int(question_id)
            if normalized_id in valid_ids and normalized_id not in ordered_ids:
                ordered_ids.append(normalized_id)
            if len(ordered_ids) >= target_limit:
                break
        if len(ordered_ids) >= target_limit:
            break

    GameSessionQuestion.objects.bulk_create(
        [
            GameSessionQuestion(session_id=session.id, question_id=question_id, order=index)
            for index, question_id in enumerate(ordered_ids, start=1)
        ],
        ignore_conflicts=True,
    )

    return list(
        GameSessionQuestion.objects.filter(session_id=session.id)
        .order_by("order", "id")
        .values_list("question_id", flat=True)
    )


def get_session_questions_payload(*, session_id: int) -> list[dict]:
    session = GameSession.objects.only("id", "game_id").filter(id=session_id).first()
    if session is None:
        raise ValueError("Game session not found.")

    ordered_ids = _ensure_session_question_ids(session)
    if not ordered_ids:
        return []

    question_map = {
        question.id: _serialize_question_payload(question)
        for question in GameQuestion.objects.filter(id__in=ordered_ids)
    }
    return [question_map[question_id] for question_id in ordered_ids if question_id in question_map]


def start_game_session(
    *,
    match_id: int,
    game_id: int,
    user_id: int,
    category_id: Optional[int] = None,
    question_ids: Optional[list[int]] = None,
) -> GameSession:
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
                "category_id": category_id,
                "started_by_id": user_id,
                "created_by_id": user_id,
                "current_question_index": 0,
            },
        )
        update_fields = []
        if category_id is not None and session.category_id != category_id:
            session.category_id = category_id
            update_fields.append("category")
        if session.started_by_id != user_id:
            session.started_by_id = user_id
            update_fields.append("started_by")
        if session.created_by_id is None:
            session.created_by_id = user_id
            update_fields.append("created_by")
        if update_fields:
            session.save(update_fields=update_fields)

        session_question_ids = _ensure_session_question_ids(session, preferred_question_ids=question_ids)
        if not session_question_ids:
            raise ValueError("No active questions found for this game.")

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

    ordered_question_ids = _ensure_session_question_ids(session)
    current_index = max(int(session.current_question_index or 0), 0)
    if current_index >= len(ordered_question_ids):
        return {"question_id": None, "question_text": None, "options": []}

    question = (
        GameQuestion.objects.filter(id=ordered_question_ids[current_index], is_active=True)
        .order_by("order", "id")
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
    predicted_text_answer: str = "",
) -> dict:
    """Save one private pick; reveal the full session after both users finish."""
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

        ordered_question_ids = _ensure_session_question_ids(session)
        if not ordered_question_ids:
            raise ValueError("This game session has no questions.")
        if int(question_id) not in ordered_question_ids:
            raise ValueError("Question does not belong to this session.")

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

        normalized_text = (text_answer or "").strip()
        normalized_prediction = (predicted_text_answer or "").strip()
        is_guess_game = bool(session.category_id and session.category.slug == "guess_their_pick")
        if is_guess_game:
            valid_options = {
                str(item.get("text", "")).strip()
                for item in (question.options or [])
                if isinstance(item, dict)
            }
            if normalized_text not in valid_options or normalized_prediction not in valid_options:
                raise ValueError("Choose both answers from the options shown.")
        existing_response = GameResponse.objects.filter(
            session_id=session.id,
            user_id=user_id,
            question_id=question.id,
        ).first()
        response_created = existing_response is None
        if existing_response:
            same_option = existing_response.selected_option_id == (selected_option.id if selected_option else None)
            if (
                not same_option
                or existing_response.text_answer != normalized_text
                or existing_response.predicted_text_answer != normalized_prediction
            ):
                raise ValueError("Your pick is already locked in.")
        else:
            GameResponse.objects.create(
                session_id=session.id,
                user_id=user_id,
                question_id=question.id,
                selected_option_id=selected_option.id if selected_option else None,
                text_answer=normalized_text,
                predicted_text_answer=normalized_prediction,
            )

        own_answered_ids = set(
            GameResponse.objects.filter(session_id=session.id, user_id=user_id)
            .values_list("question_id", flat=True)
        ) & set(ordered_question_ids)
        partner_id = session.match.user_b_id if session.match.user_a_id == user_id else session.match.user_a_id
        partner_answered_ids = set(
            GameResponse.objects.filter(session_id=session.id, user_id=partner_id)
            .values_list("question_id", flat=True)
        ) & set(ordered_question_ids)
        own_complete = len(own_answered_ids) == len(ordered_question_ids)
        partner_complete = len(partner_answered_ids) == len(ordered_question_ids)

        if not (own_complete and partner_complete):
            if own_complete and not partner_complete and response_created:
                notify_game_turn(recipient_user_id=partner_id, match_id=session.match_id)
            return {
                "session_id": session.id,
                "status": session.status,
                "answered_count": len(own_answered_ids),
                "match_answered_count": len(partner_answered_ids),
                "both_answered": False,
                "is_completed": False,
            }

        session.status = GameSession.Status.COMPLETED
        session.current_question_index = len(ordered_question_ids)
        session.save(update_fields=["status", "current_question_index"])

        for round_number, reveal_question_id in enumerate(ordered_question_ids, start=1):
            reveal_question = GameQuestion.objects.get(id=reveal_question_id)
            responses = list(
                GameResponse.objects.filter(
                    session_id=session.id,
                    question_id=reveal_question_id,
                    user_id__in=participant_ids,
                ).select_related("selected_option")
            )
            answer_by_user = {
                item.user_id: item.selected_option.option_text if item.selected_option_id else item.text_answer
                for item in responses
            }
            result_text = generate_question_result(
                session_id=session.id, question_id=reveal_question_id
            )
            create_game_event_message(
                match_id=session.match_id,
                sender_id=user_id,
                content=result_text,
                event_type="game_round_result",
                payload={
                    "match_id": session.match_id,
                    "session_id": session.id,
                    "question_id": reveal_question_id,
                    "round_number": round_number,
                    "question_text": reveal_question.question_text,
                    "result_text": result_text,
                    "answers": [
                        {"user_id": session.match.user_a_id, "answer": answer_by_user.get(session.match.user_a_id, "")},
                        {"user_id": session.match.user_b_id, "answer": answer_by_user.get(session.match.user_b_id, "")},
                    ],
                },
                dedupe_key=f"game_round_result:{session.id}:{reveal_question_id}",
                broadcast=False,
            )

        result = calculate_game_result(session.id)
        create_game_event_message(
            match_id=session.match_id,
            sender_id=user_id,
            content=result.get("summary", "Game completed."),
            event_type="game_result",
            payload={
                "match_id": session.match_id,
                "session_id": session.id,
                "category": session.category.slug if session.category_id else "this_or_that",
                "result": result,
            },
            dedupe_key=f"game_result:{session.id}",
            broadcast=False,
        )
        return {
            "session_id": session.id,
            "status": session.status,
            "answered_count": len(ordered_question_ids),
            "match_answered_count": len(ordered_question_ids),
            "both_answered": True,
            "is_completed": True,
            "result": result,
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
    user_a_id = session.match.user_a_id
    user_b_id = session.match.user_b_id
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

    if session.category_id and session.category.slug == "guess_their_pick":
        return "Picks revealed 🔮"
    if session.category_id and session.category.slug == "build_a_story":
        return "Both lines revealed 📖"
    if session.category_id and session.category.slug == "caption_this":
        return "Your captions are revealed 🎨"
    if session.category_id and session.category.slug == "two_truths_and_a_lie":
        return "The lies are revealed 🕵️"
    if session.category_id and session.category.slug == "photo_scavenger_hunt":
        return "Your scavenger hunt photos are revealed 📸"
    if session.category_id and session.category.slug == "secret_song_pick":
        return "Your song picks are revealed 🎵 Add them to a shared playlist!"

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
    category_slug = session.category.slug if session.category_id else ""
    user_a_id = session.match.user_a_id
    user_b_id = session.match.user_b_id

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

    if category_slug in {"emoji_decode", "cipher_breaker"}:
        import re

        question_rows = GameQuestion.objects.filter(id__in=ordered_question_ids).values("id", "trait_mapping")
        answers = {row["id"]: row.get("trait_mapping", {}).get("answer", "") for row in question_rows}
        def normalize(value):
            return re.sub(r"[^a-z0-9]", "", str(value or "").casefold())
        response_rows = list(GameResponse.objects.filter(
            session_id=session.id, user_id__in=participant_ids, question_id__in=ordered_question_ids,
        ).values("question_id", "user_id", "text_answer"))
        guesses = {(row["question_id"], row["user_id"]): row["text_answer"] for row in response_rows}
        questions = []
        scores = {user_a_id: 0, user_b_id: 0}
        for question_id in ordered_question_ids:
            answer = answers.get(question_id, "")
            guess_a = guesses.get((question_id, user_a_id), "")
            guess_b = guesses.get((question_id, user_b_id), "")
            correct_a = normalize(guess_a) == normalize(answer)
            correct_b = normalize(guess_b) == normalize(answer)
            scores[user_a_id] += int(correct_a)
            scores[user_b_id] += int(correct_b)
            questions.append({
                "question": question_text_map.get(question_id, "Puzzle clue"),
                "answer": answer,
                "user_a": guess_a,
                "user_b": guess_b,
                "user_a_correct": correct_a,
                "user_b_correct": correct_b,
                "match": correct_a and correct_b,
            })
        total = len(ordered_question_ids) * 2
        matched = scores[user_a_id] + scores[user_b_id]
        return {
            "total": total,
            "matched": matched,
            "user_a_score": scores[user_a_id],
            "user_b_score": scores[user_b_id],
            "round_count": len(ordered_question_ids),
            "summary": (
                f"You cracked {matched} of {total} ciphers together 🔐"
                if category_slug == "cipher_breaker"
                else f"You decoded {matched} of {total} clues together 🧩"
            ),
            "questions": questions,
        }

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
            "predicted_text_answer",
            "story_text",
            "truth_statements",
            "lie_index",
            "guessed_lie_index",
        )
    )
    response_map = {(row.question_id, row.user_id): row for row in response_rows}

    user_a_id = session.match.user_a_id
    user_b_id = session.match.user_b_id

    if category_slug == "secret_song_pick":
        question_id = ordered_question_ids[0] if ordered_question_ids else None
        response_a = response_map.get((question_id, user_a_id)) if question_id else None
        response_b = response_map.get((question_id, user_b_id)) if question_id else None
        pick_a = response_a.text_answer if response_a else ""
        pick_b = response_b.text_answer if response_b else ""
        same_pick = bool(pick_a and pick_b and pick_a.casefold() == pick_b.casefold())
        return {
            "total": 2,
            "matched": int(same_pick),
            "round_count": 1,
            "summary": "Your song picks are revealed 🎵 Add them to a shared playlist!",
            "questions": [{
                "question": question_text_map.get(question_id, "Pick a song") if question_id else "Pick a song",
                "user_a": pick_a,
                "user_b": pick_b,
                "match": same_pick,
            }],
        }

    if category_slug == "photo_scavenger_hunt":
        question_id = ordered_question_ids[0] if ordered_question_ids else None
        question = GameQuestion.objects.filter(id=question_id).first()
        answers = {
            response.user_id: response
            for response in GameResponse.objects.filter(
                session_id=session.id, question_id=question_id,
                user_id__in=participant_ids,
            )
        }
        def photo_url(user_id):
            return f"/api/games/session/{session.id}/photo/reveal/?question_id={question_id}&user_id={user_id}"
        response_a = answers.get(user_a_id)
        response_b = answers.get(user_b_id)
        return {
            "total": 2,
            "matched": 0,
            "round_count": 1,
            "summary": "Your Photo Scavenger Hunt is complete 📸 Share the stories behind your photos!",
            "questions": [{
                "question": question_text_map.get(question_id, "Photo prompt") if question_id else "Photo prompt",
                "user_a": response_a.photo_caption if response_a else "",
                "user_b": response_b.photo_caption if response_b else "",
                "user_a_photo_url": photo_url(user_a_id) if response_a and response_a.photo else None,
                "user_b_photo_url": photo_url(user_b_id) if response_b and response_b.photo else None,
                "match": False,
            }],
        }

    if category_slug == "rank_these":
        question_id = ordered_question_ids[0] if ordered_question_ids else None
        question = GameQuestion.objects.filter(id=question_id).first()
        response_a = response_map.get((question_id, user_a_id)) if question_id else None
        response_b = response_map.get((question_id, user_b_id)) if question_id else None
        option_rows = [item for item in (question.options or []) if isinstance(item, dict)] if question else []
        item_ids = [str(item.get("id")) for item in option_rows]
        labels = {str(item.get("id")): str(item.get("text", "")) for item in option_rows}
        ranking_a = response_a.ranking if response_a else []
        ranking_b = response_b.ranking if response_b else []
        positions_a = {item: index + 1 for index, item in enumerate(ranking_a)}
        positions_b = {item: index + 1 for index, item in enumerate(ranking_b)}
        exact_matches = sum(positions_a.get(item) == positions_b.get(item) for item in item_ids)
        total_distance = sum(abs(positions_a.get(item, 0) - positions_b.get(item, 0)) for item in item_ids)
        return {
            "total": len(item_ids),
            "matched": exact_matches,
            "rank_distance": total_distance,
            "summary": f"You ranked {exact_matches} of {len(item_ids)} items in the same spot. Compare your lists and see where you agree!",
            "round_count": 1,
            "questions": [{
                "question": question_text_map.get(question_id, "Rank these") if question_id else "Rank these",
                "user_a": [{"item": labels.get(item, item), "rank": index + 1} for index, item in enumerate(ranking_a)],
                "user_b": [{"item": labels.get(item, item), "rank": index + 1} for index, item in enumerate(ranking_b)],
                "match": exact_matches == len(item_ids),
            }],
        }

    if category_slug == "guess_their_pick":
        guess_questions = []
        user_a_correct = 0
        user_b_correct = 0
        for question_id in ordered_question_ids:
            response_a = response_map.get((question_id, user_a_id))
            response_b = response_map.get((question_id, user_b_id))
            answer_a = _serialize_response_value(response_a)
            answer_b = _serialize_response_value(response_b)
            guess_a = response_a.predicted_text_answer if response_a else ""
            guess_b = response_b.predicted_text_answer if response_b else ""
            correct_a = bool(guess_a and answer_b and guess_a.strip().casefold() == answer_b.strip().casefold())
            correct_b = bool(guess_b and answer_a and guess_b.strip().casefold() == answer_a.strip().casefold())
            user_a_correct += int(correct_a)
            user_b_correct += int(correct_b)
            guess_questions.append({
                "question": question_text_map.get(question_id, f"Question {question_id}"),
                "user_a": answer_a,
                "user_b": answer_b,
                "user_a_guess": guess_a,
                "user_b_guess": guess_b,
                "user_a_correct": correct_a,
                "user_b_correct": correct_b,
                "match": answer_a == answer_b,
            })
        total = len(ordered_question_ids)
        correct_total = user_a_correct + user_b_correct
        return {
            "total": correct_total,
            "matched": correct_total,
            "summary": f"You both guessed {correct_total} of {total * 2} picks correctly 🔮",
            "user_a_correct": user_a_correct,
            "user_b_correct": user_b_correct,
            "round_count": total,
            "questions": guess_questions,
        }

    if category_slug == "build_a_story":
        story_turns = []
        for question_id in ordered_question_ids:
            response_a = response_map.get((question_id, user_a_id))
            response_b = response_map.get((question_id, user_b_id))
            story_turns.append({
                "question": question_text_map.get(question_id, "Story starter"),
                "user_a": response_a.story_text if response_a else "",
                "user_b": response_b.story_text if response_b else "",
                "match": False,
            })
        return {
            "total": len(story_turns),
            "matched": 0,
            "summary": "You made a story together 📖",
            "round_count": len(story_turns),
            "questions": story_turns,
        }

    if category_slug == "caption_this":
        caption_turns = []
        for question_id in ordered_question_ids:
            response_a = response_map.get((question_id, user_a_id))
            response_b = response_map.get((question_id, user_b_id))
            question = GameQuestion.objects.filter(id=question_id).first()
            scene_emoji = "✨"
            if question and question.options and isinstance(question.options[0], dict):
                scene_emoji = str(question.options[0].get("emoji", scene_emoji))
            caption_turns.append({
                "question": question_text_map.get(question_id, "Caption this scene"),
                "scene_emoji": scene_emoji,
                "user_a": response_a.story_text if response_a else "",
                "user_b": response_b.story_text if response_b else "",
                "match": False,
            })
        return {
            "total": len(caption_turns),
            "matched": 0,
            "summary": "Your captions are revealed! Which one made you laugh most? 🎨",
            "round_count": len(caption_turns),
            "questions": caption_turns,
        }

    if category_slug == "two_truths_and_a_lie":
        round_results = []
        user_a_correct = 0
        user_b_correct = 0
        for question_id in ordered_question_ids:
            response_a = response_map.get((question_id, user_a_id))
            response_b = response_map.get((question_id, user_b_id))
            if not response_a or not response_b:
                continue
            correct_a = response_a.guessed_lie_index == response_b.lie_index
            correct_b = response_b.guessed_lie_index == response_a.lie_index
            user_a_correct += int(correct_a)
            user_b_correct += int(correct_b)
            round_results.append({
                "question": question_text_map.get(question_id, "Two Truths and a Lie"),
                "user_a": {"statements": response_a.truth_statements, "lie_index": response_a.lie_index},
                "user_b": {"statements": response_b.truth_statements, "lie_index": response_b.lie_index},
                "user_a_guess": response_a.guessed_lie_index,
                "user_b_guess": response_b.guessed_lie_index,
                "user_a_correct": correct_a,
                "user_b_correct": correct_b,
                "match": correct_a and correct_b,
            })
        total = len(round_results)
        correct_total = user_a_correct + user_b_correct
        return {
            "total": correct_total,
            "matched": correct_total,
            "summary": f"You guessed {correct_total} of {total * 2} lies correctly 🕵️",
            "round_count": total,
            "user_a_correct": user_a_correct,
            "user_b_correct": user_b_correct,
            "questions": round_results,
        }

    if category_slug == "choose_your_adventure":
        adventure_questions = list(GameQuestion.objects.filter(
            id__in=ordered_question_ids,
        ).values("id", "options"))
        route_by_question = {
            row["id"]: {
                str(option.get("text", "")).strip(): str(option.get("path", "bold"))
                for option in (row["options"] or []) if isinstance(option, dict)
            }
            for row in adventure_questions
        }
        route_counts = {user_a_id: 0, user_b_id: 0}
        adventure_turns = []
        matched_choices = 0
        for question_id in ordered_question_ids:
            response_a = response_map.get((question_id, user_a_id))
            response_b = response_map.get((question_id, user_b_id))
            choice_a = _serialize_response_value(response_a)
            choice_b = _serialize_response_value(response_b)
            if choice_a and route_by_question.get(question_id, {}).get(choice_a) == "bold":
                route_counts[user_a_id] += 1
            if choice_b and route_by_question.get(question_id, {}).get(choice_b) == "bold":
                route_counts[user_b_id] += 1
            same = bool(choice_a and choice_b and choice_a == choice_b)
            matched_choices += int(same)
            adventure_turns.append({
                "question": question_text_map.get(question_id, "Adventure choice"),
                "user_a": choice_a,
                "user_b": choice_b,
                "match": same,
            })

        def ending(bold_count: int) -> str:
            if bold_count >= 4:
                return "The fearless trailblazer — every mystery led to a new horizon."
            if bold_count <= 1:
                return "The thoughtful wanderer — you found magic in the gentler path."
            return "The curious explorer — a little daring and a little wonder made your way."

        return {
            "total": len(ordered_question_ids),
            "matched": matched_choices,
            "summary": f"Your paths matched on {matched_choices} of {len(ordered_question_ids)} choices.",
            "round_count": len(ordered_question_ids),
            "user_a_ending": ending(route_counts[user_a_id]),
            "user_b_ending": ending(route_counts[user_b_id]),
            "questions": adventure_turns,
        }

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

    match_ratio = matched / total if total else 0
    if total and matched == total:
        summary = "Cosmic sync. You matched every pick."
    elif match_ratio >= 0.6:
        summary = "Strong alignment."
    elif matched > 0:
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
    value = (response.story_text or response.text_answer or "").strip()
    return value or None


def _responses_match(first: GameResponse | None, second: GameResponse | None) -> bool:
    if first is None or second is None:
        return False

    if first.selected_option_id and second.selected_option_id:
        return first.selected_option_id == second.selected_option_id

    first_text = (first.text_answer or "").strip().lower()
    second_text = (second.text_answer or "").strip().lower()
    return bool(first_text and second_text and first_text == second_text)
