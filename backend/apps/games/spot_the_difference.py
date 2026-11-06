"""Turn-based asynchronous Spot the Difference game rules."""

from __future__ import annotations

from typing import Any


def create_initial_state(user_a_id: int, user_b_id: int, starting_user_id: int, scene: dict[str, Any]) -> dict[str, Any]:
    differences = scene.get("differences") or []
    if len(differences) < 3:
        raise ValueError("Spot the Difference needs at least three differences in its scene.")
    return {
        "scene_id": str(scene.get("scene_id") or "sunny_park"),
        "scene_title": str(scene.get("title") or "A little scene"),
        "players": [int(user_a_id), int(user_b_id)],
        "turn_user_id": int(starting_user_id),
        "differences": differences,
        "found": [],
        "scores": {str(user_a_id): 0, str(user_b_id): 0},
        "last_attempt": None,
        "completed": False,
        "winner_user_id": None,
        "draw": False,
        "attempts": 0,
    }


def serialize_state(state: dict[str, Any]) -> dict[str, Any]:
    payload = {key: value for key, value in (state or {}).items() if key != "differences"}
    payload["found"] = list((state or {}).get("found") or [])
    payload["scores"] = dict((state or {}).get("scores") or {})
    payload["difference_count"] = len((state or {}).get("differences") or [])
    if state.get("completed"):
        payload["differences"] = list(state.get("differences") or [])
    else:
        found_ids = set(payload["found"])
        payload["found_markers"] = [
            {"id": str(item.get("id")), "x": item.get("x"), "y": item.get("y")}
            for item in (state.get("differences") or []) if str(item.get("id")) in found_ids
        ]
    return payload


def apply_action(state: dict[str, Any], user_id: int, action: str, data: dict[str, Any]) -> dict[str, Any]:
    if action != "spot":
        raise ValueError("Choose a spot in one of the pictures.")
    state = dict(state or {})
    user_id = int(user_id)
    if user_id not in [int(value) for value in state.get("players", [])]:
        raise ValueError("You are not part of this Spot the Difference game.")
    if state.get("completed"):
        raise ValueError("This Spot the Difference game is already finished.")
    if int(state.get("turn_user_id") or 0) != user_id:
        raise ValueError("It is your match's turn to find a difference.")
    try:
        x, y = float(data.get("x")), float(data.get("y"))
    except (TypeError, ValueError):
        raise ValueError("Tap a spot in the picture.")
    if not (0 <= x <= 1000 and 0 <= y <= 1000):
        raise ValueError("That spot is outside the picture.")
    found = list(state.get("found") or [])
    if not state.get("differences"):
        raise ValueError("This Spot the Difference board is unavailable.")
    # Coordinates are normalized to a 1000 x 1000 square, independent of screen size.
    hit = next((difference for difference in state["differences"]
                if str(difference.get("id")) not in found
                and (x - float(difference["x"])) ** 2 + (y - float(difference["y"])) ** 2 <= float(difference.get("radius", 75)) ** 2), None)
    state["attempts"] = int(state.get("attempts", 0)) + 1
    other = next(value for value in state["players"] if int(value) != user_id)
    if hit:
        difference_id = str(hit["id"])
        found.append(difference_id)
        state["found"] = found
        state["scores"] = dict(state.get("scores") or {})
        state["scores"][str(user_id)] = int(state["scores"].get(str(user_id), 0)) + 1
        state["last_attempt"] = {"user_id": user_id, "correct": True, "difference_id": difference_id,
                                  "difference_label": str(hit.get("label") or "Difference found!")}
        if len(found) >= len(state["differences"]):
            scores = state["scores"]
            players = [str(value) for value in state["players"]]
            a, b = int(players[0]), int(players[1])
            winner = a if scores.get(players[0], 0) > scores.get(players[1], 0) else b if scores.get(players[1], 0) > scores.get(players[0], 0) else None
            state.update({"completed": True, "winner_user_id": winner, "draw": winner is None, "turn_user_id": None})
        else:
            state["turn_user_id"] = int(other)
    else:
        state["last_attempt"] = {"user_id": user_id, "correct": False, "difference_id": None}
        state["turn_user_id"] = int(other)
    return state
