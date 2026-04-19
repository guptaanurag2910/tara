from collections import defaultdict
from typing import Dict

from django.db import transaction

from ..models import PersonalityResponse, Trait


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
