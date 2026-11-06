"""The existing 60-item questionnaire, with its original reverse-keyed scoring."""

STATEMENTS = (
    "Am relaxed and handle stress well",
    "Am outgoing and sociable",
    "Am inventive and find clever ways to do things",
    "Tend to find fault with others",
    "Am dependable and steady",
    "Stay optimistic after experiencing a setback",
    "Have an assertive personality",
    "Have few artistic interests",
    "Am compassionate and have a soft heart",
    "Tend to be lazy",
    "Am moody and have up and down mood swings",
    "Rarely feel excited or eager",
    "Am curious about many different things",
    "Am respectful and treat others with respect",
    "Tend to be disorganized",
    "Can be tense",
    "Tend to be quiet",
    "Have little creativity",
    "Have a forgiving nature",
    "Can be somewhat careless",
    "Feel secure and comfortable with myself",
    "Am dominant and act as a leader",
    "Am fascinated by art, music, or literature",
    "Feel little sympathy for others",
    "Have difficulty getting started on tasks",
    "Am emotionally stable, not easily upset",
    "Am less active than other people",
    "Avoid intellectual, philosophical discussions",
    "Start arguments with others",
    "Am systematic and like to keep things in order",
    "Worry a lot",
    "Am sometimes shy and introverted",
    "Have difficulty imagining things",
    "Am suspicious of others' intentions",
    "Am reliable and can always be counted on",
    "Often feel sad",
    "Find it hard to influence people",
    "Value art and beauty",
    "Am helpful and unselfish with others",
    "Am efficient and get things done",
    "Keep my emotions under control",
    "Am full of energy",
    "Am complex, a deep thinker",
    "Am sometimes rude to others",
    "Keep things neat and tidy",
    "Rarely feel anxious or afraid",
    "Am talkative",
    "Am original and come up with new ideas",
    "Assume the best about people",
    "Sometimes behave irresponsibly",
    "Tend to feel depressed or blue",
    "Prefer to have others take charge",
    "Think poetry and plays are boring",
    "Can be cold and uncaring",
    "Am persistent and work until the task is finished",
    "Am temperamental and get emotional easily",
    "Show a lot of enthusiasm",
    "Have little interest in abstract ideas",
    "Am polite and courteous to others",
    "Leave a mess and don't clean up",
)

TRAITS = ("sensitivity", "extraversion", "openness", "agreeableness", "conscientiousness")
REVERSE_KEYED = frozenset((
    0, 5, 20, 25, 40, 45,
    11, 16, 26, 31, 36, 51,
    7, 17, 27, 32, 52, 57,
    3, 23, 28, 33, 43, 53,
    9, 14, 19, 24, 49, 59,
))
OPTION_LABELS = ("Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree")
QUESTION_PREFIX = "[Vibe "


def question_text(index, statement):
    return f"[Vibe {index + 1:02d}] {statement}"


def option_mapping(index, response):
    scored = 6 - response if index in REVERSE_KEYED else response
    return {TRAITS[index % len(TRAITS)]: scored}
