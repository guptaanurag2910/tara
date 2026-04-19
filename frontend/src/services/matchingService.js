import api from "./api";

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRecommendation(item, index = 0) {
  const userId = asInt(item?.user_id, index + 1000);
  const user = item?.user || {};
  return {
    user_id: userId,
    name: item?.name || user?.name || "Match",
    age: item?.age || user?.age || null,
    compatibility_score: asInt(item?.compatibility_score, asInt(item?.compatibility, 0)),
    compatibility: asInt(item?.compatibility, asInt(item?.compatibility_score, 0)),
    kundali_score: asInt(item?.kundali_score, 0),
    personality_score: asInt(item?.personality_score, 0),
    insight: item?.insight || item?.insight_text || "Your energy signatures feel aligned.",
    moon_sign: item?.moon_sign || user?.moon_sign || "",
    match_type: item?.match_type || "",
    user: {
      id: asInt(user?.id, userId),
      name: user?.name || item?.name || "Match",
      age: user?.age || item?.age || null,
      photo: user?.photo || item?.photo || item?.image || null,
      gender: user?.gender || null,
      preference: user?.preference || null,
    },
  };
}

function normalizeMatch(item, index = 0) {
  const recommendation = normalizeRecommendation(item, index);
  const matchId = asInt(item?.match_id, asInt(item?.id, index + 1));
  return {
    match_id: matchId,
    user_id: recommendation.user_id,
    user: recommendation.user,
    compatibility_score: asInt(item?.compatibility_score, recommendation.compatibility_score),
    kundali_score: asInt(item?.kundali_score, recommendation.kundali_score),
    personality_score: asInt(item?.personality_score, recommendation.personality_score),
    insight: item?.insight || item?.insight_text || recommendation.insight,
    match_type: item?.match_type || "",
    status: item?.status || "matched",
  };
}

function normalizeMatchDetail(item, matchId) {
  const match = normalizeMatch(item, asInt(matchId, 1) - 1);
  return {
    ...match,
    breakdown: item?.breakdown || {},
  };
}

function asList(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.results)) {
    return data.results;
  }
  return [];
}

export async function fetchDiscoverProfiles() {
  return fetchRecommendations();
}

export async function fetchRecommendations() {
  const { data } = await api.get("recommendations/");
  return asList(data).map(normalizeRecommendation);
}

export async function fetchDailyMatches() {
  const { data } = await api.get("recommendations/");
  return asList(data).map((item, index) => {
    const recommendation = normalizeRecommendation(item, index);
    return {
      ...recommendation,
      name: recommendation.user.name,
      age: recommendation.user.age,
      photo: recommendation.user.photo,
    };
  });
}

export async function swipeLike(targetUserId) {
  const { data } = await api.post("swipe/like/", {
    target_user_id: targetUserId,
  });
  return data;
}

export async function swipePass(targetUserId) {
  const { data } = await api.post("swipe/pass/", {
    target_user_id: targetUserId,
  });
  return data;
}

export async function fetchMatches() {
  const { data } = await api.get("matches/");
  return asList(data).map(normalizeMatch);
}

export async function fetchMatchDetail(matchId) {
  const { data } = await api.get(`matches/${matchId}/`);
  return normalizeMatchDetail(data || {}, matchId);
}

export async function fetchMatchIcebreakers(matchId) {
  try {
    const { data } = await api.get(`matches/${matchId}/icebreakers/`);
    if (Array.isArray(data)) {
      return data;
    }
    if (Array.isArray(data?.suggestions)) {
      return data.suggestions;
    }
    return [];
  } catch {
    return [];
  }
}
