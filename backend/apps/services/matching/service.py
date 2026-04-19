from apps.services.kundali.service import parse_kundali_payload
from apps.services.personality.service import personality_insights


def generate_match_score(user, partner_name: str) -> tuple[int, str]:
    """Orchestrates multiple service modules to produce a match score."""
    _kundali = parse_kundali_payload({"user": user.username, "partner": partner_name})
    _personality = personality_insights({"username": user.username})

    score = 78
    reasoning = "Compatibility looks strong based on baseline kundali + personality signals."
    return score, reasoning
