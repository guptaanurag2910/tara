import api from "./api";

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionalScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? Math.round(score) : null;
}

function normalizeRecommendation(item, index = 0) {
  const userId = asInt(item?.user_id, index + 1000);
  const user = item?.user || {};
  const photos = (Array.isArray(item?.photos) ? item.photos : Array.isArray(user?.photos) ? user.photos : [])
    .map((photo) => typeof photo === "string" ? photo : photo?.image_url || photo?.image || photo?.src)
    .filter(Boolean);
  const firstPhoto = user?.photo || item?.photo || item?.image || null;
  if (firstPhoto && !photos.includes(firstPhoto)) photos.unshift(firstPhoto);
  return {
    user_id: userId,
    name: item?.name || user?.name || "Match",
    age: item?.age || user?.age || null,
    compatibility_score: optionalScore(item?.compatibility_score ?? item?.compatibility),
    compatibility: optionalScore(item?.compatibility ?? item?.compatibility_score),
    kundali_score: optionalScore(item?.kundali_score),
    personality_score: optionalScore(item?.personality_score),
    insight: item?.insight || item?.insight_text || "",
    moon_sign: item?.moon_sign || user?.moon_sign || "",
    match_type: item?.match_type || "",
    bio: item?.bio || user?.bio || "",
    interests: Array.isArray(item?.interests) ? item.interests : Array.isArray(user?.interests) ? user.interests : [],
    shared_interests: Array.isArray(item?.shared_interests) ? item.shared_interests : [],
    personality_highlights: Array.isArray(item?.personality_highlights) ? item.personality_highlights : [],
    photos,
    user: {
      id: asInt(user?.id, userId),
      name: user?.name || item?.name || "Match",
      age: user?.age || item?.age || null,
      photo: photos[0] || null,
      gender: user?.gender || item?.gender || null,
      preference: user?.preference || null,
      sun_sign: user?.sun_sign || "",
      moon_sign: user?.moon_sign || "",
      nakshatra: user?.nakshatra || "",
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

export async function prepareRecommendations() {
  const { data } = await api.post("recommendations/prepare/");
  return data;
}

export async function fetchRecommendationFeed() {
  const { data } = await api.get("recommendations/");
  return {
    results: asList(data).map(normalizeRecommendation),
    generationStatus: data?.generation_status || "unknown",
    readyCount: asInt(data?.ready_count, 0),
  };
}

export async function fetchRecommendations() {
  const feed = await fetchRecommendationFeed();
  return feed.results;
}

export async function fetchDailyMatches() {
  const { data } = await api.get("daily-recommendations/");
  return asList(data).map((item, index) => {
    const recommendation = normalizeRecommendation(item, index);
    return {
      ...recommendation,
      name: recommendation.user.name,
      age: recommendation.user.age,
      photo: recommendation.user.photo,
      insight: item?.insight || item?.insight_text || null,
    };
  });
}

export async function swipeLike(targetUserId, note = "") {
  const { data } = await api.post("swipe/like/", {
    target_user_id: targetUserId,
    ...(note ? { note } : {}),
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

export async function fetchGameNightSchedule() {
  return (await api.get("matching/game-night/schedule/")).data;
}

export async function fetchGameNightStatus() {
  return (await api.get("matching/game-night/queue/")).data;
}

export async function joinGameNight() {
  return (await api.post("matching/game-night/queue/")).data;
}

export async function leaveGameNightQueue() {
  return (await api.delete("matching/game-night/queue/")).data;
}

export async function sendGameNightMessage(roomId, content) {
  return (await api.post(`matching/game-night/rooms/${roomId}/messages/`, { content })).data;
}

export async function playGameNightMove(roomId, content) {
  return (await api.post(`matching/game-night/rooms/${roomId}/action/`, { content })).data;
}

export async function voteGameNight(roomId, choice) {
  return (await api.post(`matching/game-night/rooms/${roomId}/vote/`, { choice })).data;
}

export async function reportGameNight(roomId, reason) {
  return (await api.post(`matching/game-night/rooms/${roomId}/report/`, { reason })).data;
}

export async function blockUser(userId) {
  return (await api.post("matching/safety/blocks/", { user_id: Number(userId) })).data;
}

export async function reportSafetyIssue({ category, targetType, targetId, details = "" }) {
  return (await api.post("matching/safety/reports/", {
    category,
    target_type: targetType,
    target_id: String(targetId),
    details,
  })).data;
}

export async function setMatchConnection(matchId, action) {
  return (await api.post(`matching/safety/matches/${matchId}/connection/`, { action })).data;
}

export async function fetchDatePlan(matchId) {
  return (await api.get(`matching/safety/matches/${matchId}/date-plan/`)).data;
}

export async function saveDatePlan(matchId, payload) {
  return (await api.put(`matching/safety/matches/${matchId}/date-plan/`, payload)).data;
}

export async function submitDateCheckIn(matchId, payload) {
  return (await api.post(`matching/safety/matches/${matchId}/date-check-in/`, payload)).data;
}
