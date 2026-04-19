import random
from datetime import date, time
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.chat.models import Message
from apps.games.models import Game, GameOption, GameQuestion, GameResponse, GameSession
from apps.matching.models import Match, Swipe
from apps.matching.recommendation_service import refresh_daily_recommendations
from apps.matching.services import create_match_from_mutual_like
from apps.users.models import (
    KundaliProfile,
    PersonalityOption,
    PersonalityQuestion,
    PersonalityResponse,
    UserProfileImage,
)
from apps.users.services import calculate_traits
from apps.users.services.kundali_service import NAKSHATRAS, calculate_kundali

User = get_user_model()

DEMO_DOMAIN = "@tara.demo"


def _is_preference_match(user, candidate) -> bool:
    user_pref = str(user.preference or "").strip().lower()
    candidate_pref = str(candidate.preference or "").strip().lower()
    user_gender = str(user.gender or "").strip().lower()
    candidate_gender = str(candidate.gender or "").strip().lower()

    user_accepts_candidate = user_pref == "everyone" or user_pref == candidate_gender
    candidate_accepts_user = candidate_pref == "everyone" or candidate_pref == user_gender
    return user_accepts_candidate and candidate_accepts_user


class Command(BaseCommand):
    help = "Seed rich demo data for Tara (users, matches, swipes, chat, games)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="TaraDemo@123",
            help="Password used for all demo users.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete previous demo users/data and recreate from scratch.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        do_reset = bool(options["reset"])

        if do_reset:
            self._reset_demo_data()

        users = self._create_demo_users(password=password)
        self._seed_profile_images(users)
        question_bank = self._create_personality_questions()
        self._assign_personality_responses(users, question_bank)
        self._create_or_update_kundali(users)
        self._create_demo_games()
        matches = self._create_swipes_and_matches(users)
        self._seed_chat_for_matches(matches)
        self._seed_game_sessions(matches)
        daily_summary = refresh_daily_recommendations(top_n=10)

        self.stdout.write(self.style.SUCCESS("Demo data seed complete."))
        self.stdout.write("")
        self.stdout.write("Credentials (all use same password):")
        self.stdout.write(f"password: {password}")
        for user in users:
            self.stdout.write(f"- {user.phone_number}  ({user.email})  ({user.name})")

        self.stdout.write("")
        self.stdout.write(
            f"Created/updated users={len(users)}, matches={len(matches)}, "
            f"daily_recommendations={daily_summary.get('recommendations_created', 0)}"
        )

    def _reset_demo_data(self):
        demo_users = User.objects.filter(email__iendswith=DEMO_DOMAIN)
        demo_user_ids = list(demo_users.values_list("id", flat=True))
        demo_questions = PersonalityQuestion.objects.filter(question_text__startswith="[Demo]")
        if demo_user_ids:
            Message.objects.filter(sender_id__in=demo_user_ids).delete()
            Swipe.objects.filter(user_id__in=demo_user_ids).delete()
            Swipe.objects.filter(target_user_id__in=demo_user_ids).delete()
            Match.objects.filter(user_a_id__in=demo_user_ids).delete()
            Match.objects.filter(user_b_id__in=demo_user_ids).delete()
            GameResponse.objects.filter(user_id__in=demo_user_ids).delete()
            GameSession.objects.filter(started_by_id__in=demo_user_ids).delete()
            demo_users.delete()

        PersonalityResponse.objects.filter(question__in=demo_questions).delete()
        PersonalityOption.objects.filter(question__in=demo_questions).delete()
        demo_questions.delete()

    def _create_demo_users(self, *, password: str):
        templates = [
            ("Aarav Mehta", "+919000000001", "male", "female", date(1996, 3, 14), Decimal("19.0760"), Decimal("72.8777"), time(7, 20)),
            ("Rohan Kapoor", "+919000000002", "male", "female", date(1994, 10, 2), Decimal("28.6139"), Decimal("77.2090"), None),
            ("Vikram Rao", "+919000000003", "male", "female", date(1993, 7, 19), Decimal("12.9716"), Decimal("77.5946"), time(9, 45)),
            ("Kabir Singh", "+919000000004", "male", "everyone", date(1997, 1, 8), Decimal("22.5726"), Decimal("88.3639"), None),
            ("Arjun Nair", "+919000000005", "male", "female", date(1998, 6, 30), Decimal("13.0827"), Decimal("80.2707"), time(6, 5)),
            ("Ishaan Patel", "+919000000006", "male", "female", date(1995, 12, 11), Decimal("23.0225"), Decimal("72.5714"), None),
            ("Neel Sharma", "+919000000007", "male", "everyone", date(1999, 4, 24), Decimal("26.9124"), Decimal("75.7873"), time(22, 10)),
            ("Dev Khanna", "+919000000008", "male", "female", date(2000, 9, 13), Decimal("18.5204"), Decimal("73.8567"), None),
            ("Anaya Iyer", "+919000000009", "female", "male", date(1997, 5, 26), Decimal("12.2958"), Decimal("76.6394"), time(5, 50)),
            ("Kiara Shah", "+919000000010", "female", "male", date(1996, 8, 17), Decimal("19.9975"), Decimal("73.7898"), None),
            ("Meera Joshi", "+919000000011", "female", "male", date(1995, 2, 4), Decimal("26.8467"), Decimal("80.9462"), time(11, 35)),
            ("Riya Verma", "+919000000012", "female", "everyone", date(1998, 11, 9), Decimal("21.1458"), Decimal("79.0882"), None),
            ("Sana Malik", "+919000000013", "female", "male", date(1994, 1, 27), Decimal("17.3850"), Decimal("78.4867"), time(16, 15)),
            ("Tara Bansal", "+919000000014", "female", "male", date(2000, 3, 3), Decimal("30.7333"), Decimal("76.7794"), None),
            ("Naina Roy", "+919000000015", "female", "everyone", date(1999, 7, 7), Decimal("25.5941"), Decimal("85.1376"), time(13, 0)),
            ("Aditi Sen", "+919000000016", "female", "male", date(1997, 9, 21), Decimal("22.3072"), Decimal("73.1812"), None),
        ]

        interest_sets = [
            ["Music", "Travel", "Long walks"],
            ["Books", "Coffee", "Deep talks"],
            ["Fitness", "Hiking", "Mindfulness"],
            ["Movies", "Food", "Road trips"],
            ["Art", "Poetry", "Stargazing"],
            ["Photography", "Cycling", "Live gigs"],
        ]

        created_users = []
        for index, (name, phone_number, gender, preference, dob, lat, lng, birth_time) in enumerate(templates, start=1):
            email = f"{name.lower().replace(' ', '.')}.{index}{DEMO_DOMAIN}"
            first_name = name.split(" ")[0]
            defaults = {
                "name": name,
                "phone_number": phone_number,
                "date_of_birth": dob,
                "gender": gender,
                "preference": preference,
                "birth_time": birth_time,
                "latitude": lat,
                "longitude": lng,
                "is_birth_time_default": birth_time is None,
                "bio": f"{first_name} here for meaningful conversations, soulful chemistry, and cosmic compatibility.",
                "interests": interest_sets[(index - 1) % len(interest_sets)],
                "is_active": True,
            }
            user, _ = User.objects.update_or_create(email=email, defaults=defaults)
            user.set_password(password)
            user.save(update_fields=["password"])
            created_users.append(user)

        return created_users

    def _seed_profile_images(self, users):
        pool_dir = Path(settings.MEDIA_ROOT) / "demo_seed_faces"
        preferred_files = [
            "aanya_big.png",
            "meera_big.png",
            "top_aanya.png",
            "top_arjun.png",
            "top_meera.png",
            "top_kabir.png",
        ]
        pool_paths = [pool_dir / filename for filename in preferred_files if (pool_dir / filename).exists()]
        if not pool_paths:
            self.stdout.write(self.style.WARNING("No demo face images found. Skipping profile image seeding."))
            return

        existing_qs = UserProfileImage.objects.filter(user__in=users).order_by("id")
        for image in existing_qs:
            if image.image:
                image.image.delete(save=False)
        existing_qs.delete()

        for index, user in enumerate(users):
            rng = random.Random(20260419 + user.id)
            shuffled_pool = pool_paths[:]
            rng.shuffle(shuffled_pool)

            photo_count = 3 if index < 4 else 2 if index < 10 else 1
            photo_count = min(photo_count, UserProfileImage.MAX_PHOTOS_PER_USER)
            for order in range(photo_count):
                src = shuffled_pool[order % len(shuffled_pool)]
                with src.open("rb") as fh:
                    UserProfileImage.objects.create(
                        user=user,
                        file_token=uuid4().hex,
                        image=File(fh, name=f"{src.stem}_{user.id}_{order + 1}{src.suffix.lower()}"),
                        display_order=order,
                    )

    def _create_personality_questions(self):
        payload = [
            (
                "[Demo] How do you handle emotional conflict?",
                "emotions",
                [
                    ("I overthink every detail", {"overthinking": 3, "emotional_depth": 2, "stability": 1}),
                    ("I talk it out early", {"communication": 3, "stability": 2, "overthinking": 1}),
                    ("I need space first", {"stability": 2, "communication": 1, "chaos": 1}),
                    ("I go with the flow", {"chaos": 2, "overthinking": 1, "communication": 1}),
                ],
            ),
            (
                "[Demo] Your ideal first date vibe?",
                "relationships",
                [
                    ("Deep conversation", {"emotional_depth": 3, "communication": 2}),
                    ("Playful and spontaneous", {"chaos": 3, "communication": 1}),
                    ("Quiet and cozy", {"stability": 3, "emotional_depth": 1}),
                    ("Adventure outdoors", {"chaos": 2, "stability": 1, "communication": 1}),
                ],
            ),
            (
                "[Demo] What scares you most in dating?",
                "personality",
                [
                    ("Mixed signals", {"overthinking": 3, "communication": 1}),
                    ("Losing independence", {"stability": 2, "chaos": 1}),
                    ("Emotional unavailability", {"emotional_depth": 3, "communication": 1}),
                    ("Boring routine", {"chaos": 3, "stability": 1}),
                ],
            ),
            (
                "[Demo] How often do you text your partner?",
                "relationships",
                [
                    ("A lot throughout the day", {"communication": 3, "overthinking": 1}),
                    ("A few meaningful check-ins", {"stability": 3, "communication": 2}),
                    ("Mostly at night", {"emotional_depth": 2, "communication": 1}),
                    ("Only when needed", {"stability": 1, "communication": 1, "chaos": 1}),
                ],
            ),
            (
                "[Demo] When plans change suddenly, you...",
                "personality",
                [
                    ("Get anxious quickly", {"overthinking": 3, "chaos": 1}),
                    ("Adapt smoothly", {"stability": 3, "communication": 1}),
                    ("Need reassurance", {"emotional_depth": 2, "overthinking": 2}),
                    ("Love the unpredictability", {"chaos": 3, "stability": 1}),
                ],
            ),
            (
                "[Demo] In relationships, you value...",
                "relationships",
                [
                    ("Emotional safety", {"stability": 3, "emotional_depth": 2}),
                    ("Intense chemistry", {"emotional_depth": 3, "chaos": 2}),
                    ("Clear communication", {"communication": 3, "stability": 2}),
                    ("Freedom and spontaneity", {"chaos": 3, "overthinking": 1}),
                ],
            ),
            (
                "[Demo] Your friends describe you as...",
                "personality",
                [
                    ("Thoughtful but intense", {"overthinking": 2, "emotional_depth": 2}),
                    ("Calm and balanced", {"stability": 3, "communication": 1}),
                    ("Warm and expressive", {"communication": 2, "emotional_depth": 2}),
                    ("Fun and chaotic", {"chaos": 3, "communication": 1}),
                ],
            ),
        ]

        questions = []
        for question_text, category, options in payload:
            question, _ = PersonalityQuestion.objects.update_or_create(
                question_text=question_text,
                defaults={"category": category, "is_active": True},
            )
            PersonalityOption.objects.filter(question=question).delete()
            option_objs = []
            for option_text, trait_mapping in options:
                option_objs.append(
                    PersonalityOption.objects.create(
                        question=question,
                        option_text=option_text,
                        trait_mapping=trait_mapping,
                    )
                )
            questions.append((question, option_objs))

        return questions

    def _assign_personality_responses(self, users, question_bank):
        for user in users:
            rng = random.Random(20260417 + user.id)
            for question, options in question_bank:
                selected = options[rng.randrange(len(options))]
                PersonalityResponse.objects.update_or_create(
                    user=user,
                    question=question,
                    defaults={"selected_option": selected},
                )
            calculate_traits(user)

    def _create_or_update_kundali(self, users):
        for idx, user in enumerate(users):
            payload = calculate_kundali(
                date_of_birth=user.date_of_birth,
                birth_time=user.birth_time,
                latitude=user.latitude,
                longitude=user.longitude,
                place_of_birth=user.birth_place,
            )
            KundaliProfile.objects.update_or_create(
                user=user,
                defaults={
                    "lagna": payload.get("lagna", ""),
                    "sun_sign": payload.get("sun_sign", ""),
                    "moon_sign": payload.get("moon_sign", "Aries"),
                    "ascendant_degree": payload.get("ascendant_degree"),
                    "nakshatra": payload.get("nakshatra", NAKSHATRAS[idx % len(NAKSHATRAS)]),
                    "nakshatra_pada": payload.get("nakshatra_pada", (idx % 4) + 1),
                    "varna": payload.get("varna", "Brahmin"),
                    "vashya": payload.get("vashya", "Manava"),
                    "gana": payload.get("gana", "Manushya"),
                    "yoni": payload.get("yoni", "Horse"),
                    "nadi": payload.get("nadi", "Adi"),
                    "bhakoot": payload.get("bhakoot", "Dharma"),
                    "timezone_name": payload.get("timezone_name", ""),
                    "chart_data": payload.get("chart_data", {}),
                    "is_accurate": bool(payload.get("is_accurate", user.birth_time is not None)),
                },
            )

    def _create_demo_games(self):
        game, _ = Game.objects.update_or_create(
            name="This or That",
            defaults={
                "description": "Quick rapid-fire compatibility game.",
                "type": Game.Type.CHOICE,
                "is_active": True,
            },
        )
        if game.questions.count() > 0:
            return

        questions = [
            ("Mountains or beaches?", ["Mountains", "Beaches"]),
            ("Morning person or night owl?", ["Morning person", "Night owl"]),
            ("Text all day or meaningful calls?", ["Text all day", "Meaningful calls"]),
            ("Spontaneous trips or planned vacations?", ["Spontaneous", "Planned"]),
            ("Cozy night in or party out?", ["Cozy night in", "Party out"]),
        ]
        for order, (q_text, opts) in enumerate(questions, start=1):
            question = GameQuestion.objects.create(
                game=game,
                question_text=q_text,
                order=order,
                is_active=True,
            )
            for opt_order, option_text in enumerate(opts, start=1):
                GameOption.objects.create(question=question, option_text=option_text, order=opt_order)

    def _create_swipes_and_matches(self, users):
        target_matches = min(24, max(10, len(users) * 2))
        created_pairs = set()

        for idx, user in enumerate(users):
            for offset in range(1, len(users)):
                candidate = users[(idx + offset) % len(users)]
                if user.id == candidate.id or not _is_preference_match(user, candidate):
                    continue

                pair_key = tuple(sorted((user.id, candidate.id)))
                if pair_key in created_pairs:
                    continue

                Swipe.objects.update_or_create(
                    user=user,
                    target_user=candidate,
                    defaults={"action": Swipe.Action.LIKE},
                )
                Swipe.objects.update_or_create(
                    user=candidate,
                    target_user=user,
                    defaults={"action": Swipe.Action.LIKE},
                )

                create_match_from_mutual_like(user, candidate)
                created_pairs.add(pair_key)
                if len(created_pairs) >= target_matches:
                    break
            if len(created_pairs) >= target_matches:
                break

        # Add a few PASS interactions to make swipe history realistic.
        pass_pairs_created = 0
        for idx, user in enumerate(users):
            if pass_pairs_created >= 20:
                break
            candidate = users[(idx + 5) % len(users)]
            if user.id == candidate.id:
                continue
            Swipe.objects.update_or_create(
                user=user,
                target_user=candidate,
                defaults={"action": Swipe.Action.PASS},
            )
            pass_pairs_created += 1

        return list(
            Match.objects.filter(
                status=Match.Status.MATCHED,
                user_a__email__iendswith=DEMO_DOMAIN,
                user_b__email__iendswith=DEMO_DOMAIN,
            )
            .select_related("user_a", "user_b")
            .order_by("-matched_at", "-id")
        )

    def _seed_chat_for_matches(self, matches):
        for match in matches[:18]:
            Message.objects.filter(match=match).delete()
            user_a = match.user_a
            user_b = match.user_b

            sequence = [
                (user_a, "Hey, your profile instantly felt warm ✨", Message.MessageType.TEXT, {}),
                (user_b, "That is sweet. Yours had such calm energy.", Message.MessageType.TEXT, {}),
                (user_a, "Coffee and a long walk this weekend?", Message.MessageType.TEXT, {}),
                (user_b, "Yes, but only if we compare comfort songs first 😄", Message.MessageType.TEXT, {}),
                (
                    user_a,
                    "Started This or That 🎮",
                    Message.MessageType.GAME_EVENT,
                    {"event_type": "game_started", "game_name": "This or That", "session_id": 0},
                ),
                (
                    user_a,
                    "🎮 Mountains or beaches?",
                    Message.MessageType.GAME_EVENT,
                    {
                        "event_type": "game_question",
                        "question_id": 1,
                        "question_text": "Mountains or beaches?",
                        "options": ["Mountains", "Beaches"],
                        "session_id": 0,
                    },
                ),
                (
                    user_a,
                    "Mountains",
                    Message.MessageType.GAME_EVENT,
                    {"event_type": "game_answer", "question_id": 1, "answer_text": "Mountains", "session_id": 0},
                ),
                (
                    user_b,
                    "Beaches",
                    Message.MessageType.GAME_EVENT,
                    {"event_type": "game_answer", "question_id": 1, "answer_text": "Beaches", "session_id": 0},
                ),
                (
                    user_a,
                    "Opposites 👀 interesting",
                    Message.MessageType.GAME_EVENT,
                    {"event_type": "game_result", "question_id": 1, "result_text": "Opposites 👀 interesting", "session_id": 0},
                ),
                (user_b, "We are going to have the best debates 😂", Message.MessageType.TEXT, {}),
                (user_a, "Deal. Saturday 6 PM?", Message.MessageType.TEXT, {}),
                (user_b, "Done. Sending you my playlist soon 🎶", Message.MessageType.TEXT, {}),
            ]

            for index, (sender, content, message_type, payload) in enumerate(sequence):
                Message.objects.create(
                    match=match,
                    sender=sender,
                    content=content,
                    message_type=message_type,
                    game_payload=payload,
                    status=Message.Status.READ if index < len(sequence) - 2 else Message.Status.DELIVERED,
                    is_read=index < len(sequence) - 2,
                )

    def _seed_game_sessions(self, matches):
        game = Game.objects.filter(name="This or That").first()
        if game is None:
            return
        first_question = game.questions.order_by("order", "id").first()
        if first_question is None:
            return
        first_option = first_question.choice_options.order_by("order", "id").first()
        second_option = first_question.choice_options.order_by("order", "id")[1:2].first()
        if first_option is None:
            return

        for match in matches[:8]:
            session, _ = GameSession.objects.update_or_create(
                match=match,
                game=game,
                status=GameSession.Status.ACTIVE,
                defaults={"started_by": match.user_a, "current_question_index": 1},
            )
            GameResponse.objects.update_or_create(
                session=session,
                user=match.user_a,
                question=first_question,
                defaults={"selected_option": first_option, "text_answer": ""},
            )
            GameResponse.objects.update_or_create(
                session=session,
                user=match.user_b,
                question=first_question,
                defaults={"selected_option": second_option or first_option, "text_answer": ""},
            )
