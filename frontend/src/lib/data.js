import profile1 from "../assets/profile-1.png";
import profile2 from "../assets/profile-2.png";
import profile3 from "../assets/profile-3.png";
import profile4 from "../assets/profile-4.png";

export const profiles = [
  {
    id: "1",
    name: "Aanya",
    age: 26,
    image: profile1,
    compatibility: 94,
    kundaliScore: 32,
    personalityScore: 88,
    insight: "Your moons align — emotional rhythms in deep harmony.",
    sign: "Scorpio",
    moonSign: "Pisces",
    nakshatra: "Revati",
    bio: "Tea drinker, late-night thinker. Looking for someone who reads the sky.",
    traits: ["Intuitive", "Romantic", "Curious", "Deep"],
  },
  {
    id: "2",
    name: "Arjun",
    age: 28,
    image: profile2,
    compatibility: 87,
    kundaliScore: 28,
    personalityScore: 91,
    insight: "Venus speaks softly between you — slow love, real love.",
    sign: "Cancer",
    moonSign: "Taurus",
    nakshatra: "Rohini",
    bio: "Architect, plant dad, occasional poet.",
    traits: ["Grounded", "Creative", "Loyal", "Quiet"],
  },
  {
    id: "3",
    name: "Meera",
    age: 24,
    image: profile3,
    compatibility: 82,
    kundaliScore: 26,
    personalityScore: 84,
    insight: "Sun-Moon dance — playful sparks meet steady warmth.",
    sign: "Leo",
    moonSign: "Cancer",
    nakshatra: "Pushya",
    bio: "Dancer. Believer in serendipity. 3am philosopher.",
    traits: ["Warm", "Bold", "Playful", "Caring"],
  },
  {
    id: "4",
    name: "Kabir",
    age: 30,
    image: profile4,
    compatibility: 78,
    kundaliScore: 24,
    personalityScore: 79,
    insight: "Mercury aligns — conversations that lose track of time.",
    sign: "Gemini",
    moonSign: "Aquarius",
    nakshatra: "Shatabhisha",
    bio: "Writer, runner, espresso enthusiast.",
    traits: ["Witty", "Honest", "Independent", "Open"],
  },
];

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function profileToRecommendation(profile, index = 0) {
  const userId = asInt(profile.id, index + 1) + 1000;
  return {
    user_id: userId,
    name: profile.name,
    age: profile.age,
    compatibility_score: profile.compatibility,
    compatibility: profile.compatibility,
    kundali_score: profile.kundaliScore,
    personality_score: profile.personalityScore,
    insight: profile.insight,
    match_type: profile.compatibility >= 85 ? "High Compatibility 💞" : "Balanced Match ⚖️",
    moon_sign: profile.moonSign,
    user: {
      id: userId,
      name: profile.name,
      age: profile.age,
      photo: profile.image,
      gender: null,
      preference: null,
    },
  };
}

export function profileToMatch(profile, index = 0) {
  const matchId = asInt(profile.id, index + 1);
  const rec = profileToRecommendation(profile, index);
  return {
    match_id: matchId,
    user_id: rec.user_id,
    user: rec.user,
    compatibility_score: rec.compatibility_score,
    kundali_score: rec.kundali_score,
    personality_score: rec.personality_score,
    insight: rec.insight,
    match_type: rec.match_type,
  };
}

export function profileToMatchDetail(profile, index = 0) {
  const match = profileToMatch(profile, index);
  return {
    ...match,
    breakdown: {
      varna: 1,
      vashya: 2,
      tara: 2,
      yoni: 3,
      graha_maitri: 4,
      gana: 5,
      bhakoot: 6,
      nadi: 7,
    },
  };
}

export function getMockRecommendations() {
  return profiles.map((profile, index) => profileToRecommendation(profile, index));
}

export function getMockMatches() {
  return profiles.map((profile, index) => profileToMatch(profile, index));
}

export function getMockMatchDetail(matchId) {
  const normalized = String(matchId ?? "").trim();
  const byId = profiles.find((profile) => profile.id === normalized);
  if (byId) {
    return profileToMatchDetail(byId, profiles.indexOf(byId));
  }
  const byIndex = profiles[(asInt(normalized, 1) - 1 + profiles.length) % profiles.length];
  return profileToMatchDetail(byIndex, profiles.indexOf(byIndex));
}
