"""Rules for asynchronous, two-player Are We in Sync? Bingo."""

import random
from typing import Any

BOARD_SIZE = 5
FREE_INDEX = 12
MAX_PROMPTS = 24


def _has_bingo(card: list[dict[str, Any]]) -> bool:
    lines = [[row * BOARD_SIZE + col for col in range(BOARD_SIZE)] for row in range(BOARD_SIZE)]
    lines += [[row * BOARD_SIZE + col for row in range(BOARD_SIZE)] for col in range(BOARD_SIZE)]
    lines += [[index * BOARD_SIZE + index for index in range(BOARD_SIZE)]]
    lines += [[index * BOARD_SIZE + (BOARD_SIZE - index - 1) for index in range(BOARD_SIZE)]]
    return any(all(card[index].get("free") or card[index].get("correct") for index in line) for line in lines)


def _counts(state: dict[str, Any]) -> dict[str, int]:
    return {
        user_id: sum(1 for cell in card if cell.get("correct") and not cell.get("free"))
        for user_id, card in (state.get("cards") or {}).items()
    }


def create_initial_state(user_a_id: int, user_b_id: int, starting_user_id: int, prompts: list[dict[str, Any]]) -> dict[str, Any]:
    available = [
        {"id": int(prompt["id"]), "prompt": str(prompt["prompt"]),
         "options": [str(option).strip() for option in prompt.get("options", []) if str(option).strip()]}
        for prompt in prompts
        if len([option for option in prompt.get("options", []) if str(option).strip()]) >= 2
    ]
    if len(available) < MAX_PROMPTS:
        raise ValueError("Bingo needs at least 24 active prompts.")
    chosen = random.sample(available, MAX_PROMPTS)
    cards = {}
    for user_id in (user_a_id, user_b_id):
        shuffled = chosen.copy()
        random.shuffle(shuffled)
        cells = [{"prompt_id": prompt["id"], "prompt": prompt["prompt"], "options": prompt["options"], "correct": False, "called": False, "free": False} for prompt in shuffled]
        cells.insert(FREE_INDEX, {"prompt_id": None, "prompt": "FREE", "options": [], "correct": True, "called": True, "free": True})
        cards[str(user_id)] = cells
    return {
        "board_size": BOARD_SIZE,
        "players": [user_a_id, user_b_id],
        "cards": cards,
        "turn_user_id": starting_user_id,
        "phase": "predict",
        "pending": None,
        "used_prompt_ids": [],
        "last_reveal": None,
        "completed": False,
        "winner_user_id": None,
        "draw": False,
        "turns_played": 0,
    }


def serialize_state(state: dict[str, Any], viewer_user_id: int | None = None) -> dict[str, Any]:
    """Hide a caller's prediction and responder's answer until the reveal."""
    payload = dict(state or {})
    payload["cards"] = {key: [dict(cell) for cell in card] for key, card in (state.get("cards") or {}).items()}
    payload["used_prompt_ids"] = list(state.get("used_prompt_ids") or [])
    pending = state.get("pending")
    if pending:
        payload["pending"] = {key: value for key, value in pending.items() if key not in {"prediction", "answer"}}
        if viewer_user_id is not None and int(pending.get("caller_id") or 0) == int(viewer_user_id):
            payload["pending"]["own_prediction"] = pending.get("prediction")
        if viewer_user_id is not None and int(pending.get("answerer_id") or 0) == int(viewer_user_id):
            payload["pending"]["own_answer"] = pending.get("answer")
    payload["correct_counts"] = _counts(state)
    return payload


def _other_player(state: dict[str, Any], user_id: int) -> int:
    return next((int(player_id) for player_id in state.get("cards", {}) if int(player_id) != user_id), 0)


def _complete(state: dict[str, Any], winner_id: int | None, draw: bool = False) -> None:
    state.update({"completed": True, "phase": "completed", "winner_user_id": winner_id, "draw": draw, "turn_user_id": None})


def apply_action(state: dict[str, Any], user_id: int, action: str, data: dict[str, Any]) -> dict[str, Any]:
    state = dict(state or {})
    state["cards"] = {key: [dict(cell) for cell in card] for key, card in (state.get("cards") or {}).items()}
    state["used_prompt_ids"] = list(state.get("used_prompt_ids") or [])
    user_key = str(user_id)
    if user_key not in state["cards"]:
        raise ValueError("You are not part of this Bingo game.")
    if state.get("completed"):
        raise ValueError("This Bingo game is already finished.")
    if action == "make_prediction":
        if state.get("phase") != "predict" or int(state.get("turn_user_id") or 0) != user_id:
            raise ValueError("It is your match's turn to choose a Bingo square.")
        try:
            prompt_id = int(data.get("prompt_id"))
        except (TypeError, ValueError):
            raise ValueError("Choose an available Bingo square.")
        cell = next((item for item in state["cards"][user_key] if item.get("prompt_id") == prompt_id), None)
        prediction = str(data.get("prediction", ""))
        if not cell or cell.get("free") or cell.get("called") or prompt_id in state["used_prompt_ids"]:
            raise ValueError("That square has already been played.")
        if prediction not in cell.get("options", []):
            raise ValueError("Choose one of the answers before locking your prediction.")
        answerer_id = _other_player(state, user_id)
        state["pending"] = {"caller_id": user_id, "answerer_id": answerer_id, "prompt_id": prompt_id,
                            "prompt": cell["prompt"], "options": cell["options"], "prediction": prediction}
        state["phase"] = "answer"
        state["turn_user_id"] = answerer_id
        return state

    if action == "answer_prompt":
        pending = dict(state.get("pending") or {})
        if state.get("phase") != "answer" or int(pending.get("answerer_id") or 0) != user_id:
            raise ValueError("You do not have a Bingo answer waiting.")
        answer = str(data.get("answer", ""))
        if answer not in pending.get("options", []):
            raise ValueError("Choose one of the answers to continue.")
        caller_id = int(pending["caller_id"])
        caller_key = str(caller_id)
        prompt_id = int(pending["prompt_id"])
        correct = answer == pending.get("prediction")
        for card in state["cards"].values():
            for cell in card:
                if cell.get("prompt_id") == prompt_id:
                    cell["called"] = True
        caller_cell = next(cell for cell in state["cards"][caller_key] if cell.get("prompt_id") == prompt_id)
        caller_cell["correct"] = correct
        state["used_prompt_ids"].append(prompt_id)
        state["turns_played"] = int(state.get("turns_played", 0)) + 1
        state["last_reveal"] = {"caller_id": caller_id, "answerer_id": user_id, "prompt_id": prompt_id,
                                "prompt": pending["prompt"], "prediction": pending["prediction"],
                                "answer": answer, "correct": correct}
        state["pending"] = None
        winner_id = caller_id if correct and _has_bingo(state["cards"][caller_key]) else None
        if winner_id:
            _complete(state, winner_id)
        elif len(state["used_prompt_ids"]) >= MAX_PROMPTS:
            counts = _counts(state)
            player_a, player_b = map(str, state["players"])
            winner_id = int(player_a) if counts[player_a] > counts[player_b] else int(player_b) if counts[player_b] > counts[player_a] else None
            _complete(state, winner_id, draw=winner_id is None)
        else:
            state["phase"] = "predict"
            state["turn_user_id"] = user_id
        return state

    raise ValueError("Unknown Bingo action.")
