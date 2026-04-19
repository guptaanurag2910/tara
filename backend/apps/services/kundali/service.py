def parse_kundali_payload(payload: dict) -> dict:
    """Normalize raw kundali payload before downstream scoring."""
    return {
        "raw": payload,
        "validated": bool(payload),
    }
