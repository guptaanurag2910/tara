"""Asynchronous two-player Memory Match game rules."""

from __future__ import annotations

import random
from typing import Any


def create_initial_state(user_a_id: int, user_b_id: int, starting_user_id: int, deck: dict[str, Any]) -> dict[str, Any]:
    faces = deck.get("cards") or []
    if len(faces) < 4:
        raise ValueError("Memory Match needs at least four pairs in its deck.")
    card_ids = [str(item.get("id")) for item in faces if item.get("id") and item.get("face")]
    if len(card_ids) != len(faces) or len(set(card_ids)) != len(card_ids):
        raise ValueError("This Memory Match deck has invalid cards.")
    cards = [{"face": str(item["face"]), "matched": False} for item in faces for _ in (0, 1)]
    random.shuffle(cards)
    for index, card in enumerate(cards):
        card["id"] = f"card_{index}"
    return {
        "title": str(deck.get("title") or "Memory Match"),
        "players": [int(user_a_id), int(user_b_id)],
        "turn_user_id": int(starting_user_id),
        "cards": cards,
        "face_up": [],
        "scores": {str(user_a_id): 0, str(user_b_id): 0},
        "phase": "first",
        "last_turn": None,
        "completed": False,
        "winner_user_id": None,
        "draw": False,
        "moves": 0,
    }


def serialize_state(state: dict[str, Any]) -> dict[str, Any]:
    payload = dict(state or {})
    cards = []
    visible = {str(value) for value in payload.get("face_up", [])}
    for card in payload.get("cards", []):
        matched = bool(card.get("matched"))
        is_visible = matched or str(card.get("id")) in visible or payload.get("completed")
        cards.append({"id": str(card.get("id")), "matched": matched, "face": card.get("face") if is_visible else None, "revealed": is_visible})
    payload["cards"] = cards
    payload["face_up"] = list(payload.get("face_up") or [])
    payload["scores"] = dict(payload.get("scores") or {})
    return payload


def apply_action(state: dict[str, Any], user_id: int, action: str, data: dict[str, Any]) -> dict[str, Any]:
    if action != "flip":
        raise ValueError("Choose a card to flip.")
    state = dict(state or {})
    state["cards"] = [dict(card) for card in state.get("cards", [])]
    state["scores"] = dict(state.get("scores") or {})
    state["face_up"] = list(state.get("face_up") or [])
    user_id = int(user_id)
    if user_id not in [int(value) for value in state.get("players", [])]:
        raise ValueError("You are not part of this Memory Match game.")
    if state.get("completed"):
        raise ValueError("This Memory Match game is already finished.")
    if int(state.get("turn_user_id") or 0) != user_id:
        raise ValueError("It is your match's turn to flip a card.")
    card_id = str(data.get("card_id", ""))
    if state.get("phase") == "next_turn":
        state["face_up"] = []
        state["phase"] = "first"
    card = next((item for item in state["cards"] if str(item.get("id")) == card_id), None)
    if not card:
        raise ValueError("That card is not on this board.")
    if card.get("matched") or card_id in state["face_up"]:
        raise ValueError("That card is already revealed.")

    # A mismatch stays visible while the next player is offline. Their first flip
    # starts their turn and clears the old pair, so neither player needs to be online together.
    state["face_up"].append(card_id)
    if len(state["face_up"]) == 1:
        state["phase"] = "second"
        state["last_turn"] = None
        return state

    first_id, second_id = state["face_up"]
    first = next(item for item in state["cards"] if str(item["id"]) == first_id)
    second = next(item for item in state["cards"] if str(item["id"]) == second_id)
    state["moves"] = int(state.get("moves", 0)) + 1
    matched = first.get("face") == second.get("face")
    state["last_turn"] = {"user_id": user_id, "matched": matched, "cards": [first_id, second_id]}
    if matched:
        first["matched"] = second["matched"] = True
        state["scores"][str(user_id)] = int(state["scores"].get(str(user_id), 0)) + 1
        state["face_up"] = []
        if all(item.get("matched") for item in state["cards"]):
            scores = state["scores"]
            players = [str(value) for value in state["players"]]
            a, b = int(players[0]), int(players[1])
            winner = a if scores.get(players[0], 0) > scores.get(players[1], 0) else b if scores.get(players[1], 0) > scores.get(players[0], 0) else None
            state.update({"phase": "completed", "completed": True, "winner_user_id": winner, "draw": winner is None, "turn_user_id": None})
        else:
            state["phase"] = "first"
    else:
        other = next(value for value in state["players"] if int(value) != user_id)
        state["turn_user_id"] = int(other)
        state["phase"] = "next_turn"
    return state
