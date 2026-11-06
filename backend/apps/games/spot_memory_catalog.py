"""Database seed content for Spot the Difference and Memory Match."""

SPOT_SCENES = [
    {
        "scene_id": "picnic_park", "title": "Picnic in the park",
        "differences": [
            {"id": "sun", "x": 845, "y": 175, "radius": 86, "label": "The sun has a different number of rays"},
            {"id": "bird", "x": 700, "y": 390, "radius": 82, "label": "A bird appears near the tree"},
            {"id": "kite", "x": 180, "y": 300, "radius": 80, "label": "The kite has a different tail"},
            {"id": "basket", "x": 550, "y": 710, "radius": 82, "label": "The picnic basket has a different snack"},
            {"id": "flower", "x": 230, "y": 800, "radius": 78, "label": "One flower changes color"},
            {"id": "cloud", "x": 490, "y": 155, "radius": 82, "label": "The cloud changes shape"},
        ],
    },
    {
        "scene_id": "cozy_cafe", "title": "A cozy café",
        "differences": [
            {"id": "clock", "x": 500, "y": 160, "radius": 80, "label": "The clock hands point somewhere else"},
            {"id": "plant", "x": 160, "y": 680, "radius": 82, "label": "The plant has a different leaf"},
            {"id": "mug", "x": 570, "y": 640, "radius": 80, "label": "The cup has a different design"},
            {"id": "pastry", "x": 720, "y": 720, "radius": 84, "label": "A pastry has a different topping"},
            {"id": "menu", "x": 820, "y": 320, "radius": 84, "label": "The menu has a different special"},
            {"id": "lamp", "x": 270, "y": 340, "radius": 82, "label": "The hanging lamp changes color"},
        ],
    },
    {
        "scene_id": "beach_day", "title": "A day at the beach",
        "differences": [
            {"id": "sun", "x": 830, "y": 170, "radius": 86, "label": "The sun wears different sunglasses"},
            {"id": "umbrella", "x": 250, "y": 470, "radius": 86, "label": "The beach umbrella has a different stripe"},
            {"id": "sandcastle", "x": 560, "y": 800, "radius": 86, "label": "The sandcastle has another tower"},
            {"id": "ball", "x": 770, "y": 720, "radius": 82, "label": "The beach ball changes color"},
            {"id": "boat", "x": 730, "y": 360, "radius": 85, "label": "A sailboat has a different sail"},
            {"id": "shell", "x": 360, "y": 850, "radius": 82, "label": "A shell appears in the sand"},
        ],
    },
]

MEMORY_DECKS = [
    {"title": "Little treats", "cards": [
        {"id": "cookie", "face": "🍪"}, {"id": "cake", "face": "🍰"}, {"id": "donut", "face": "🍩"}, {"id": "icecream", "face": "🍦"},
        {"id": "boba", "face": "🧋"}, {"id": "chocolate", "face": "🍫"}, {"id": "strawberry", "face": "🍓"}, {"id": "popcorn", "face": "🍿"},
    ]},
    {"title": "Tiny adventures", "cards": [
        {"id": "tent", "face": "⛺"}, {"id": "mountain", "face": "⛰️"}, {"id": "compass", "face": "🧭"}, {"id": "train", "face": "🚂"},
        {"id": "camera", "face": "📷"}, {"id": "suitcase", "face": "🧳"}, {"id": "island", "face": "🏝️"}, {"id": "rocket", "face": "🚀"},
    ]},
    {"title": "Garden friends", "cards": [
        {"id": "sunflower", "face": "🌻"}, {"id": "tulip", "face": "🌷"}, {"id": "bee", "face": "🐝"}, {"id": "butterfly", "face": "🦋"},
        {"id": "ladybug", "face": "🐞"}, {"id": "frog", "face": "🐸"}, {"id": "mushroom", "face": "🍄"}, {"id": "rainbow", "face": "🌈"},
    ]},
    {"title": "Good vibes", "cards": [
        {"id": "heart", "face": "💖"}, {"id": "sparkles", "face": "✨"}, {"id": "music", "face": "🎵"}, {"id": "star", "face": "⭐"},
        {"id": "sun", "face": "☀️"}, {"id": "moon", "face": "🌙"}, {"id": "gift", "face": "🎁"}, {"id": "smile", "face": "😊"},
    ]},
]
