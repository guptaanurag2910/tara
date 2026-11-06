"""Shared item sets for the async Rank These game."""

SETS = [
    ("Rank a perfect slow Sunday", ["A long brunch", "A nature walk", "A cozy movie", "Trying a new recipe", "A spontaneous day trip"]),
    ("Rank the best first-date ideas", ["Coffee and a walk", "Street-food crawl", "Bookshop browse", "Mini golf", "Sunset picnic"]),
    ("Rank the most satisfying comfort foods", ["Fresh pizza", "Noodles", "A warm soup", "Crispy fries", "Chocolate dessert"]),
    ("Rank dream weekend getaways", ["A cabin in the hills", "A beach town", "A lively city", "A quiet countryside stay", "A scenic road trip"]),
    ("Rank the best qualities in a travel buddy", ["Easygoing", "Curious", "Great planner", "Funny", "Always up for an adventure"]),
    ("Rank little things that make a day better", ["A thoughtful text", "Good music", "A great cup of tea or coffee", "Golden-hour sunshine", "An unexpected compliment"]),
    ("Rank these movie-night essentials", ["Comfy blankets", "Popcorn", "Picking the movie together", "Dim lights", "Snacks for later"]),
    ("Rank the best ways to spend a rainy day", ["Read a book", "Cook something new", "Watch a comfort show", "Play a board game", "Listen to the rain"]),
    ("Rank the most fun things to learn together", ["A dance", "A new recipe", "A language", "Photography", "A musical instrument"]),
    ("Rank the best signs of great chemistry", ["Easy conversation", "Shared laughter", "Comfortable silence", "Curiosity about each other", "Playful teasing"]),
    ("Rank these ideal home vibes", ["Bright and airy", "Warm and cozy", "Plants everywhere", "Minimal and calm", "Colorful and eclectic"]),
    ("Rank the best spontaneous plans", ["Late-night dessert", "A scenic drive", "A local live show", "A new neighborhood", "A sunset walk"]),
    ("Rank these picnic picks", ["Fresh fruit", "Sandwiches", "Cheese and crackers", "Something sweet", "A fizzy drink"]),
    ("Rank the most memorable travel moments", ["Finding a hidden cafe", "Watching sunrise", "Getting happily lost", "Meeting locals", "Seeing a once-in-a-lifetime view"]),
    ("Rank these playful competitions", ["Bowling", "Trivia", "Mini golf", "Arcade games", "Cooking challenge"]),
    ("Rank the best ways to celebrate good news", ["A special dinner", "Calling someone you love", "A little getaway", "Dessert first", "Dancing around the room"]),
    ("Rank the best things about a beach day", ["Swimming", "A long walk", "Reading in the shade", "Beach snacks", "Watching the sunset"]),
    ("Rank these cozy evening rituals", ["A shared playlist", "Making tea", "Talking about the day", "A comfort show", "A short evening stroll"]),
    ("Rank the best things to find at a local market", ["Fresh flowers", "New snacks", "Handmade crafts", "Seasonal produce", "A tiny coffee stall"]),
    ("Rank the most fun road-trip roles", ["Playlist DJ", "Snack captain", "Navigator", "Window-seat daydreamer", "Spontaneous-stop spotter"]),
    ("Rank these ways to show someone you care", ["Remembering small details", "Making time", "Sending encouragement", "Doing a helpful thing", "Sharing a favorite treat"]),
    ("Rank the best kinds of conversations", ["Funny childhood stories", "Big dreams", "Travel tales", "Hot takes on movies", "What-if questions"]),
    ("Rank these ideal breakfast treats", ["Pancakes", "Savory toast", "Fresh fruit", "A pastry", "A big weekend brunch"]),
    ("Rank the best ways to explore a new city", ["Walk without a strict plan", "Take a food tour", "Visit a museum", "Use public transit", "Ask a local for a tip"]),
    ("Rank these tiny adventures", ["Try a new cafe", "Take a different route home", "Visit a nearby town", "Go to a live event", "Say yes to a new activity"]),
]

QUESTIONS = [
    {
        "order": index,
        "question_text": title,
        "options": [{"id": f"item-{item_index}", "text": item} for item_index, item in enumerate(items)],
        "tags": ["rank_these", "ranking-set"],
    }
    for index, (title, items) in enumerate(SETS, start=1)
]
