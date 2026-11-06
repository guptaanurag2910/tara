"""Rules and state helpers for the chat-based Snakes, Ladders & Secrets game."""

import random
from typing import Any

FINISH = 49
BOARD_SIZE = 7
LADDERS = {3: 12, 7: 18, 15: 26, 24: 35, 32: 43}
SNAKES = {14: 5, 21: 11, 29: 19, 38: 25, 46: 34}
ROUTE_SQUARES = {9, 27, 40}
CHALLENGE_SQUARES = {6, 17, 31, 44}
POWER_SQUARES = {13: "shield", 23: "bonus", 36: "swap"}


def create_initial_state(user_a_id: int, user_b_id: int, starting_user_id: int, challenges: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "board_size": BOARD_SIZE,
        "finish": FINISH,
        "positions": {str(user_a_id): 0, str(user_b_id): 0},
        "turn_user_id": starting_user_id,
        "phase": "roll",
        "last_roll": None,
        "last_roll_user_id": None,
        "last_event": {"text": "Roll the die to start your race!", "kind": "start"},
        "ladders": {str(start): end for start, end in LADDERS.items()},
        "snakes": {str(start): end for start, end in SNAKES.items()},
        "route_squares": sorted(ROUTE_SQUARES),
        "challenge_squares": sorted(CHALLENGE_SQUARES),
        "power_squares": {str(square): power for square, power in POWER_SQUARES.items()},
        "shields": {},
        "bonus_rolls": {},
        "challenges": challenges,
        "challenge_index": 0,
        "pending_route": None,
        "challenge": None,
        "winner_user_id": None,
        "completed": False,
    }


def serialize_state(state: dict[str, Any], viewer_user_id: int | None = None) -> dict[str, Any]:
    """Redact picks and predictions until both players have locked them in."""
    payload = dict(state or {})
    payload["positions"] = dict(payload.get("positions") or {})
    payload["challenge"] = dict(payload["challenge"] or {}) if payload.get("challenge") else None
    challenge = payload.get("challenge")
    if challenge and not challenge.get("reveal"):
        picks = challenge.get("picks") or {}
        predictions = challenge.get("predictions") or {}
        payload["challenge"] = {
            key: value for key, value in challenge.items()
            if key not in {"picks", "predictions"}
        }
        payload["challenge"]["submitted_count"] = len(picks)
        if viewer_user_id is not None:
            own_key = str(viewer_user_id)
            payload["challenge"]["own_pick"] = picks.get(own_key)
            payload["challenge"]["own_prediction"] = predictions.get(own_key)
    return payload


def _other_player(state: dict[str, Any], user_id: int) -> int:
    players = [int(value) for value in (state.get("positions") or {}).keys()]
    return next((player_id for player_id in players if player_id != user_id), 0)


def _finish_if_needed(state: dict[str, Any], user_id: int) -> bool:
    position = int((state.get("positions") or {}).get(str(user_id), 0))
    if position < FINISH:
        return False
    state["positions"][str(user_id)] = FINISH
    state.update({"completed": True, "phase": "completed", "winner_user_id": user_id, "turn_user_id": None})
    state["last_event"] = {"text": "You reached the finish! What a race! 🏁", "kind": "win", "user_id": user_id}
    return True


def _advance_turn(state: dict[str, Any], user_id: int) -> None:
    state["turn_user_id"] = _other_player(state, user_id)
    state["phase"] = "roll"


def apply_action(state: dict[str, Any], user_id: int, action: str, data: dict[str, Any]) -> dict[str, Any]:
    """Apply a validated game action to a detached state and return its update."""
    state = dict(state or {})
    state["positions"] = dict(state.get("positions") or {})
    state["shields"] = dict(state.get("shields") or {})
    state["bonus_rolls"] = dict(state.get("bonus_rolls") or {})
    user_key = str(user_id)
    if user_key not in state["positions"]:
        raise ValueError("You are not part of this game.")
    if state.get("completed"):
        raise ValueError("This game is already finished.")

    if action == "roll":
        if state.get("phase") != "roll" or int(state.get("turn_user_id") or 0) != user_id:
            raise ValueError("It is your match's turn.")
        roll = random.randint(1, 6)
        old_position = int(state["positions"].get(user_key, 0))
        landing = min(FINISH, old_position + roll)
        state["last_roll"] = roll
        state["last_roll_user_id"] = user_id
        state["positions"][user_key] = landing
        state["last_event"] = {"text": f"You rolled {roll} and moved to square {landing}.", "kind": "roll", "user_id": user_id}
        if _finish_if_needed(state, user_id):
            return state
        if landing in LADDERS:
            state["positions"][user_key] = LADDERS[landing]
            state["last_event"] = {"text": f"🪜 Ladder! Up from {landing} to {LADDERS[landing]}!", "kind": "ladder", "user_id": user_id}
        elif landing in SNAKES:
            if state["shields"].pop(user_key, False):
                state["last_event"] = {"text": f"🛡️ Your shield blocked the snake on {landing}!", "kind": "shield", "user_id": user_id}
            else:
                state["positions"][user_key] = SNAKES[landing]
                state["last_event"] = {"text": f"🐍 Snake! Slid from {landing} to {SNAKES[landing]}.", "kind": "snake", "user_id": user_id}
        elif landing in ROUTE_SQUARES:
            state["phase"] = "route_choice"
            state["pending_route"] = {"user_id": user_id, "square": landing}
            state["last_event"] = {"text": f"A fork in the path at square {landing}! Choose your route.", "kind": "route", "user_id": user_id}
            return state
        elif landing in CHALLENGE_SQUARES:
            cards = state.get("challenges") or []
            if cards:
                index = int(state.get("challenge_index", 0)) % len(cards)
                card = cards[index]
                state["challenge_index"] = index + 1
                state["phase"] = "challenge"
                state["challenge"] = {
                    "mover_user_id": user_id,
                    "square": landing,
                    "prompt": card.get("prompt", "Pick one, then predict your match's choice."),
                    "options": list(card.get("options") or []),
                    "picks": {},
                    "predictions": {},
                }
                state["last_event"] = {"text": "✨ Secret square! Make your picks and predict your match.", "kind": "challenge", "user_id": user_id}
                return state
        elif landing in POWER_SQUARES:
            power = POWER_SQUARES[landing]
            if power == "shield":
                state["shields"][user_key] = True
                state["last_event"] = {"text": "🛡️ Shield acquired! It will block your next snake.", "kind": "power", "user_id": user_id}
            elif power == "bonus":
                state["last_event"] = {"text": "🎲 Bonus roll! Roll again right now.", "kind": "bonus", "user_id": user_id}
                state["turn_user_id"] = user_id
                return state
            else:
                other_id = _other_player(state, user_id)
                state["positions"][user_key], state["positions"][str(other_id)] = (
                    state["positions"].get(str(other_id), 0), state["positions"].get(user_key, 0),
                )
                state["last_event"] = {"text": "🪄 Plot twist! You swapped places on the board.", "kind": "power", "user_id": user_id}
        if _finish_if_needed(state, user_id):
            return state
        _advance_turn(state, user_id)
        return state

    if action == "choose_route":
        route = str(data.get("route", ""))
        pending = state.get("pending_route") or {}
        if state.get("phase") != "route_choice" or int(pending.get("user_id") or 0) != user_id:
            raise ValueError("There is no route choice waiting for you.")
        if route not in {"steady", "shortcut"}:
            raise ValueError("Choose the steady path or the risky shortcut.")
        if route == "shortcut":
            jump = random.choice((4, -3))
            state["positions"][user_key] = max(0, min(FINISH, int(state["positions"].get(user_key, 0)) + jump))
            text = "🚀 Shortcut paid off! Jumped ahead 4 squares." if jump > 0 else "😅 The shortcut backfired. Slid back 3 squares."
        else:
            text = "🌿 You took the steady path. No surprise move this time."
        state["pending_route"] = None
        state["last_event"] = {"text": text, "kind": "route_result", "user_id": user_id}
        if _finish_if_needed(state, user_id):
            return state
        _advance_turn(state, user_id)
        return state

    if action == "answer_challenge":
        challenge = dict(state.get("challenge") or {})
        if state.get("phase") != "challenge" or not challenge:
            raise ValueError("There is no secret square to answer.")
        options = [str(option) for option in challenge.get("options") or []]
        pick = str(data.get("pick", ""))
        prediction = str(data.get("prediction", ""))
        if len(options) < 2 or pick not in options or prediction not in options:
            raise ValueError("Choose an answer and predict your match's answer.")
        picks = dict(challenge.get("picks") or {})
        predictions = dict(challenge.get("predictions") or {})
        if user_key in picks:
            raise ValueError("Your secret-square picks are locked in.")
        picks[user_key] = pick
        predictions[user_key] = prediction
        challenge.update({"picks": picks, "predictions": predictions})
        if len(picks) < 2:
            state["challenge"] = challenge
            state["last_event"] = {"text": "🔒 Your picks are locked. Waiting for your match to reveal theirs.", "kind": "challenge_wait", "user_id": user_id}
            return state

        other_id = _other_player(state, user_id)
        other_key = str(other_id)
        correct = {key: predictions.get(key) == picks.get(str(other_id if key == user_key else user_id)) for key in (user_key, other_key)}
        for player_key, got_it_right in correct.items():
            if got_it_right:
                state["positions"][player_key] = min(FINISH, int(state["positions"].get(player_key, 0)) + 1)
        challenge["reveal"] = {
            "picks": picks,
            "predictions": predictions,
            "correct": correct,
        }
        state["challenge"] = challenge
        state["last_event"] = {"text": "✨ Revealed! Correct predictions earn a bonus square.", "kind": "challenge_reveal", "user_id": user_id}
        winner_id = next((int(player_key) for player_key in correct if state["positions"].get(player_key, 0) >= FINISH), None)
        if winner_id:
            state.update({"completed": True, "phase": "completed", "winner_user_id": winner_id, "turn_user_id": None})
        else:
            mover_id = int(challenge.get("mover_user_id") or user_id)
            _advance_turn(state, mover_id)
        return state

    raise ValueError("Unknown Snakes, Ladders & Secrets action.")
