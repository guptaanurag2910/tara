"""Shared Nakshatra names and traditional matching attributes.

Keep chart generation and Ashtakoota matching on the same 27-entry table.
"""

NAKSHATRA_DATA = [
    ("Ashwini", "Deva", "Horse", "Adi"),
    ("Bharani", "Manushya", "Elephant", "Madhya"),
    ("Krittika", "Rakshasa", "Sheep", "Antya"),
    ("Rohini", "Manushya", "Serpent", "Adi"),
    ("Mrigashirsha", "Deva", "Serpent", "Madhya"),
    ("Ardra", "Manushya", "Dog", "Antya"),
    ("Punarvasu", "Deva", "Cat", "Adi"),
    ("Pushya", "Deva", "Sheep", "Madhya"),
    ("Ashlesha", "Rakshasa", "Cat", "Antya"),
    ("Magha", "Rakshasa", "Rat", "Adi"),
    ("Purva Phalguni", "Manushya", "Rat", "Madhya"),
    ("Uttara Phalguni", "Manushya", "Cow", "Antya"),
    ("Hasta", "Deva", "Buffalo", "Adi"),
    ("Chitra", "Rakshasa", "Tiger", "Madhya"),
    ("Swati", "Deva", "Buffalo", "Antya"),
    ("Vishakha", "Rakshasa", "Tiger", "Adi"),
    ("Anuradha", "Deva", "Deer", "Madhya"),
    ("Jyeshtha", "Rakshasa", "Deer", "Antya"),
    ("Mula", "Rakshasa", "Dog", "Adi"),
    ("Purva Ashadha", "Manushya", "Monkey", "Madhya"),
    ("Uttara Ashadha", "Manushya", "Mongoose", "Antya"),
    ("Shravana", "Deva", "Monkey", "Adi"),
    ("Dhanishta", "Rakshasa", "Lion", "Madhya"),
    ("Shatabhisha", "Rakshasa", "Horse", "Antya"),
    ("Purva Bhadrapada", "Manushya", "Lion", "Adi"),
    ("Uttara Bhadrapada", "Manushya", "Cow", "Madhya"),
    ("Revati", "Deva", "Elephant", "Antya"),
]

NAKSHATRAS = [entry[0] for entry in NAKSHATRA_DATA]
NAKSHATRA_ALIASES = {
    "mrigashira": "mrigashirsha",
    "mrigasira": "mrigashirsha",
}


def normalize_nakshatra(value: str) -> str:
    key = "".join(ch for ch in str(value or "").strip().lower() if ch.isalnum())
    return NAKSHATRA_ALIASES.get(key, key)


NAKSHATRA_TO_INDEX = {
    normalize_nakshatra(name): index
    for index, (name, _gana, _yoni, _nadi) in enumerate(NAKSHATRA_DATA, start=1)
}
NAKSHATRA_TO_GANA = {
    normalize_nakshatra(name): gana.lower()
    for name, gana, _yoni, _nadi in NAKSHATRA_DATA
}
NAKSHATRA_TO_YONI = {
    normalize_nakshatra(name): yoni.lower()
    for name, _gana, yoni, _nadi in NAKSHATRA_DATA
}
NAKSHATRA_TO_NADI = {
    normalize_nakshatra(name): nadi.lower()
    for name, _gana, _yoni, nadi in NAKSHATRA_DATA
}


def attributes_for_nakshatra_index(index: int) -> dict[str, str]:
    """Return matching attributes for a zero-based Nakshatra index."""
    if index < 0 or index >= len(NAKSHATRA_DATA):
        raise ValueError("Nakshatra index must be between 0 and 26.")
    _name, gana, yoni, nadi = NAKSHATRA_DATA[index]
    return {"gana": gana, "yoni": yoni, "nadi": nadi}
