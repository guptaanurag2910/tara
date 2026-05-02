from collections import defaultdict
from typing import Dict

from django.db import transaction

from ..models import PersonalityOption, PersonalityQuestion, PersonalityResponse, Trait

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
    if active_questions.exclude(question_text__startswith="[Demo]").exists():
        return

    next_question_texts = [item["question_text"] for item in STARTER_PERSONALITY_QUESTION_BANK]
    stale_demo_questions = PersonalityQuestion.objects.filter(question_text__startswith="[Demo]").exclude(
        question_text__in=next_question_texts
    )
    PersonalityResponse.objects.filter(question__in=stale_demo_questions).delete()
    PersonalityOption.objects.filter(question__in=stale_demo_questions).delete()
    stale_demo_questions.delete()

    for question_payload in STARTER_PERSONALITY_QUESTION_BANK:
        question, _ = PersonalityQuestion.objects.update_or_create(
            question_text=question_payload["question_text"],
            defaults={
                "category": question_payload["category"],
                "is_active": True,
            },
        )

        for option_payload in question_payload["options"]:
            PersonalityOption.objects.update_or_create(
                question=question,
                option_text=option_payload["option_text"],
                defaults={"trait_mapping": option_payload["trait_mapping"]},
            )


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
    raw_scores = _aggregate_trait_scores(user)
    normalized_scores = _normalize_scores(raw_scores)

    Trait.objects.update_or_create(
        user=user,
        defaults={"traits": normalized_scores},
    )

    return normalized_scores
