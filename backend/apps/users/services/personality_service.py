from collections import defaultdict
from typing import Dict

from django.db import transaction

from ..models import PersonalityOption, PersonalityQuestion, PersonalityResponse, Trait
from .vibe_question_bank import OPTION_LABELS, QUESTION_PREFIX, STATEMENTS, option_mapping, question_text

STARTER_PERSONALITY_QUESTION_BANK = [
    {
        "question_text": "[Demo] When life feels heavy, you...",
        "category": PersonalityQuestion.Category.EMOTIONS,
        "options": [
            {"option_text": "Talk it out", "trait_mapping": {"communication": 3, "openness": 1}},
            {"option_text": "Take space", "trait_mapping": {"stability": 2, "emotional_depth": 1}},
            {"option_text": "Stay busy", "trait_mapping": {"overthinking": 2, "chaos": 1}},
            {"option_text": "Sit with it", "trait_mapping": {"emotional_depth": 2, "stability": 2}},
        ],
    },
    {
        "question_text": "[Demo] Big decisions come from...",
        "category": PersonalityQuestion.Category.PERSONALITY,
        "options": [
            {"option_text": "Logic", "trait_mapping": {"stability": 2, "overthinking": 1}},
            {"option_text": "Instinct", "trait_mapping": {"openness": 2, "emotional_depth": 1}},
            {"option_text": "Advice", "trait_mapping": {"communication": 2, "stability": 1}},
            {"option_text": "A mix", "trait_mapping": {"communication": 1, "openness": 1, "stability": 1}},
        ],
    },
    {
        "question_text": "[Demo] In any connection, you value...",
        "category": PersonalityQuestion.Category.RELATIONSHIPS,
        "options": [
            {"option_text": "Depth", "trait_mapping": {"emotional_depth": 3}},
            {"option_text": "Peace", "trait_mapping": {"stability": 3}},
            {"option_text": "Honesty", "trait_mapping": {"communication": 3}},
            {"option_text": "Freedom", "trait_mapping": {"openness": 2, "chaos": 1}},
        ],
    },
    {
        "question_text": "[Demo] Your best space feels...",
        "category": PersonalityQuestion.Category.PERSONALITY,
        "options": [
            {"option_text": "Quiet", "trait_mapping": {"stability": 2, "emotional_depth": 1}},
            {"option_text": "Warm", "trait_mapping": {"communication": 2, "openness": 1}},
            {"option_text": "Clear", "trait_mapping": {"stability": 2, "overthinking": 1}},
            {"option_text": "Open", "trait_mapping": {"openness": 2, "chaos": 1}},
        ],
    },
    {
        "question_text": "[Demo] Your natural rhythm is...",
        "category": PersonalityQuestion.Category.PERSONALITY,
        "options": [
            {"option_text": "Steady", "trait_mapping": {"stability": 3}},
            {"option_text": "Balanced", "trait_mapping": {"stability": 1, "openness": 1, "communication": 1}},
            {"option_text": "Active", "trait_mapping": {"chaos": 2, "openness": 1}},
            {"option_text": "Flowing", "trait_mapping": {"chaos": 3, "openness": 1}},
        ],
    },
]


def _coerce_number(value):
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _aggregate_trait_scores(user) -> Dict[str, float]:
    """Aggregate dynamic trait scores from all selected personality options."""
    responses = PersonalityResponse.objects.filter(user=user).select_related("selected_option")

    totals: Dict[str, float] = defaultdict(float)
    for response in responses:
        mapping = response.selected_option.trait_mapping or {}
        if not isinstance(mapping, dict):
            continue

        for trait, raw_value in mapping.items():
            trait_name = str(trait).strip()
            if not trait_name:
                continue

            numeric_value = _coerce_number(raw_value)
            if numeric_value is None:
                continue

            totals[trait_name] += numeric_value

    return dict(totals)


def _normalize_scores(raw_scores: Dict[str, float], minimum: float = 1.0, maximum: float = 10.0) -> Dict[str, float]:
    """Scale raw trait totals into a configurable range (default 1-10)."""
    if not raw_scores:
        return {}

    values = list(raw_scores.values())
    low = min(values)
    high = max(values)

    if low == high:
        flat_value = maximum if high > 0 else minimum
        return {key: round(flat_value, 2) for key in raw_scores}

    spread = high - low
    scale = maximum - minimum

    normalized: Dict[str, float] = {}
    for key, value in raw_scores.items():
        scaled_value = minimum + ((value - low) / spread) * scale
        normalized[key] = round(scaled_value, 2)

    return normalized


@transaction.atomic
def sync_starter_personality_questions() -> None:
    active_questions = PersonalityQuestion.objects.filter(is_active=True)
    if active_questions.exclude(question_text__startswith="[Demo]").exclude(question_text__startswith=QUESTION_PREFIX).exists():
        return
    # Preserve historical demo responses, but do not include those questions in the new test.
    PersonalityQuestion.objects.filter(question_text__startswith="[Demo]").update(is_active=False)
    if active_questions.filter(question_text__startswith=QUESTION_PREFIX).count() == len(STATEMENTS):
        return
    for index, statement in enumerate(STATEMENTS):
        question, _ = PersonalityQuestion.objects.update_or_create(
            question_text=question_text(index, statement),
            defaults={
                "category": PersonalityQuestion.Category.PERSONALITY,
                "is_active": True,
            },
        )
        for response, label in enumerate(OPTION_LABELS, start=1):
            PersonalityOption.objects.update_or_create(
                question=question,
                option_text=label,
                defaults={"trait_mapping": option_mapping(index, response)},
            )


def _big_five_scores(user):
    question_count = PersonalityQuestion.objects.filter(is_active=True, question_text__startswith=QUESTION_PREFIX).count()
    if not question_count:
        return None
    responses = PersonalityResponse.objects.filter(
        user=user, question__is_active=True, question__question_text__startswith=QUESTION_PREFIX
    ).select_related("selected_option")
    if responses.count() < question_count:
        return {}

    values = defaultdict(list)
    for response in responses:
        for trait, value in (response.selected_option.trait_mapping or {}).items():
            numeric = _coerce_number(value)
            if numeric is not None:
                values[trait].append(numeric)
    return {
        trait: round(1 + ((sum(scores) / len(scores) - 1) / 4) * 9, 2)
        for trait, scores in values.items() if scores
    }


@transaction.atomic
def calculate_traits(user) -> Dict[str, float]:
    """
    Calculate and persist trait scores for a user from PersonalityResponse data.

    Steps:
    1. Read all responses and their selected option trait_mapping.
    2. Dynamically aggregate all trait keys.
    3. Normalize aggregated values to 1-10.
    4. Save to Trait model.
    """
    big_five_scores = _big_five_scores(user)
    normalized_scores = big_five_scores if big_five_scores is not None else _normalize_scores(_aggregate_trait_scores(user))

    Trait.objects.update_or_create(
        user=user,
        defaults={"traits": normalized_scores},
    )

    return normalized_scores
