"""Scheduled, temporary game rooms for people who have not matched yet."""

import random
import re
from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.chat.models import Message
from apps.realtime.models import Match as RealtimeMatch

from .models import (
    GameNightEntry, GameNightMessage, GameNightSession, GameNightWindow,
    Match, RecommendationQueue, Swipe,
)
from .services import create_match_from_mutual_like
from .swipe_service import _ensure_match_chat


GAME_CARDS = {
    "forbidden_word": [
        {"secret": "stargazing", "forbidden": ["stars", "sky", "night"], "label": "Describe the secret without the forbidden words."},
        {"secret": "road trip", "forbidden": ["car", "drive", "travel"], "label": "Describe the secret without the forbidden words."},
        {"secret": "coffee", "forbidden": ["drink", "cafe", "morning"], "label": "Describe the secret without the forbidden words."},
    ],
    "emoji_decode": [
        {"secret": "a rainy first date", "label": "Act out this scene using emojis only."},
        {"secret": "a surprise birthday party", "label": "Act out this scene using emojis only."},
        {"secret": "missing the last train", "label": "Act out this scene using emojis only."},
    ],
    "split_clue": [
        {"secret": "moon", "a": "I change shape, but I stay in the sky.", "b": "I light up nights without making my own light.", "label": "Share your clues and solve the mystery together."},
        {"secret": "compass", "a": "I have a needle, but I never sew.", "b": "I can guide you without saying a word.", "label": "Share your clues and solve the mystery together."},
        {"secret": "umbrella", "a": "I open when the clouds arrive.", "b": "People carry me, then forget me on buses.", "label": "Share your clues and solve the mystery together."},
    ],
    "plot_twist": [
        {"starter": "You both accidentally boarded a train to a mystery city.", "twist": "A stranger hands you a map with one place circled.", "label": "Write a story together, one line at a time."},
        {"starter": "Your first date is interrupted by a very polite talking cat.", "twist": "The cat claims it knows a secret about the restaurant.", "label": "Write a story together, one line at a time."},
        {"starter": "A tiny spaceship lands beside your picnic.", "twist": "Its pilot asks you both for a favor.", "label": "Write a story together, one line at a time."},
    ],
}

GAME_NAMES = {
    "forbidden_word": "Forbidden Word",
    "emoji_decode": "Emoji Decode",
    "split_clue": "Split Clue",
    "plot_twist": "Plot Twist",
}


def _shared_moment(session):
    state = session.game_state or {}
    kind = session.game_kind
    if kind == "plot_twist":
        lines = [str(line.get("text", "")).strip() for line in state.get("lines", []) if isinstance(line, dict)]
        detail = " ".join(lines[:4])[:240] or str(state.get("card", {}).get("starter", ""))[:240]
        prompt = "How would your story end?"
    elif kind == "split_clue":
        detail = "You solved the mystery together." if state.get("solved") else "You traded clues together."
        prompt = "What mystery should you solve next?"
    elif kind in ("forbidden_word", "emoji_decode"):
        solved = int(state.get("solved") or 0)
        detail = f"You cracked {solved} round{'s' if solved != 1 else ''} together." if solved else "You played two rounds together."
        prompt = "Which round made you laugh most?"
    else:
        detail, prompt = "You played together.", "What should you play next?"
    return {"event_type": "game_night_memory", "source": "game_night", "room_id": session.id,
            "game_kind": kind, "game_name": GAME_NAMES.get(kind, "Game Night"),
            "detail": detail, "prompt": prompt}


def schedule_snapshot(now=None):
    now = now or timezone.now()
    active = None
    upcoming = None
    windows = list(GameNightWindow.objects.filter(is_enabled=True))
    for window in windows:
        try:
            zone = ZoneInfo(window.timezone_name)
        except (ZoneInfoNotFoundError, ValueError):
            continue
        local_date = now.astimezone(zone).date()
        for offset in range(8):
            day = local_date + timedelta(days=offset)
            if day.weekday() != window.weekday:
                continue
            start = datetime.combine(day, window.start_time, zone).astimezone(dt_timezone.utc)
            end = datetime.combine(day, window.end_time, zone).astimezone(dt_timezone.utc)
            if start <= now < end and (active is None or end < active[2]):
                active = (window, start, end)
            elif start > now and (upcoming is None or start < upcoming[1]):
                upcoming = (window, start, end)
    selected = active or upcoming
    return {
        "is_open": active is not None,
        "window_id": selected[0].id if selected else None,
        "starts_at": selected[1] if selected else None,
        "ends_at": selected[2] if selected else None,
        "timezone": selected[0].timezone_name if selected else None,
        "windows": [
            {"weekday": w.get_weekday_display(), "start": w.start_time.strftime("%H:%M"),
             "end": w.end_time.strftime("%H:%M"), "timezone": w.timezone_name}
            for w in windows
        ],
    }


def _pair_allowed(user, other):
    if user.id == other.id or not other.is_active:
        return False
    if user.preference != "everyone" and user.preference != other.gender:
        return False
    if other.preference != "everyone" and other.preference != user.gender:
        return False
    left, right = sorted((user.id, other.id))
    if Match.objects.filter(user_a_id=left, user_b_id=right, status=Match.Status.MATCHED).exists():
        return False
    if RealtimeMatch.objects.filter(user_a_id=left, user_b_id=right, status=RealtimeMatch.Status.BLOCKED).exists():
        return False
    if Swipe.objects.filter(
        Q(user_id=user.id, target_user_id=other.id) | Q(user_id=other.id, target_user_id=user.id),
        action=Swipe.Action.PASS,
    ).exists():
        return False
    if GameNightSession.objects.filter(
        Q(user_a_id=user.id, user_b_id=other.id) | Q(user_a_id=other.id, user_b_id=user.id)
    ).exists():
        return False
    return True


def _choose_game(user_id, other_id):
    recent = list(GameNightSession.objects.filter(
        Q(user_a_id__in=[user_id, other_id]) | Q(user_b_id__in=[user_id, other_id])
    ).order_by("-created_at").values_list("game_kind", flat=True)[:6])
    choices = [kind for kind in GAME_CARDS if kind not in recent[:3]] or list(GAME_CARDS)
    return random.choice(choices)


def _initial_state(game_kind, user_a_id):
    card = random.choice(GAME_CARDS[game_kind])
    if game_kind in ("forbidden_word", "emoji_decode"):
        return {"card": card, "round": 1, "actor_id": user_a_id, "stage": "clue", "clue": "", "guesses": 0, "solved": 0}
    if game_kind == "split_clue":
        return {"card": card, "solved": False, "attempts": 0}
    return {"card": card, "lines": [], "next_user_id": user_a_id}


def _live_session_for(user):
    entry = GameNightEntry.objects.filter(user=user).select_related("session").first()
    if not entry or not entry.session_id:
        return None
    session = entry.session
    if session.status == GameNightSession.Status.ACTIVE and session.expires_at <= timezone.now():
        session.status = GameNightSession.Status.EXPIRED
        session.save(update_fields=["status"])
    return session


def _score_for(user_id, other_id):
    row = RecommendationQueue.objects.filter(user_id=user_id, target_user_id=other_id).first()
    if row is None:
        row = RecommendationQueue.objects.filter(user_id=other_id, target_user_id=user_id).first()
    return float(row.final_score) if row else 0.0


@transaction.atomic
def join_queue(user):
    snapshot = schedule_snapshot()
    if not snapshot["is_open"]:
        raise ValidationError("Game Night is not open right now.")
    # One lock per window serializes joins, including the first two queue entries.
    window = GameNightWindow.objects.select_for_update().get(pk=snapshot["window_id"])
    current = schedule_snapshot()
    if not window.is_enabled or not current["is_open"] or current["window_id"] != window.id:
        raise ValidationError("Game Night is not open right now.")
    snapshot = current
    now = timezone.now()
    existing = _live_session_for(user)
    if existing and existing.status == GameNightSession.Status.ACTIVE:
        return room_payload(existing, user)

    entry, _ = GameNightEntry.objects.select_for_update().get_or_create(
        user=user, defaults={"last_seen_at": now, "window_ends_at": snapshot["ends_at"]}
    )
    entry.is_waiting = True
    entry.session = None
    entry.last_seen_at = now
    entry.window_ends_at = snapshot["ends_at"]
    entry.save()

    candidates = list(GameNightEntry.objects.select_for_update().filter(
        is_waiting=True,
        last_seen_at__gte=now - timedelta(seconds=45),
        window_ends_at=snapshot["ends_at"],
    ).exclude(user=user).select_related("user").order_by("-last_seen_at")[:100])
    eligible = [candidate for candidate in candidates if _pair_allowed(user, candidate.user)]
    if not eligible:
        return {"state": "waiting"}

    scored = sorted(
        ((_score_for(user.id, candidate.user_id), candidate) for candidate in eligible),
        key=lambda item: item[0], reverse=True,
    )[:10]
    partner = random.choices([item[1] for item in scored], weights=[1 + item[0] / 10 for item in scored])[0]
    kind = _choose_game(user.id, partner.user_id)
    session = GameNightSession.objects.create(
        user_a=user, user_b=partner.user, game_kind=kind,
        game_state=_initial_state(kind, user.id),
        play_ends_at=now + timedelta(minutes=3),
        expires_at=now + timedelta(minutes=5),
    )
    GameNightEntry.objects.filter(pk__in=[entry.pk, partner.pk]).update(
        is_waiting=False, session=session, last_seen_at=now
    )
    return room_payload(session, user)


def leave_queue(user):
    entry = GameNightEntry.objects.filter(user=user).select_related("session").first()
    if not entry:
        return
    if entry.session and entry.session.status == GameNightSession.Status.ACTIVE:
        raise ValidationError("Choose Pass to leave an active game room.")
    entry.is_waiting = False
    entry.session = None
    entry.save(update_fields=["is_waiting", "session"])


def _require_participant(session, user):
    if user.id not in (session.user_a_id, session.user_b_id):
        raise PermissionDenied("This is not your game room.")


def _game_done(session):
    state = session.game_state
    if timezone.now() >= session.play_ends_at:
        return True
    if session.game_kind in ("forbidden_word", "emoji_decode"):
        return state["round"] > 2
    if session.game_kind == "split_clue":
        return state["solved"]
    return len(state["lines"]) >= 4


def room_payload(session, user):
    _require_participant(session, user)
    is_a = user.id == session.user_a_id
    other = session.user_b if is_a else session.user_a
    state = dict(session.game_state)
    card = dict(state.pop("card"))
    if session.game_kind in ("forbidden_word", "emoji_decode"):
        if state["actor_id"] != user.id:
            card.pop("secret", None)
            card.pop("forbidden", None)
    elif session.game_kind == "split_clue":
        clue = card.pop("a" if is_a else "b")
        card.pop("b" if is_a else "a")
        card.pop("secret", None)
        card["your_clue"] = clue
    state["card"] = card
    done = _game_done(session) if session.status == GameNightSession.Status.ACTIVE else True
    return {
        "state": "room", "id": session.id, "status": session.status,
        "game_kind": session.game_kind, "game_name": GAME_NAMES[session.game_kind],
        "game": state, "game_done": done,
        "partner": {"id": other.id, "name": other.name},
        "your_id": user.id,
        "your_vote": session.vote_a if is_a else session.vote_b,
        "both_voted": bool(session.vote_a and session.vote_b),
        "match_id": session.match_id if session.status == GameNightSession.Status.MATCHED else None,
        "play_ends_at": session.play_ends_at,
        "expires_at": session.expires_at,
        "messages": [
            {"id": m.id, "sender_id": m.sender_id, "content": m.content, "created_at": m.created_at}
            for m in session.messages.order_by("created_at", "id")[:100]
        ] if session.status in (GameNightSession.Status.ACTIVE, GameNightSession.Status.MATCHED) else [],
    }


def queue_status(user):
    session = _live_session_for(user)
    if session:
        return room_payload(session, user)
    entry = GameNightEntry.objects.filter(user=user).first()
    snapshot = schedule_snapshot()
    if entry and entry.is_waiting and snapshot["is_open"] and entry.window_ends_at == snapshot["ends_at"]:
        if entry.last_seen_at >= timezone.now() - timedelta(seconds=45):
            entry.last_seen_at = timezone.now()
            entry.save(update_fields=["last_seen_at"])
            return {"state": "waiting"}
    return {"state": "idle"}


@transaction.atomic
def send_message(session, user, content):
    _require_participant(session, user)
    if session.status != GameNightSession.Status.ACTIVE or timezone.now() >= session.play_ends_at:
        raise ValidationError("This game room is closed for messages.")
    content = str(content or "").strip()
    if not content or len(content) > 500:
        raise ValidationError("Message must be between 1 and 500 characters.")
    GameNightMessage.objects.create(session=session, sender=user, content=content)
    return room_payload(session, user)


@transaction.atomic
def play_action(session, user, content):
    session = GameNightSession.objects.select_for_update().get(pk=session.pk)
    _require_participant(session, user)
    if session.status != GameNightSession.Status.ACTIVE or _game_done(session):
        raise ValidationError("This round is over.")
    content = str(content or "").strip()
    if not content or len(content) > 140:
        raise ValidationError("Your move must be between 1 and 140 characters.")
    state = dict(session.game_state)
    kind = session.game_kind
    if kind in ("forbidden_word", "emoji_decode"):
        actor_id = state["actor_id"]
        if state["stage"] == "clue":
            if user.id != actor_id:
                raise ValidationError("Wait for your partner's clue.")
            if kind == "forbidden_word" and any(
                re.search(rf"\b{re.escape(word)}\b", content, flags=re.IGNORECASE)
                for word in [state["card"]["secret"], *state["card"]["forbidden"]]
            ):
                raise ValidationError("Your clue contains the answer or a forbidden word.")
            if kind == "emoji_decode" and (
                any(character.isalpha() for character in content)
                or not any(ord(character) >= 0x2600 for character in content)
            ):
                raise ValidationError("Use emojis rather than words for this clue.")
            state["clue"] = content
            state["stage"] = "guess"
        else:
            if user.id == actor_id:
                raise ValidationError("It's your partner's turn to guess.")
            state["guesses"] += 1
            correct = content.casefold().strip(" .!?") == state["card"]["secret"].casefold()
            if correct:
                state["solved"] += 1
            if correct or state["guesses"] >= 3:
                state["round"] += 1
                state["actor_id"] = user.id
                state["stage"] = "clue"
                state["clue"] = ""
                state["guesses"] = 0
                if state["round"] <= 2:
                    state["card"] = random.choice(GAME_CARDS[kind])
    elif kind == "split_clue":
        state["attempts"] += 1
        state["solved"] = content.casefold().strip(" .!?") == state["card"]["secret"].casefold()
    else:
        if state["next_user_id"] != user.id:
            raise ValidationError("It's your partner's turn.")
        state["lines"].append({"user_id": user.id, "text": content})
        state["next_user_id"] = session.user_b_id if user.id == session.user_a_id else session.user_a_id
    session.game_state = state
    session.save(update_fields=["game_state"])
    return room_payload(session, user)


@transaction.atomic
def vote_on_room(session, user, choice):
    session = GameNightSession.objects.select_for_update().get(pk=session.pk)
    _require_participant(session, user)
    if session.status != GameNightSession.Status.ACTIVE:
        return room_payload(session, user)
    if choice not in ("match", "pass"):
        raise ValidationError("Choose match or pass.")
    if choice == "match" and not _game_done(session):
        raise ValidationError("Finish the game before choosing Match.")
    field = "vote_a" if user.id == session.user_a_id else "vote_b"
    if getattr(session, field):
        raise ValidationError("You already made your choice.")
    setattr(session, field, choice)
    if choice == "pass":
        session.status = GameNightSession.Status.PASSED
    elif session.vote_a == "match" and session.vote_b == "match":
        match = create_match_from_mutual_like(session.user_a, session.user_b)
        memory = _shared_moment(session)
        Message.objects.create(
            match=match, sender=user, content="Your Game Night moment",
            message_type=Message.MessageType.GAME_EVENT, game_payload=memory,
            status=Message.Status.DELIVERED,
        )
        for message in session.messages.order_by("created_at", "id"):
            Message.objects.create(
                match=match, sender=message.sender, content=message.content,
                message_type=Message.MessageType.TEXT,
                game_payload={"source": "game_night", "room_id": session.id},
                status=Message.Status.DELIVERED,
            )
        _ensure_match_chat(match, actor_user_id=user.id)
        session.match = match
        session.status = GameNightSession.Status.MATCHED
    session.save(update_fields=[field, "status", "match"])
    return room_payload(session, user)
