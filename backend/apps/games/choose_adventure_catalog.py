"""Five-step cooperative adventure arcs with meaningful choices at each turn."""

ADVENTURES = [
    {
        "slug": "moonlit-island",
        "stages": [
            ("A map washes ashore beneath a silver moon. How do you reach the island?", "Borrow a daring pilot's airship", "Take a quiet fishing boat"),
            ("A glowing lighthouse flashes through the mist. What next?", "Steer straight toward the light", "Check the old map before moving"),
            ("You find a hidden cove guarded by a sleepy sea turtle. How do you pass?", "Offer to help it find its way home", "Wait patiently for it to wake"),
            ("Inside the cave, a singing crystal lights up. What do you do?", "Follow its strange melody deeper", "Study the symbols around it first"),
            ("The island offers one last gift before sunrise. Which do you choose?", "A compass that points to new adventures", "A cozy memory you can revisit anytime"),
        ],
    },
    {
        "slug": "clockwork-city",
        "stages": [
            ("A clockwork train arrives at a city that isn't on any map. Where do you begin?", "Hop aboard before it leaves", "Ask the station keeper about the city"),
            ("The streets are run by friendly little robots. Who do you ask for help?", "A fast courier with rocket shoes", "A patient librarian with a giant map"),
            ("A tower clock has stopped and the whole city is paused. How do you fix it?", "Climb up and investigate the gears", "Find the original blueprint first"),
            ("The clock starts, but one minute is missing. Where might it be?", "Inside the city's hidden garden", "Tucked in the clockmaker's journal"),
            ("The train is ready to take you home. What do you bring back?", "A key to unlock any future door", "A tiny robot friend and its stories"),
        ],
    },
    {
        "slug": "forest-of-lanterns",
        "stages": [
            ("Lanterns appear between the trees at dusk. Which trail do you follow?", "The bright trail that climbs uphill", "The gentle trail beside the stream"),
            ("A fox wearing a tiny scarf asks for directions. How do you help?", "Explore the crossroads together", "Draw a careful map from the signs"),
            ("A bridge is missing from the path. What is your plan?", "Build a quick stepping-stone crossing", "Ask the nearby beavers for advice"),
            ("You reach a clearing where the stars look close enough to touch. What do you wish for?", "A glimpse of somewhere brand new", "A little more time with this moment"),
            ("The forest offers a lantern for the road ahead. Which light do you take?", "A bold blue flame that never stands still", "A warm gold glow that feels like home"),
        ],
    },
    {
        "slug": "skyship-rescue",
        "stages": [
            ("A cloud-sailing ship sends an urgent signal. How do you answer?", "Launch a quick rescue in a tiny glider", "Gather supplies and make a safe plan"),
            ("A flock of messenger birds blocks the sky route. What now?", "Fly through the gap before it closes", "Signal the birds and ask them to guide you"),
            ("The ship's engine is powered by a mysterious flower. How do you restart it?", "Try the unusual lever with a flower shape", "Search the manual for the right sequence"),
            ("You find the crew safe but stranded above a storm. How do you help?", "Guide the ship through the clouds", "Wait for the wind to calm and lead them down"),
            ("The crew offers you a place on their next journey. What do you say?", "Absolutely—let's see what's out there", "Only if we can bring snacks for everyone"),
        ],
    },
    {
        "slug": "tiny-dragon-delivery",
        "stages": [
            ("A tiny dragon asks you to deliver a glowing egg before sunset. What do you pack?", "A rope, a compass, and a brave grin", "A blanket, snacks, and a detailed route"),
            ("A mountain path splits in two. Which way do you go?", "Up the steep path with the dragon tracks", "Around the hill where the wildflowers grow"),
            ("A bridge troll wants to hear a good joke before letting you pass. What do you do?", "Make up a silly joke on the spot", "Ask the dragon for its favorite story"),
            ("The egg begins to glow brighter. How do you keep it safe?", "Carry it close and keep moving", "Build a soft nest and let it settle"),
            ("You reach the dragon sanctuary just in time. How do you celebrate?", "Take a victory flight above the clouds", "Share a quiet picnic with the new family"),
        ],
    },
]

def _options(first, second):
    return [
        {"text": first, "path": "bold"},
        {"text": second, "path": "gentle"},
    ]

QUESTIONS = [
    {
        "adventure": adventure["slug"],
        "question_text": prompt,
        "options": _options(first, second),
        "order": (adventure_index * 5) + stage_index,
        "tags": [adventure["slug"], f"stage-{stage_index}"],
    }
    for adventure_index, adventure in enumerate(ADVENTURES)
    for stage_index, (prompt, first, second) in enumerate(adventure["stages"], start=1)
]
