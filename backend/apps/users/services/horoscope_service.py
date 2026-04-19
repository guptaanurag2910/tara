from typing import Dict

VALID_SIGNS = {
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
}

HOROSCOPE_BY_SIGN: Dict[str, Dict[str, str]] = {
    "aries": {
        "career": "Take initiative this week. Quick decisions can open a strong work opportunity.",
        "love": "Be direct but kind. Honest communication can deepen your bond.",
        "finance": "Avoid impulse spending. A simple budget will keep things smooth.",
    },
    "taurus": {
        "career": "Steady effort brings good results. Focus on finishing pending tasks.",
        "love": "Consistency matters now. Small thoughtful gestures will mean a lot.",
        "finance": "Good week for savings. Keep money choices practical.",
    },
    "gemini": {
        "career": "Your ideas are strong right now. Share them confidently in meetings.",
        "love": "Light, fun conversations will improve closeness.",
        "finance": "Review subscriptions and recurring costs to improve cash flow.",
    },
    "cancer": {
        "career": "Teamwork supports your growth. Collaborate instead of overloading yourself.",
        "love": "Emotional openness will help you feel more secure in relationships.",
        "finance": "Prioritize needs over wants this week.",
    },
    "leo": {
        "career": "Visibility is high. Step into leadership where possible.",
        "love": "Warmth and appreciation will strengthen your relationship.",
        "finance": "Spend on value, not image. Keep long-term goals in mind.",
    },
    "virgo": {
        "career": "Detail-focused work shines now. Organize and execute with discipline.",
        "love": "Try not to overanalyze. Keep conversations clear and gentle.",
        "finance": "Smart planning helps. Good time to track expenses.",
    },
    "libra": {
        "career": "Partnerships can bring progress. Balance priorities carefully.",
        "love": "Romance improves through quality time and emotional balance.",
        "finance": "Stay fair with shared expenses and avoid delay in payments.",
    },
    "scorpio": {
        "career": "Deep focus helps you solve complex challenges this week.",
        "love": "Trust grows when you express feelings calmly and clearly.",
        "finance": "Be strategic. Avoid risky shortcuts with money.",
    },
    "sagittarius": {
        "career": "Learning and networking may bring a fresh career direction.",
        "love": "Keep things honest and playful to maintain harmony.",
        "finance": "Watch travel and lifestyle spending this week.",
    },
    "capricorn": {
        "career": "Strong progress possible through consistency and structured planning.",
        "love": "Make time for connection, not just responsibilities.",
        "finance": "Stable gains likely. Continue disciplined money habits.",
    },
    "aquarius": {
        "career": "Creative thinking can solve stuck issues at work.",
        "love": "Give space and listen openly for smoother communication.",
        "finance": "Try a practical plan before making big purchases.",
    },
    "pisces": {
        "career": "Use intuition plus planning for best outcomes this week.",
        "love": "Emotional depth is strong. Be clear about your needs.",
        "finance": "Keep financial decisions simple and avoid emotional spending.",
    },
}


def _title_case_sign(sign: str) -> str:
    return str(sign).strip().lower().capitalize()


def get_horoscope_for_sign(sign: str) -> Dict[str, str]:
    normalized_sign = str(sign or "").strip().lower()
    if normalized_sign not in VALID_SIGNS:
        allowed = ", ".join(sorted(VALID_SIGNS))
        raise ValueError(f"Invalid sign. Use one of: {allowed}.")

    payload = HOROSCOPE_BY_SIGN[normalized_sign]
    return {
        "sign": _title_case_sign(normalized_sign),
        "career": payload["career"],
        "love": payload["love"],
        "finance": payload["finance"],
    }

