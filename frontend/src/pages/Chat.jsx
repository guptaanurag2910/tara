import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Flag, Gamepad2, Search, Send, Shuffle, X } from "lucide-react";

import { ChatThreadSkeleton, ConversationListSkeleton } from "../components/AppSkeletons";
import { useParams } from "../lib/router-compat";
import GameModal from "../components/chat/GameModal";
import GameResultCard from "../components/chat/GameResultCard";
import Icebreaker from "../components/Icebreaker";
import MessageBubble from "../components/MessageBubble";
import { useAuth } from "../hooks/useAuth";
import { useChatSocket } from "../hooks/useChatSocket";
import { blockUser, fetchDatePlan, fetchMatchDetail, fetchMatchIcebreakers, fetchMatches, reportSafetyIssue, saveDatePlan, setMatchConnection, submitDateCheckIn } from "../services/matchingService";
import { fetchMatchMessages, sendMatchMessage, toggleMessageReaction } from "../services/chatService";
import { submitGameAnswer, uploadPhotoScavengerSubmission } from "../services/gameService";

const GAME_ACTIONS = [
  { id: "this_or_that", label: "This or That", emoji: "🎲" },
  { id: "guess_their_pick", label: "Guess Their Pick", emoji: "🔮" },
  { id: "build_a_story", label: "Build a Story", emoji: "📖" },
  { id: "two_truths_and_a_lie", label: "Two Truths & a Lie", emoji: "🕵️" },
  { id: "choose_your_adventure", label: "Choose Your Adventure", emoji: "🗺️" },
  { id: "rank_these", label: "Rank These", emoji: "📊" },
  { id: "would_you_rather", label: "Would You Rather?", emoji: "🤔" },
  { id: "caption_this", label: "Caption This", emoji: "🎨" },
  { id: "tic_tac_toe", label: "Tic Tac Toe", emoji: "⭕" },
  { id: "dots_and_boxes", label: "Dots and Boxes", emoji: "🔲" },
  { id: "pictionary", label: "Pictionary", emoji: "✏️" },
  { id: "word_search", label: "Word Search", emoji: "🔎" },
  { id: "unscramble", label: "Unscramble", emoji: "🔤" },
  { id: "emoji_decode", label: "Emoji Decode", emoji: "🧩" },
  { id: "cipher_breaker", label: "Cipher Breaker", emoji: "🔐" },
  { id: "photo_scavenger_hunt", label: "Photo Scavenger Hunt", emoji: "📸" },
  { id: "word_association", label: "Word Association", emoji: "💭" },
  { id: "secret_song_pick", label: "Secret Song Pick", emoji: "🎵" },
  { id: "collaborative_playlist", label: "Collaborative Playlist", emoji: "🎧" },
  { id: "mystery_playlist_mood", label: "Mystery Playlist Mood", emoji: "🎶" },
  { id: "snakes_ladders", label: "Snakes, Ladders & Secrets", emoji: "🐍" },
  { id: "bingo", label: "Bingo: Are We in Sync?", emoji: "🎯" },
  { id: "spot_the_difference", label: "Spot the Difference", emoji: "🔍" },
  { id: "memory_match", label: "Memory Match", emoji: "🃏" },
];

function conversationErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status === 404) {
    return "This conversation isn't available yet. You can only chat with confirmed matches.";
  }
  if (status >= 500) {
    return "Chat is having a moment right now. Please try again shortly.";
  }
  return apiError?.message || "Could not load this chat.";
}

function messageSendErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 404) {
    return "This conversation isn't available yet. You can only message confirmed matches.";
  }
  if (status >= 500) {
    return "Could not send your message right now. Please try again.";
  }
  return apiError?.message || "Could not send your message.";
}

function normalizeStatus(rawStatus, isReadFallback = false) {
  const value = String(rawStatus || "").trim().toLowerCase();
  if (value === "sent" || value === "delivered" || value === "read") {
    return value;
  }
  return isReadFallback ? "read" : "delivered";
}

function normalizeMessage(raw) {
  const isRead = Boolean(raw.is_read);
  return {
    id: raw.id ?? null,
    client_message_id: raw.client_message_id ?? null,
    sender_id: raw.sender_id,
    content: raw.content,
    message_type: raw.message_type || "text",
    game_payload: raw.game_payload || {},
    reply_to: raw.reply_to || null,
    reactions: raw.reactions || {},
    timestamp: raw.timestamp || raw.created_at,
    status: normalizeStatus(raw.status, isRead),
    is_read: isRead,
  };
}

function messageIdentity(message) {
  if (message?.game_payload?.event_id) {
    return `event:${message.game_payload.event_id}`;
  }
  if (message.id) {
    return `id:${message.id}`;
  }
  if (message.client_message_id) {
    return `cid:${message.client_message_id}`;
  }
  return `${message.sender_id || "na"}:${message.timestamp || "na"}:${message.content || ""}`;
}

function mergeMessage(list, incoming) {
  const nextIdentity = messageIdentity(incoming);
  const existingIndex = list.findIndex((item) => messageIdentity(item) === nextIdentity);
  if (existingIndex >= 0) {
    const next = [...list];
    next[existingIndex] = {
      ...next[existingIndex],
      ...incoming,
    };
    return next;
  }

  if (incoming.client_message_id) {
    const optimisticIndex = list.findIndex(
      (item) => item.client_message_id === incoming.client_message_id && !item.id,
    );
    if (optimisticIndex >= 0) {
      const next = [...list];
      next[optimisticIndex] = {
        ...next[optimisticIndex],
        ...incoming,
      };
      return next;
    }
  }

  return [...list, incoming];
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages.map(normalizeMessage).reduce((list, message) => mergeMessage(list, message), [])
    : [];
}

function applyReadReceipt(list, payload) {
  const messageIds = Array.isArray(payload?.message_ids)
    ? payload.message_ids.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  if (!messageIds.length) {
    return list;
  }
  const idSet = new Set(messageIds);
  return list.map((message) => {
    if (!idSet.has(Number(message.id))) {
      return message;
    }
    return {
      ...message,
      status: "read",
      is_read: true,
    };
  });
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toLocalDateTimeValue(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 2 * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function parseGameEventType(message) {
  return String(message?.game_payload?.event_type || "").trim().toLowerCase();
}

function hasDetailedGameResult(message) {
  return (
    String(message?.message_type || "") === "game_event" &&
    parseGameEventType(message) === "game_result" &&
    Array.isArray(message?.game_payload?.result?.questions)
  );
}

function normalizeGameResultForViewer(result, viewerIsUserA = true) {
  if (viewerIsUserA || !result || !Array.isArray(result.questions)) {
    return result;
  }

  return {
    ...result,
    user_a_ending: result.user_b_ending,
    user_b_ending: result.user_a_ending,
    mood_a: result.mood_b,
    mood_b: result.mood_a,
    ...(result.user_a && result.user_b ? { user_a: result.user_b, user_b: result.user_a } : {}),
    ...(result.user_a_mark && result.user_b_mark ? { user_a_mark: result.user_b_mark, user_b_mark: result.user_a_mark } : {}),
    ...(result.user_a_score !== undefined && result.user_b_score !== undefined ? { user_a_score: result.user_b_score, user_b_score: result.user_a_score } : {}),
    questions: result.questions.map((item) => ({
      ...item,
      user_a: item?.user_b ?? null,
      user_b: item?.user_a ?? null,
      user_a_guess: item?.user_b_guess ?? null,
      user_b_guess: item?.user_a_guess ?? null,
      user_a_correct: item?.user_b_correct ?? false,
      user_b_correct: item?.user_a_correct ?? false,
    })),
    user_a_correct: result.user_b_correct,
    user_b_correct: result.user_a_correct,
  };
}

function buildQuestionAnswersMap(messageList) {
  const map = {};
  for (const message of messageList) {
    if (String(message?.message_type || "") !== "game_event") {
      continue;
    }
    if (parseGameEventType(message) !== "game_answer") {
      continue;
    }

    const questionId = Number(message?.game_payload?.question_id);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      continue;
    }

    const answerText = String(message?.content || message?.game_payload?.answer_text || "").trim();
    if (!answerText) {
      continue;
    }

    if (!Array.isArray(map[questionId])) {
      map[questionId] = [];
    }
    const existingIndex = map[questionId].findIndex(
      (item) => Number(item?.sender_id) === Number(message.sender_id),
    );
    const nextAnswer = {
      sender_id: message.sender_id,
      content: answerText,
      timestamp: message.timestamp,
    };
    if (existingIndex >= 0) {
      map[questionId][existingIndex] = nextAnswer;
    } else {
      map[questionId].push(nextAnswer);
    }
  }
  return map;
}

function buildGameRoundResultsMap(messageList) {
  const map = {};
  for (const message of messageList) {
    if (parseGameEventType(message) !== "game_round_result") {
      continue;
    }
    const sessionId = Number(message?.game_payload?.session_id);
    const questionId = Number(message?.game_payload?.question_id);
    if (Number.isInteger(sessionId) && Number.isInteger(questionId)) {
      map[`${sessionId}:${questionId}`] = message.game_payload;
    }
  }
  return map;
}

function formatTimeLabel(value) {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - date.getTime()) / (60 * 60 * 1000));
      if (diffHours <= 0) {
        return "now";
      }
      if (diffHours < 24) {
        return `${diffHours}h`;
      }
      return `${Math.floor(diffHours / 24)}d`;
    }
  }

  return "";
}

function initials(name) {
  if (!name) {
    return "T";
  }
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "T";
}

function Avatar({ name, photo }) {
  return (
    <div className="chat-avatar">
      {photo ? (
        <img alt="" className="h-full w-full object-cover" src={photo} />
      ) : (
        <div className="chat-avatar-fallback">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

function ConversationsList({ loading, error, conversations, totalCount, query, setQuery }) {
  return (
    <main className="tara-chat-list tara-container">
      <header className="chat-list-header">
        <div className="chat-list-brand">tara<span>.</span></div>
        <p className="chat-list-eyebrow">YOUR MESSAGES</p>
        <h1>Conversations</h1>
        <p className="chat-list-subtitle">Keep the good conversations going.</p>
      </header>

      <label className="chat-search">
        <Search aria-hidden="true" size={18} />
        <span className="sr-only">Search conversations</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          type="search"
          value={query}
        />
      </label>

      {loading ? <ConversationListSkeleton /> : null}
      {!loading && error ? <div className="chat-list-state" role="alert"><h2>Couldn't load conversations</h2><p>{error}</p></div> : null}

      {!loading && !error && totalCount === 0 ? (
        <section className="chat-list-state">
          <span className="chat-list-state-icon"><Send size={27} /></span>
          <h2>No conversations yet</h2>
          <p>When you match with someone, start a conversation here.</p>
          <Link to="/matches">View matches <ArrowRight size={16} /></Link>
        </section>
      ) : null}

      {!loading && !error && totalCount > 0 && conversations.length === 0 ? (
        <section className="chat-list-state">
          <h2>No conversations found</h2>
          <p>Try a different name or message.</p>
          <button onClick={() => setQuery("")} type="button">Clear search</button>
        </section>
      ) : null}

      {!loading && !error && conversations.length > 0 ? (
        <section className="chat-inbox" aria-label="Conversations list">
          <h2>Messages <span>{totalCount}</span></h2>
          <div className="chat-inbox-rows">
          {conversations.map((item) => (
            <Link
              className="chat-inbox-row"
              key={item.match_id}
              to={`/chat/${item.match_id}`}
            >
              <Avatar name={item.user?.name} photo={item.user?.photo} />
              <span className="chat-inbox-copy"><strong>{item.user?.name || "Match"}</strong><span>{item.preview}</span></span>
              {item.timeLabel ? <span className="chat-inbox-time">{item.timeLabel}</span> : null}
            </Link>
          ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function ChatScreen() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const [matchInfo, setMatchInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState(() => new Set());
  const [draft, setDraft] = useState("");
  const [icebreakers, setIcebreakers] = useState([]);
  const [icebreakersLoading, setIcebreakersLoading] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState("this_or_that");
  const [startingGame, setStartingGame] = useState("");
  const [respondingInviteId, setRespondingInviteId] = useState(null);
  const [waitingGameSessionId, setWaitingGameSessionId] = useState(null);
  const [yourTurnGameSessionId, setYourTurnGameSessionId] = useState(null);
  const [answeredGameQuestionIds, setAnsweredGameQuestionIds] = useState([]);
  const [gameStatementSets, setGameStatementSets] = useState(null);
  const [guessedGameQuestionIds, setGuessedGameQuestionIds] = useState([]);
  const [ticTacToeState, setTicTacToeState] = useState(null);
  const [dotsBoxesState, setDotsBoxesState] = useState(null);
  const [pictionaryState, setPictionaryState] = useState(null);
  const [wordSearchState, setWordSearchState] = useState(null);
  const [unscrambleState, setUnscrambleState] = useState(null);
  const [unscrambleFeedback, setUnscrambleFeedback] = useState(null);
  const [wordAssociationState, setWordAssociationState] = useState(null);
  const [collaborativePlaylistState, setCollaborativePlaylistState] = useState(null);
  const [mysteryPlaylistMoodState, setMysteryPlaylistMoodState] = useState(null);
  const [snakesLaddersState, setSnakesLaddersState] = useState(null);
  const [bingoState, setBingoState] = useState(null);
  const [spotDifferenceState, setSpotDifferenceState] = useState(null);
  const [memoryMatchState, setMemoryMatchState] = useState(null);
  const [pendingGameStart, setPendingGameStart] = useState("");
  const [pendingGameInviteResponse, setPendingGameInviteResponse] = useState(null);
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [answeringByQuestion, setAnsweringByQuestion] = useState({});
  const [error, setError] = useState("");
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [showGames, setShowGames] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const dismissedGameSessionIdsRef = useRef(new Set());
  const [reportTarget, setReportTarget] = useState({ type: "profile", id: null });
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyNotice, setSafetyNotice] = useState("");
  const [datePlan, setDatePlan] = useState(null);
  const [datePlanOpen, setDatePlanOpen] = useState(false);
  const [datePlanBusy, setDatePlanBusy] = useState(false);
  const [checkInDetails, setCheckInDetails] = useState("");
  const [dateForm, setDateForm] = useState({ activity: "", scheduled_at: toLocalDateTimeValue(), public_venue: "", share_with_trusted_contact: false, trusted_contact_name: "", trusted_contact_phone: "" });
  const endRef = useRef(null);
  const draftInputRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const pendingMessageRef = useRef(null);

  function openGameSession(sessionId) {
    const parsedSessionId = Number(sessionId);
    if (parsedSessionId && dismissedGameSessionIdsRef.current.has(parsedSessionId)) return;
    setGameOpen(true);
  }

  function closeGameSession() {
    const sessionId = Number(activeGame?.session_id);
    if (sessionId) dismissedGameSessionIdsRef.current.add(sessionId);
    setGameOpen(false);
  }

  useEffect(() => {
    if (!matchId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`tara_hidden_messages_${matchId}`) || "[]");
      setHiddenMessageIds(new Set(Array.isArray(saved) ? saved.map(String) : []));
    } catch { setHiddenMessageIds(new Set()); }
    fetchDatePlan(matchId).then((result) => {
      setDatePlan(result?.date_plan || null);
      if (result?.date_plan) setDateForm({ activity: result.date_plan.activity, scheduled_at: toLocalDateTimeValue(result.date_plan.scheduled_at), public_venue: result.date_plan.public_venue, share_with_trusted_contact: Boolean(result.date_plan.share_with_trusted_contact), trusted_contact_name: result.date_plan.trusted_contact_name || "", trusted_contact_phone: result.date_plan.trusted_contact_phone || "" });
    }).catch(() => {});
  }, [matchId]);

  function toggleHiddenMessage(message, hide) {
    const identity = String(message?.id || messageIdentity(message));
    setHiddenMessageIds((current) => {
      const next = new Set(current);
      if (hide) next.add(identity); else next.delete(identity);
      localStorage.setItem(`tara_hidden_messages_${matchId}`, JSON.stringify([...next]));
      return next;
    });
  }

  async function submitSafetyReport() {
    if (!matchInfo?.user?.id || safetyBusy) return;
    setSafetyBusy(true);
    setSafetyNotice("");
    try {
      await reportSafetyIssue({ category: reportCategory, targetType: reportTarget.type, targetId: reportTarget.id || matchInfo.user.id, details: reportDetails.trim() });
      setSafetyOpen(false);
      setReportDetails("");
      setSafetyNotice("Thanks. Your report was received by our safety team.");
    } catch (apiError) {
      setSafetyNotice(apiError?.message || "Could not send your report. Please try again.");
    } finally {
      setSafetyBusy(false);
    }
  }

  async function blockMatch() {
    if (!matchInfo?.user?.id || safetyBusy) return;
    if (!window.confirm(`Block ${matchInfo.user.name || "this person"}? They will no longer be able to message, invite you to games, or appear in your recommendations.`)) return;
    setSafetyBusy(true);
    setSafetyNotice("");
    try {
      await blockUser(matchInfo.user.id);
      window.location.assign("/chat");
    } catch (apiError) {
      setSafetyNotice(apiError?.message || "Could not block this person. Please try again.");
      setSafetyBusy(false);
    }
  }

  async function changeConnection(action) {
    if (safetyBusy) return;
    const verb = action === "pause" ? "Pause" : "Unmatch";
    if (!window.confirm(`${verb} this connection? ${action === "pause" ? "Neither person can chat or invite games until the connection is resumed." : "You will no longer be able to chat or play games together."}`)) return;
    setSafetyBusy(true);
    try {
      await setMatchConnection(matchId, action);
      window.location.assign("/matches");
    } catch (apiError) {
      setSafetyNotice(apiError?.message || `Could not ${action} this connection.`);
      setSafetyBusy(false);
    }
  }

  async function saveSafeDatePlan(event) {
    event.preventDefault();
    setDatePlanBusy(true); setSafetyNotice("");
    try {
      const saved = await saveDatePlan(matchId, { ...dateForm, scheduled_at: new Date(dateForm.scheduled_at).toISOString(), is_public_venue: true });
      setDatePlan(saved); setSafetyNotice("Your public-place plan is saved. It is visible to both of you.");
    } catch (apiError) { setSafetyNotice(apiError?.message || "Could not save the date plan."); }
    finally { setDatePlanBusy(false); }
  }

  async function dateCheckIn(value) {
    setDatePlanBusy(true); setSafetyNotice("");
    try {
      const result = await submitDateCheckIn(matchId, { status: value, details: value === "concern" ? checkInDetails.trim() : "" });
      setSafetyNotice(result.detail); setCheckInDetails("");
    } catch (apiError) { setSafetyNotice(apiError?.message || "Could not save your check-in."); }
    finally { setDatePlanBusy(false); }
  }

  const hasMatch = Boolean(matchId);
  const socket = useChatSocket({
    matchId,
    enabled: hasMatch,
    onMessage: (payload) => {
      if (payload?.event === "read_receipt") {
        setMessages((prev) => applyReadReceipt(prev, payload));
        return;
      }
      if (payload?.event === "message_reactions") {
        const update = payload.data || {};
        setMessages((prev) => prev.map((message) => Number(message.id) === Number(update.message_id)
          ? { ...message, reactions: update.reactions || {} } : message));
        return;
      }
      if (payload?.error) {
        setError(payload.error);
        return;
      }
      const incoming = normalizeMessage(payload);
      if (!incoming.content || incoming.sender_id == null) {
        return;
      }
      setMessages((prev) => mergeMessage(prev, incoming));
    },
  });

  const insightText = useMemo(() => {
    if (!matchInfo?.insight) {
      return "Open heart, clear communication.";
    }
    const sentence = matchInfo.insight.split(/[.!?]/)[0]?.trim();
    return sentence || matchInfo.insight;
  }, [matchInfo]);

  const hasUserSentMessage = useMemo(
    () =>
      messages.some(
        (message) =>
          Number(message.sender_id) === Number(user?.id) &&
          String(message.message_type || "text") === "text" &&
          message?.game_payload?.source !== "game_night",
      ),
    [messages, user?.id],
  );

  const shouldShowIcebreakers = Boolean(
    hasMatch && !loading && !firstMessageSent && !hasUserSentMessage,
  );
  const recommendedGames = ["this_or_that", "build_a_story", "pictionary"];
  const visibleGames = showAllGames
    ? GAME_ACTIONS
    : recommendedGames.map((id) => GAME_ACTIONS.find((game) => game.id === id));

  const questionAnswersById = useMemo(() => buildQuestionAnswersMap(messages), [messages]);
  const gameRoundResults = useMemo(() => buildGameRoundResultsMap(messages), [messages]);
  const partnerLabel = matchInfo?.user?.name || "Partner";
  const viewerIsUserA = matchInfo?.viewer_is_user_a !== false;

  const filteredConversations = useMemo(() => {
    const term = conversationQuery.trim().toLowerCase();
    if (!term) {
      return conversations;
    }
    return conversations.filter((item) => {
      const haystack = `${item.user?.name || ""} ${item.preview || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [conversationQuery, conversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (hasMatch) {
      return;
    }

    let active = true;
    async function loadConversations() {
      setConversationLoading(true);
      setConversationError("");
      try {
        const matchList = await fetchMatches();
        const safeList = Array.isArray(matchList) ? matchList : [];

        const enrichedTop = await Promise.all(
          safeList.slice(0, 12).map(async (match) => {
            try {
              const history = await fetchMatchMessages(match.match_id);
              const safeHistory = Array.isArray(history) ? history : [];
              const last = safeHistory[safeHistory.length - 1];

              return {
                ...match,
                preview: String(last?.content || "").trim() || "Start a conversation",
                timeLabel: formatTimeLabel(last?.timestamp || last?.created_at),
              };
            } catch {
              return {
                ...match,
                preview: "Start a conversation",
                timeLabel: "",
              };
            }
          }),
        );

        const tail = safeList.slice(12).map((match) => ({
          ...match,
          preview: "Start a conversation",
          timeLabel: "",
        }));

        if (active) {
          setConversations([...enrichedTop, ...tail]);
        }
      } catch (apiError) {
        if (active) {
          setConversationError(conversationErrorMessage(apiError));
          setConversations([]);
        }
      } finally {
        if (active) {
          setConversationLoading(false);
        }
      }
    }

    loadConversations();
    return () => {
      active = false;
    };
  }, [hasMatch]);

  useEffect(() => {
    const inviteEvent = socket.events?.game_invite;
    if (inviteEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(inviteEvent.message)));
      setStartingGame("");
      setPendingGameStart("");
      setError("");
    }
  }, [socket.events?.game_invite]);

  useEffect(() => {
    const inviteEvent = socket.events?.game_invite_updated;
    if (!inviteEvent) {
      return;
    }
    if (inviteEvent.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(inviteEvent.message)));
    }
    setPendingGameInviteResponse(null);
    setRespondingInviteId(null);
  }, [socket.events?.game_invite_updated]);

  useEffect(() => {
    const startedEvent = socket.events?.game_started;
    if (!startedEvent?.session_id) {
      return;
    }
    if (startedEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(startedEvent.message)));
    }
    setPendingGameInviteResponse(null);
    setRespondingInviteId(null);
    setActiveGame(startedEvent);
    setSelectedGame(startedEvent.category || "this_or_that");
    setStartingGame("");
    setWaitingGameSessionId(null);
    setYourTurnGameSessionId(null);
    if (startedEvent.tic_tac_toe_state) {
      const turnUserId = Number(startedEvent.tic_tac_toe_state.turn_user_id);
      setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(startedEvent.session_id) : null);
      setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(startedEvent.session_id) : null);
    } else {
      setTicTacToeState(null);
    }
    setAnsweredGameQuestionIds([]);
    setGameStatementSets(null);
    setGuessedGameQuestionIds([]);
    setTicTacToeState(startedEvent.tic_tac_toe_state || null);
    setDotsBoxesState(startedEvent.dots_boxes_state || null);
    if (startedEvent.dots_boxes_state) {
      const turnUserId = Number(startedEvent.dots_boxes_state.turn_user_id);
      setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(startedEvent.session_id) : null);
      setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(startedEvent.session_id) : null);
    }
    setPictionaryState(null);
    setWordSearchState(null);
    setUnscrambleState(null);
    setUnscrambleFeedback(null);
    setWordAssociationState(startedEvent.word_association_state || null);
    setCollaborativePlaylistState(startedEvent.collaborative_playlist_state || null);
    setMysteryPlaylistMoodState(startedEvent.mystery_playlist_mood_state || null);
    setSnakesLaddersState(startedEvent.snakes_ladders_state || null);
    setBingoState(startedEvent.bingo_state || null);
    setSpotDifferenceState(startedEvent.spot_difference_state || null);
    setMemoryMatchState(startedEvent.memory_match_state || null);
    dismissedGameSessionIdsRef.current.delete(Number(startedEvent.session_id));
    setGameOpen(true);
    if (startedEvent.category === "pictionary") socket.requestPictionaryState(startedEvent.session_id);
    if (startedEvent.category === "word_search") socket.requestWordSearchState(startedEvent.session_id);
    if (startedEvent.category === "unscramble") socket.requestUnscrambleState(startedEvent.session_id);
    if (startedEvent.category === "word_association") socket.requestWordAssociationState(startedEvent.session_id);
    if (startedEvent.category === "collaborative_playlist") socket.requestCollaborativePlaylistState(startedEvent.session_id);
    if (startedEvent.category === "mystery_playlist_mood") socket.requestMysteryPlaylistMoodState(startedEvent.session_id);
    if (startedEvent.category === "snakes_ladders") socket.requestSnakesLaddersState(startedEvent.session_id);
    if (startedEvent.category === "bingo") socket.requestBingoState(startedEvent.session_id);
    if (startedEvent.category === "spot_the_difference") socket.requestSpotDifferenceState(startedEvent.session_id);
    if (startedEvent.category === "memory_match") socket.requestMemoryMatchState(startedEvent.session_id);
  }, [socket.events?.game_started, user?.id]);

  useEffect(() => {
    const resultEvent = socket.events?.game_result;
    if (!resultEvent?.result) {
      return;
    }
    if (resultEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(resultEvent.message)));
    }
    setStartingGame("");
  }, [socket.events?.game_result]);

  useEffect(() => {
    const update = socket.events?.game_update;
    if (update?.state_sync && update?.session_id) {
      setAnsweredGameQuestionIds(update.answered_question_ids || []);
      setGameStatementSets(update.statement_sets || null);
      setGuessedGameQuestionIds(update.guessed_question_ids || []);
      setWaitingGameSessionId(update.waiting_for_match ? Number(update.session_id) : null);
      setYourTurnGameSessionId(update.your_turn ? Number(update.session_id) : null);
      if (update.tic_tac_toe_state) {
        setTicTacToeState(update.tic_tac_toe_state);
        setWaitingGameSessionId(update.waiting_for_match ? Number(update.session_id) : null);
        setYourTurnGameSessionId(update.your_turn ? Number(update.session_id) : null);
      }
      if (update.dots_boxes_state) {
        setDotsBoxesState(update.dots_boxes_state);
        setActiveGame({ session_id: update.session_id, category: "dots_and_boxes", game_name: "Dots and Boxes", questions: [] });
        setSelectedGame("dots_and_boxes");
        openGameSession(update.session_id);
        setWaitingGameSessionId(update.waiting_for_match ? Number(update.session_id) : null);
        setYourTurnGameSessionId(update.your_turn ? Number(update.session_id) : null);
      }
      if (update.snakes_ladders_state) {
        setSnakesLaddersState(update.snakes_ladders_state);
        setActiveGame({ session_id: update.session_id, category: "snakes_ladders", game_name: "Snakes, Ladders & Secrets", questions: [] });
        setSelectedGame("snakes_ladders");
        openGameSession(update.session_id);
        const turnUserId = Number(update.snakes_ladders_state.turn_user_id);
        setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
        setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
      }
      if (update.bingo_state) {
        setBingoState(update.bingo_state);
        setActiveGame({ session_id: update.session_id, category: "bingo", game_name: "Bingo: Are We in Sync?", questions: [] });
        setSelectedGame("bingo");
        openGameSession(update.session_id);
        const turnUserId = Number(update.bingo_state.turn_user_id);
        setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
        setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
      }
      if (update.spot_difference_state) {
        setSpotDifferenceState(update.spot_difference_state);
        setActiveGame({ session_id: update.session_id, category: "spot_the_difference", game_name: "Spot the Difference", questions: [] });
        setSelectedGame("spot_the_difference");
        openGameSession(update.session_id);
        const turnUserId = Number(update.spot_difference_state.turn_user_id);
        setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
        setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
      }
      if (update.memory_match_state) {
        setMemoryMatchState(update.memory_match_state);
        setActiveGame({ session_id: update.session_id, category: "memory_match", game_name: "Memory Match", questions: [] });
        setSelectedGame("memory_match");
        openGameSession(update.session_id);
        const turnUserId = Number(update.memory_match_state.turn_user_id);
        setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
        setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
      }
      if (update.pictionary_state) {
        setActiveGame({ session_id: update.session_id, category: "pictionary", game_name: "Pictionary", questions: [] });
        setSelectedGame("pictionary");
        setPictionaryState(update.pictionary_state);
        openGameSession(update.session_id);
      }
      if (update.word_search_state) {
        setActiveGame({ session_id: update.session_id, category: "word_search", game_name: "Word Search", questions: [] });
        setSelectedGame("word_search");
        setWordSearchState(update.word_search_state);
        setWaitingGameSessionId(update.word_search_state.your_completed ? Number(update.session_id) : null);
        setYourTurnGameSessionId(update.word_search_state.match_completed && !update.word_search_state.your_completed ? Number(update.session_id) : null);
        openGameSession(update.session_id);
      }
      if (update.unscramble_state) {
        setActiveGame({ session_id: update.session_id, category: "unscramble", game_name: "Unscramble", questions: [] });
        setSelectedGame("unscramble");
        setUnscrambleState(update.unscramble_state);
        setWaitingGameSessionId(update.unscramble_state.your_completed ? Number(update.session_id) : null);
        setYourTurnGameSessionId(update.unscramble_state.match_completed && !update.unscramble_state.your_completed ? Number(update.session_id) : null);
        openGameSession(update.session_id);
      }
      if (update.word_association_state) {
        setActiveGame({ session_id: update.session_id, category: "word_association", game_name: "Word Association", questions: [] });
        setSelectedGame("word_association");
        setWordAssociationState(update.word_association_state);
        openGameSession(update.session_id);
      }
      if (update.collaborative_playlist_state) {
        setCollaborativePlaylistState(update.collaborative_playlist_state);
        setActiveGame({ session_id: update.session_id, category: "collaborative_playlist", game_name: "Collaborative Playlist", questions: [] });
        setSelectedGame("collaborative_playlist");
        openGameSession(update.session_id);
      }
      if (update.mystery_playlist_mood_state) {
        setMysteryPlaylistMoodState(update.mystery_playlist_mood_state);
        setActiveGame({ session_id: update.session_id, category: "mystery_playlist_mood", game_name: "Mystery Playlist Mood", questions: [] });
        setSelectedGame("mystery_playlist_mood");
        openGameSession(update.session_id);
      }
    } else {
      if (update?.statement_sets) {
        setGameStatementSets(update.statement_sets);
      }
      if (update?.session_id && Number(update?.user_id) === Number(user?.id)) {
        setAnsweredGameQuestionIds((previous) => (
          previous.includes(Number(update.question_id))
            ? previous
            : [...previous, Number(update.question_id)]
        ));
        setWaitingGameSessionId(update.user_completed ? Number(update.session_id) : null);
      } else if (update?.session_id && update?.user_completed) {
        setYourTurnGameSessionId(Number(update.session_id));
      }
      if (update?.session_id && update?.your_turn) {
        setYourTurnGameSessionId(Number(update.session_id));
      }
    }
  }, [socket.events?.game_update, user?.id]);

  useEffect(() => {
    const update = socket.events?.bingo_update;
    if (!update?.session_id || !update.bingo_state) return;
    setBingoState(update.bingo_state);
    setActiveGame({ session_id: update.session_id, category: "bingo", game_name: "Bingo: Are We in Sync?", questions: [] });
    setSelectedGame("bingo");
    openGameSession(update.session_id);
    socket.requestBingoState(update.session_id);
  }, [socket.events?.bingo_update]);

  useEffect(() => {
    const update = socket.events?.spot_difference_update;
    if (!update?.session_id || !update.spot_difference_state) return;
    setSpotDifferenceState(update.spot_difference_state);
    setActiveGame({ session_id: update.session_id, category: "spot_the_difference", game_name: "Spot the Difference", questions: [] });
    setSelectedGame("spot_the_difference"); openGameSession(update.session_id);
    socket.requestSpotDifferenceState(update.session_id);
  }, [socket.events?.spot_difference_update]);

  useEffect(() => {
    const sync = socket.events?.spot_difference_state;
    if (!sync?.session_id || !sync.spot_difference_state) return;
    setSpotDifferenceState(sync.spot_difference_state);
    setActiveGame((current) => current?.session_id === sync.session_id ? { ...current, ...sync, category: "spot_the_difference", questions: [] } : { ...sync, category: "spot_the_difference", game_name: "Spot the Difference", questions: [] });
    setSelectedGame("spot_the_difference");
    if (sync.spot_difference_state.completed) setGameOpen(false); else openGameSession(sync.session_id);
    const turnUserId = Number(sync.spot_difference_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(sync.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(sync.session_id) : null);
  }, [socket.events?.spot_difference_state, user?.id]);

  useEffect(() => {
    const update = socket.events?.memory_match_update;
    if (!update?.session_id || !update.memory_match_state) return;
    setMemoryMatchState(update.memory_match_state);
    setActiveGame({ session_id: update.session_id, category: "memory_match", game_name: "Memory Match", questions: [] });
    setSelectedGame("memory_match"); openGameSession(update.session_id);
    socket.requestMemoryMatchState(update.session_id);
  }, [socket.events?.memory_match_update]);

  useEffect(() => {
    const sync = socket.events?.memory_match_state;
    if (!sync?.session_id || !sync.memory_match_state) return;
    setMemoryMatchState(sync.memory_match_state);
    setActiveGame((current) => current?.session_id === sync.session_id ? { ...current, ...sync, category: "memory_match", questions: [] } : { ...sync, category: "memory_match", game_name: "Memory Match", questions: [] });
    setSelectedGame("memory_match");
    if (sync.memory_match_state.completed) setGameOpen(false); else openGameSession(sync.session_id);
    const turnUserId = Number(sync.memory_match_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(sync.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(sync.session_id) : null);
  }, [socket.events?.memory_match_state, user?.id]);

  useEffect(() => {
    const sync = socket.events?.bingo_state;
    if (!sync?.session_id || !sync.bingo_state) return;
    setBingoState(sync.bingo_state);
    setActiveGame((current) => current?.session_id === sync.session_id
      ? { ...current, ...sync, category: "bingo", questions: [] }
      : { ...sync, category: "bingo", game_name: "Bingo: Are We in Sync?", questions: [] });
    setSelectedGame("bingo");
    if (sync.bingo_state.completed) setGameOpen(false); else openGameSession(sync.session_id);
    const turnUserId = Number(sync.bingo_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(sync.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(sync.session_id) : null);
  }, [socket.events?.bingo_state, user?.id]);

  useEffect(() => {
    const update = socket.events?.snakes_ladders_update;
    if (!update?.session_id || !update.snakes_ladders_state) return;
    setSnakesLaddersState(update.snakes_ladders_state);
    setActiveGame({ session_id: update.session_id, category: "snakes_ladders", game_name: "Snakes, Ladders & Secrets", questions: [] });
    setSelectedGame("snakes_ladders");
    openGameSession(update.session_id);
    socket.requestSnakesLaddersState(update.session_id);
  }, [socket.events?.snakes_ladders_update]);

  useEffect(() => {
    const sync = socket.events?.snakes_ladders_state;
    if (!sync?.session_id || !sync.snakes_ladders_state) return;
    setSnakesLaddersState(sync.snakes_ladders_state);
    setActiveGame((current) => current?.session_id === sync.session_id
      ? { ...current, ...sync, category: "snakes_ladders", questions: [] }
      : { ...sync, category: "snakes_ladders", game_name: "Snakes, Ladders & Secrets", questions: [] });
    setSelectedGame("snakes_ladders");
    if (sync.snakes_ladders_state.completed) setGameOpen(false); else openGameSession(sync.session_id);
    const turnUserId = Number(sync.snakes_ladders_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(sync.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(sync.session_id) : null);
  }, [socket.events?.snakes_ladders_state, user?.id]);

  useEffect(() => {
    const update = socket.events?.word_association_update;
    if (!update?.state || !update?.session_id) return;
    setWordAssociationState(update.state);
    setActiveGame({ session_id: update.session_id, category: "word_association", game_name: "Word Association", questions: [] });
    setSelectedGame("word_association");
    openGameSession(update.session_id);
  }, [socket.events?.word_association_update]);

  useEffect(() => {
    const stateEvent = socket.events?.word_association_state;
    if (!stateEvent?.state || !stateEvent?.session_id) return;
    setWordAssociationState(stateEvent.state);
    setActiveGame({ session_id: stateEvent.session_id, category: "word_association", game_name: "Word Association", questions: [] });
    setSelectedGame("word_association");
    openGameSession(stateEvent.session_id);
  }, [socket.events?.word_association_state]);

  useEffect(() => {
    const update = socket.events?.collaborative_playlist_update;
    if (!update?.state || !update?.session_id) return;
    setCollaborativePlaylistState(update.state);
    setActiveGame({ session_id: update.session_id, category: "collaborative_playlist", game_name: "Collaborative Playlist", questions: [] });
    setSelectedGame("collaborative_playlist");
    openGameSession(update.session_id);
  }, [socket.events?.collaborative_playlist_update]);

  useEffect(() => {
    const stateEvent = socket.events?.collaborative_playlist_state;
    if (!stateEvent?.state || !stateEvent?.session_id) return;
    setCollaborativePlaylistState(stateEvent.state);
    setActiveGame((previous) => previous?.session_id === stateEvent.session_id
      ? { ...previous, category: "collaborative_playlist" }
      : { session_id: stateEvent.session_id, category: "collaborative_playlist", game_name: "Collaborative Playlist", questions: [] });
    setSelectedGame("collaborative_playlist");
    openGameSession(stateEvent.session_id);
  }, [socket.events?.collaborative_playlist_state]);

  useEffect(() => {
    const update = socket.events?.mystery_playlist_mood_update;
    if (!update?.state || !update?.session_id) return;
    setMysteryPlaylistMoodState(update.state);
    setActiveGame({ session_id: update.session_id, category: "mystery_playlist_mood", game_name: "Mystery Playlist Mood", questions: [] });
    setSelectedGame("mystery_playlist_mood");
    openGameSession(update.session_id);
  }, [socket.events?.mystery_playlist_mood_update]);

  useEffect(() => {
    const stateEvent = socket.events?.mystery_playlist_mood_state;
    if (!stateEvent?.state || !stateEvent?.session_id) return;
    setMysteryPlaylistMoodState(stateEvent.state);
    setActiveGame((previous) => previous?.session_id === stateEvent.session_id
      ? { ...previous, category: "mystery_playlist_mood" }
      : { session_id: stateEvent.session_id, category: "mystery_playlist_mood", game_name: "Mystery Playlist Mood", questions: [] });
    setSelectedGame("mystery_playlist_mood");
    openGameSession(stateEvent.session_id);
  }, [socket.events?.mystery_playlist_mood_state]);

  useEffect(() => {
    const update = socket.events?.pictionary_update;
    if (update?.session_id) socket.requestPictionaryState(update.session_id);
  }, [socket.events?.pictionary_update]);

  useEffect(() => {
    const state = socket.events?.pictionary_state;
    if (state?.session_id) {
      setPictionaryState(state);
      setActiveGame((previous) => previous?.session_id === state.session_id
        ? previous : { session_id: state.session_id, category: "pictionary", game_name: "Pictionary", questions: [] });
      setSelectedGame("pictionary");
    }
  }, [socket.events?.pictionary_state]);

  useEffect(() => {
    const update = socket.events?.word_search_update;
    if (update?.session_id) socket.requestWordSearchState(update.session_id);
  }, [socket.events?.word_search_update]);

  useEffect(() => {
    const state = socket.events?.word_search_state;
    if (state?.session_id) {
      setWordSearchState(state);
      setWaitingGameSessionId(state.your_completed ? Number(state.session_id) : null);
      setYourTurnGameSessionId(state.match_completed && !state.your_completed ? Number(state.session_id) : null);
      setActiveGame((previous) => previous?.session_id === state.session_id
        ? previous : { session_id: state.session_id, category: "word_search", game_name: "Word Search", questions: [] });
      setSelectedGame("word_search");
    }
  }, [socket.events?.word_search_state]);

  useEffect(() => {
    const update = socket.events?.unscramble_update;
    if (update?.session_id) socket.requestUnscrambleState(update.session_id);
  }, [socket.events?.unscramble_update]);

  useEffect(() => {
    const state = socket.events?.unscramble_state;
    if (state?.session_id) {
      setUnscrambleState(state);
      setWaitingGameSessionId(state.your_completed ? Number(state.session_id) : null);
      setYourTurnGameSessionId(state.match_completed && !state.your_completed ? Number(state.session_id) : null);
      setActiveGame((previous) => previous?.session_id === state.session_id
        ? previous : { session_id: state.session_id, category: "unscramble", game_name: "Unscramble", questions: [] });
      setSelectedGame("unscramble");
    }
  }, [socket.events?.unscramble_state]);

  useEffect(() => {
    if (socket.events?.unscramble_feedback) setUnscrambleFeedback(socket.events.unscramble_feedback);
  }, [socket.events?.unscramble_feedback]);

  useEffect(() => {
    const update = socket.events?.tic_tac_toe_update;
    if (!update?.tic_tac_toe_state) return;
    setTicTacToeState(update.tic_tac_toe_state);
    const turnUserId = Number(update.tic_tac_toe_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
  }, [socket.events?.tic_tac_toe_update, user?.id]);

  useEffect(() => {
    const update = socket.events?.dots_boxes_update;
    if (!update?.dots_boxes_state) return;
    setDotsBoxesState(update.dots_boxes_state);
    const turnUserId = Number(update.dots_boxes_state.turn_user_id);
    setYourTurnGameSessionId(turnUserId === Number(user?.id) ? Number(update.session_id) : null);
    setWaitingGameSessionId(turnUserId && turnUserId !== Number(user?.id) ? Number(update.session_id) : null);
  }, [socket.events?.dots_boxes_update, user?.id]);

  useEffect(() => {
    const roundEvent = socket.events?.game_round_result;
    if (roundEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(roundEvent.message)));
    }
    if (roundEvent?.session_id) {
      setWaitingGameSessionId(null);
      setYourTurnGameSessionId(null);
    }
  }, [socket.events?.game_round_result]);

  useEffect(() => {
    const completed = socket.events?.game_session_completed;
    if (!completed?.session_id) {
      return;
    }
    if (Array.isArray(completed.messages)) {
      setMessages((previous) => completed.messages.reduce(
        (next, message) => mergeMessage(next, normalizeMessage(message)),
        previous,
      ));
    }
    if (completed.tic_tac_toe_state) setTicTacToeState(completed.tic_tac_toe_state);
    if (completed.dots_boxes_state) setDotsBoxesState(completed.dots_boxes_state);
    if (completed.bingo_state) setBingoState(completed.bingo_state);
    if (completed.spot_difference_state) setSpotDifferenceState(completed.spot_difference_state);
    if (completed.memory_match_state) setMemoryMatchState(completed.memory_match_state);
    if (completed.pictionary_state) setPictionaryState(completed.pictionary_state);
    if (completed.word_search_state) setWordSearchState(completed.word_search_state);
    if (completed.unscramble_state) setUnscrambleState(completed.unscramble_state);
    setGameOpen(false);
    setWaitingGameSessionId(null);
    setYourTurnGameSessionId(null);
  }, [socket.events?.game_session_completed]);

  useEffect(() => {
    if (!activeGame?.session_id) {
      return;
    }
    const hasCompletedMessage = messages.some(
      (message) => parseGameEventType(message) === "game_result" &&
        Number(message?.game_payload?.session_id) === Number(activeGame.session_id),
    );
    if (hasCompletedMessage) {
      setGameOpen(false);
      setWaitingGameSessionId(null);
      setYourTurnGameSessionId(null);
    }
  }, [messages, activeGame?.session_id]);

  useEffect(() => {
    if (!socket.lastError) {
      return;
    }
    setStartingGame("");
    if (socket.status === "connected") {
      setPendingGameStart("");
      setPendingGameInviteResponse(null);
      setRespondingInviteId(null);
    }
  }, [socket.lastError, socket.status]);

  useEffect(() => {
    if (!pendingGameStart || !socket.isConnected) {
      return;
    }

    const queuedGame = pendingGameStart;
    const sent = socket.startGame(queuedGame);
    if (sent) {
      setPendingGameStart("");
      setError("");
      return;
    }

    setPendingGameStart("");
    setStartingGame("");
    setError("Could not start game right now.");
  }, [pendingGameStart, socket]);

  useEffect(() => {
    if (!pendingGameInviteResponse || !socket.isConnected) {
      return;
    }

    const { sessionId, action } = pendingGameInviteResponse;
    if (socket.respondGameInvite(sessionId, action)) {
      setPendingGameInviteResponse(null);
      setError("");
      return;
    }

    setError("Reconnecting to respond to the game invite...");
    socket.reconnect();
  }, [pendingGameInviteResponse, socket]);

  useEffect(() => {
    if (!hasMatch) {
      setLoading(false);
      return;
    }

    setGameOpen(false);
    setActiveGame(null);
    setReplyTo(null);
    setShowGames(false);
    setShowAllGames(false);
    setDotsBoxesState(null);
    setWaitingGameSessionId(null);
    setYourTurnGameSessionId(null);

    async function loadChat() {
      setLoading(true);
      setError("");
      setFirstMessageSent(false);
      setAnsweringByQuestion({});
      setAnsweredGameQuestionIds([]);
      setIcebreakers([]);
      setIcebreakersLoading(true);
      try {
        const [detail, history, suggestionList] = await Promise.all([
          fetchMatchDetail(matchId),
          fetchMatchMessages(matchId),
          fetchMatchIcebreakers(matchId).catch(() => []),
        ]);
        setMatchInfo(detail);
        setMessages(normalizeMessages(history));
        setIcebreakers(Array.isArray(suggestionList) ? suggestionList.slice(0, 3) : []);
      } catch (apiError) {
        setError(conversationErrorMessage(apiError));
      } finally {
        setIcebreakersLoading(false);
        setLoading(false);
      }
    }

    loadChat();
  }, [hasMatch, matchId]);

  useEffect(() => {
    if (!hasMatch || loading) {
      return undefined;
    }

    let cancelled = false;

    async function syncMessages() {
      if (syncInFlightRef.current || document.visibilityState === "hidden") {
        return;
      }

      syncInFlightRef.current = true;
      try {
        const history = await fetchMatchMessages(matchId);
        if (cancelled || !Array.isArray(history)) {
          return;
        }

        const normalizedHistory = history.map(normalizeMessage);
        setMessages((prev) => normalizedHistory.reduce((next, message) => mergeMessage(next, message), prev));
      } catch {
        // Keep the existing thread state if a background sync fails.
      } finally {
        syncInFlightRef.current = false;
      }
    }

    const intervalId = window.setInterval(syncMessages, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasMatch, loading, matchId]);

  async function onGameAnswer({ message, option }) {
    const sessionId = Number(message?.game_payload?.session_id);
    const questionId = Number(message?.game_payload?.question_id);
    if (!Number.isInteger(sessionId) || sessionId <= 0 || !Number.isInteger(questionId) || questionId <= 0) {
      return;
    }

    const existingAnswers = Array.isArray(questionAnswersById[questionId])
      ? questionAnswersById[questionId]
      : [];
    const alreadyAnswered = existingAnswers.some(
      (answer) => Number(answer?.sender_id) === Number(user?.id),
    );
    if (alreadyAnswered || answeringByQuestion[questionId]) {
      return;
    }

    const textAnswer =
      typeof option === "string"
        ? option
        : String(option?.label || option?.option_text || option?.value || "").trim();
    const selectedOption = Number.isInteger(option?.id) ? option.id : null;
    if (!textAnswer && selectedOption === null) {
      return;
    }

    setAnsweringByQuestion((prev) => ({ ...prev, [questionId]: true }));
    setError("");
    try {
      await submitGameAnswer({
        sessionId,
        questionId,
        selectedOption,
        textAnswer,
      });
      if (!socket.isConnected) {
        const history = await fetchMatchMessages(matchId);
        setMessages(normalizeMessages(history));
      }
    } catch (apiError) {
      setError(messageSendErrorMessage(apiError));
    } finally {
      setAnsweringByQuestion((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function onModalGameAnswer(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const sent = socket.answerQuestion(payload);
    if (sent) {
      return;
    }

    throw new Error("Live game connection unavailable right now.");
  }

  async function onPhotoScavengerUpload(payload) {
    return uploadPhotoScavengerSubmission({
      sessionId: payload?.session_id,
      questionId: payload?.question_id,
      image: payload?.image,
      caption: payload?.caption,
    });
  }

  function onTicTacToeMove(payload) {
    if (!socket.moveTicTacToe(payload)) {
      throw new Error("Live game connection unavailable right now.");
    }
  }

  function onDotsBoxesMove(payload) {
    if (!socket.moveDotsBoxes(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onSnakesLaddersAction(payload) {
    if (!socket.actSnakesLadders(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onBingoAction(payload) {
    if (!socket.actBingo(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onSpotDifferenceAction(payload) {
    if (!socket.actSpotDifference(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onMemoryMatchAction(payload) {
    if (!socket.actMemoryMatch(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onPictionaryAction(action, payload) {
    const handlers = {
      drawing: socket.submitPictionaryDrawing,
      guess: socket.submitPictionaryGuess,
      give_up: socket.giveUpPictionary,
    };
    if (!handlers[action]?.(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onWordSearchSelect(payload) {
    if (!socket.selectWordSearchCells(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onUnscrambleSubmit(payload) {
    if (!socket.submitUnscramble(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onWordAssociationSubmit(payload) {
    if (!socket.submitWordAssociation(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onCollaborativePlaylistSubmit(payload) {
    if (!socket.submitCollaborativePlaylistTrack(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onMysteryPlaylistMoodSubmit(payload) {
    if (!socket.submitMysteryPlaylistMood(payload)) throw new Error("Live game connection unavailable right now.");
    return true;
  }

  function onGameInviteResponse({ action, sessionId, gamePayload } = {}) {
    const parsedId = Number(sessionId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return;
    }
    if (action === "open") {
      dismissedGameSessionIdsRef.current.delete(parsedId);
      setActiveGame({ ...gamePayload, session_id: parsedId });
      setSelectedGame(gamePayload?.category || "this_or_that");
      setGameOpen(true);
      if (gamePayload?.category === "pictionary") socket.requestPictionaryState(parsedId);
      if (gamePayload?.category === "word_search") socket.requestWordSearchState(parsedId);
      if (gamePayload?.category === "unscramble") socket.requestUnscrambleState(parsedId);
      if (gamePayload?.category === "word_association") socket.requestWordAssociationState(parsedId);
      if (gamePayload?.category === "collaborative_playlist") socket.requestCollaborativePlaylistState(parsedId);
      if (gamePayload?.category === "mystery_playlist_mood") socket.requestMysteryPlaylistMoodState(parsedId);
      if (gamePayload?.category === "spot_the_difference") socket.requestSpotDifferenceState(parsedId);
      if (gamePayload?.category === "memory_match") socket.requestMemoryMatchState(parsedId);
      return;
    }
    if (!socket.isConnected) {
      setPendingGameInviteResponse({ sessionId: parsedId, action });
      setRespondingInviteId(parsedId);
      setError("Reconnecting to respond to the game invite...");
      socket.reconnect();
      return;
    }
    setRespondingInviteId(parsedId);
    if (!socket.respondGameInvite(parsedId, action)) {
      setPendingGameInviteResponse({ sessionId: parsedId, action });
      setError("Reconnecting to respond to the game invite...");
      socket.reconnect();
    }
  }

  function onStartGame(category) {
    const gameId = String(category || "").trim();
    if (!gameId) {
      return;
    }

    setError("");
    setShowGames(false);
    setSelectedGame(gameId);
    setStartingGame(gameId);
    if (!socket.isConnected) {
      setPendingGameStart(gameId);
      setError("Reconnecting to start your game...");
      socket.reconnect();
      return;
    }

    const sent = socket.startGame(gameId);
    if (!sent) {
      setPendingGameStart(gameId);
      setError("Reconnecting to start your game...");
      socket.reconnect();
    }
  }

  async function onReaction(message, emoji) {
    if (!message?.id) return;
    try {
      const update = await toggleMessageReaction(matchId, message.id, emoji);
      setMessages((prev) => prev.map((item) => item.id === message.id
        ? { ...item, reactions: update.reactions || {} } : item));
    } catch (apiError) {
      setError(apiError?.message || "Could not update that reaction.");
    }
  }

  async function onSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !hasMatch || sending) {
      return;
    }

    setSending(true);
    setError("");
    const replyTarget = replyTo;
    let pending = pendingMessageRef.current;
    if (
      !pending
      || pending.content !== text
      || pending.replyToId !== (replyTarget?.id || null)
    ) {
      pending = {
        clientMessageId: createClientMessageId(),
        content: text,
        replyToId: replyTarget?.id || null,
      };
      pendingMessageRef.current = pending;
    }
    const clientMessageId = pending.clientMessageId;
    setMessages((prev) =>
      mergeMessage(prev, {
        id: null,
        client_message_id: clientMessageId,
        sender_id: user?.id,
        content: text,
        reply_to: replyTarget,
        timestamp: new Date().toISOString(),
        status: "sent",
        is_read: false,
      }),
    );
    try {
      const sentViaSocket = socket.sendMessage(text, clientMessageId, replyTarget?.id);
      if (!sentViaSocket) {
        const created = await sendMatchMessage(matchId, text, clientMessageId, replyTarget?.id);
        setMessages((prev) => mergeMessage(prev, normalizeMessage(created)));
      }
      setFirstMessageSent(true);
      setDraft((current) => current.trim() === text ? "" : current);
      setReplyTo((current) => current?.id === pending.replyToId ? null : current);
      if (pendingMessageRef.current?.clientMessageId === clientMessageId) {
        pendingMessageRef.current = null;
      }
    } catch (apiError) {
      setMessages((prev) =>
        prev.filter(
          (message) => !(message.client_message_id === clientMessageId && !message.id),
        ),
      );
      setError(messageSendErrorMessage(apiError));
    } finally {
      setSending(false);
    }
  }

  if (!hasMatch) {
    return (
      <ConversationsList
        conversations={filteredConversations}
        totalCount={conversations.length}
        error={conversationError}
        loading={conversationLoading}
        query={conversationQuery}
        setQuery={setConversationQuery}
      />
    );
  }

  return (
    <main className="tara-chat-thread tara-container">
      <header className="chat-thread-header">
        <Link aria-label="Back to conversations" className="chat-thread-back" to="/chat"><ArrowLeft size={21} /></Link>
        <Link
          aria-label={`View match profile for ${matchInfo?.user?.name || "your match"}`}
          className="chat-thread-match-link"
          state={{ from: "chat" }}
          to={`/matches/${matchId}`}
        >
          <Avatar name={matchInfo?.user?.name} photo={matchInfo?.user?.photo} />
          <div className="chat-thread-heading">
            <h1>{matchInfo?.user?.name || "Chat"}</h1>
            <p>{insightText}</p>
          </div>
        </Link>
        <button aria-expanded={safetyOpen} aria-label="Safety options" className="rounded-full border border-[#e8e8e8] bg-white p-2 text-[#555] hover:bg-[#fafafa]" onClick={() => { setReportTarget({ type: "profile", id: matchInfo?.user?.id || null }); setSafetyOpen((open) => !open); setSafetyNotice(""); }} type="button"><Flag size={17} /></button>
      </header>

      {safetyNotice ? <p role="status" className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{safetyNotice}</p> : null}
      {safetyOpen ? <section aria-label="Safety options" className="mb-3 rounded-xl border border-[#e8e8e8] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#262626]">Your safety matters</h2><p className="mt-1 text-xs text-[#737373]">Reports are private. Blocking ends this connection.</p></div><button aria-label="Close safety options" className="rounded-full p-1 text-[#737373]" onClick={() => setSafetyOpen(false)} type="button"><X size={17} /></button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <select aria-label="Report category" className="rounded-lg border border-[#dedede] bg-white px-3 py-2 text-sm" onChange={(event) => setReportCategory(event.target.value)} value={reportCategory}>
            <option value="harassment">Harassment</option><option value="impersonation">Impersonation</option><option value="scam">Scam</option><option value="unsafe_content">Unsafe content</option><option value="underage">Underage user</option><option value="other">Other</option>
          </select>
          <button className="rounded-lg bg-[#262626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={safetyBusy} onClick={submitSafetyReport} type="button">{safetyBusy ? "Sending…" : reportTarget.type === "profile" ? "Report profile" : reportTarget.type === "game_session" ? "Report game" : "Report message"}</button>
        </div>
        <textarea aria-label="Optional report details" className="mt-2 min-h-16 w-full resize-y rounded-lg border border-[#dedede] px-3 py-2 text-sm" maxLength={1000} onChange={(event) => setReportDetails(event.target.value)} placeholder="Add details (optional)" value={reportDetails} />
        {reportTarget.type === "profile" ? <button className="mt-2 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={safetyBusy} onClick={blockMatch} type="button">Block {matchInfo?.user?.name || "this person"}</button> : null}
        {reportTarget.type === "profile" ? <div className="mt-2 grid grid-cols-2 gap-2"><button className="rounded-lg border border-[#dedede] px-3 py-2 text-sm font-semibold text-[#555] disabled:opacity-50" disabled={safetyBusy} onClick={() => changeConnection("pause")} type="button">Pause connection</button><button className="rounded-lg border border-[#dedede] px-3 py-2 text-sm font-semibold text-[#555] disabled:opacity-50" disabled={safetyBusy} onClick={() => changeConnection("unmatch")} type="button">Unmatch</button></div> : null}
        {reportTarget.type === "profile" ? <div className="mt-4 border-t border-[#eee] pt-3"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-[#262626]">Safe date plan</h3><p className="text-xs text-[#737373]">Choose a public place. Share the plan with someone you trust.</p></div><button className="text-xs font-semibold text-[#b73363]" onClick={() => setDatePlanOpen((open) => !open)} type="button">{datePlanOpen ? "Close" : datePlan ? "Edit plan" : "Create plan"}</button></div>
          {datePlan ? <div className="mt-3 rounded-lg bg-[#f8f8f8] p-3 text-xs text-[#555]"><p className="font-semibold text-[#262626]">{datePlan.activity} · {datePlan.public_venue}</p><p className="mt-1">{new Date(datePlan.scheduled_at).toLocaleString()}</p>{datePlan.share_with_trusted_contact && datePlan.created_by_id === user?.id && datePlan.share_text ? <button className="mt-2 font-semibold text-[#0095f6]" onClick={async () => { try { if (navigator.share) await navigator.share({ title: "My Tara date plan", text: datePlan.share_text }); else { await navigator.clipboard.writeText(datePlan.share_text); setSafetyNotice("Date plan copied. Share it with your trusted contact."); } } catch {} }} type="button">Share plan with trusted contact</button> : null}</div> : null}
          {datePlanOpen ? <form className="mt-3 grid gap-2" onSubmit={saveSafeDatePlan}><input aria-label="Activity" className="rounded-lg border border-[#dedede] px-3 py-2 text-sm" maxLength={160} onChange={(event) => setDateForm((form) => ({ ...form, activity: event.target.value }))} placeholder="Activity (e.g. coffee)" required value={dateForm.activity} /><input aria-label="Date and time" className="rounded-lg border border-[#dedede] px-3 py-2 text-sm" min={toLocalDateTimeValue()} onChange={(event) => setDateForm((form) => ({ ...form, scheduled_at: event.target.value }))} required type="datetime-local" value={dateForm.scheduled_at} /><input aria-label="Public venue" className="rounded-lg border border-[#dedede] px-3 py-2 text-sm" maxLength={255} onChange={(event) => setDateForm((form) => ({ ...form, public_venue: event.target.value }))} placeholder="Public venue" required value={dateForm.public_venue} /><label className="flex items-center gap-2 text-xs text-[#555]"><input checked readOnly type="checkbox" />I confirm this is a public place.</label><label className="flex items-center gap-2 text-xs text-[#555]"><input checked={dateForm.share_with_trusted_contact} onChange={(event) => setDateForm((form) => ({ ...form, share_with_trusted_contact: event.target.checked }))} type="checkbox" />I want to share this plan with a trusted contact.</label>{dateForm.share_with_trusted_contact ? <><input aria-label="Trusted contact name" className="rounded-lg border border-[#dedede] px-3 py-2 text-sm" onChange={(event) => setDateForm((form) => ({ ...form, trusted_contact_name: event.target.value }))} placeholder="Trusted contact name" required value={dateForm.trusted_contact_name} /><input aria-label="Trusted contact phone" className="rounded-lg border border-[#dedede] px-3 py-2 text-sm" onChange={(event) => setDateForm((form) => ({ ...form, trusted_contact_phone: event.target.value }))} placeholder="Trusted contact phone" required value={dateForm.trusted_contact_phone} /></> : null}<button className="rounded-lg bg-[#0095f6] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={datePlanBusy} type="submit">{datePlanBusy ? "Saving…" : "Save plan"}</button></form> : null}
          {datePlan && Date.now() >= new Date(datePlan.scheduled_at).getTime() ? <div className="mt-3 grid gap-2"><button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50" disabled={datePlanBusy} onClick={() => dateCheckIn("safe")} type="button">I’m safe</button><textarea aria-label="Safety concern details" className="min-h-14 rounded-lg border border-[#dedede] px-3 py-2 text-sm" maxLength={1000} onChange={(event) => setCheckInDetails(event.target.value)} placeholder="If something felt unsafe, tell us what happened (optional)." value={checkInDetails} /><button className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50" disabled={datePlanBusy} onClick={() => dateCheckIn("concern")} type="button">Report a safety concern</button></div> : null}
        </div> : null}
      </section> : null}

      <section className="chat-thread-messages">
        {loading ? <ChatThreadSkeleton /> : null}
        {error ? <p className="mb-3 rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
        {!error && socket.lastError ? (
          <p className="mb-3 rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-100">{socket.lastError}</p>
        ) : null}

        {!loading && !error && messages.length === 0 ? (
          <div className="chat-thread-empty">
            <Avatar name={matchInfo?.user?.name} photo={matchInfo?.user?.photo} />
            <h2>{matchInfo?.user?.name || "Your match"}</h2>
            <p>This is the start of your conversation. Say hello and see where it goes.</p>
            <button
              onClick={() => {
                setDraft(`Hey ${matchInfo?.user?.name?.split?.(" ")?.[0] || ""}, nice to meet you!`.trim());
                draftInputRef.current?.focus();
              }}
              type="button"
            >
              Send a hello
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => {
              const questionId = Number(message?.game_payload?.question_id);
              const answers = Number.isInteger(questionId) ? (questionAnswersById[questionId] || []) : [];
              const currentAnswer =
                answers.find((answer) => Number(answer?.sender_id) === Number(user?.id))?.content || "";
              const result = hasDetailedGameResult(message)
                ? normalizeGameResultForViewer(message.game_payload.result, viewerIsUserA)
                : null;

              return (
                result ? (
                  <GameResultCard
                    category={message?.game_payload?.category || selectedGame}
                    key={message.id ? `id-${message.id}` : `cid-${message.client_message_id || index}`}
                    partnerLabel={partnerLabel}
                    result={result}
                    currentUserId={user?.id}
                    userLabel="You"
                  />
                ) : (
                  <MessageBubble
                    currentUserAnswer={currentAnswer}
                    currentUserId={user?.id}
                    gameAnswers={answers}
                    isAnsweringGameQuestion={Boolean(answeringByQuestion[questionId])}
                    isOwn={Number(message.sender_id) === Number(user?.id)}
                    key={message.id ? `id-${message.id}` : `cid-${message.client_message_id || index}`}
                    message={message}
                    onReply={(target) => {
                      setReplyTo({ id: target.id, sender_id: target.sender_id, content: target.content.slice(0, 160) });
                      draftInputRef.current?.focus();
                    }}
                    onReaction={onReaction}
                    onReport={(target) => { const sessionId = Number(target?.game_payload?.session_id); setReportTarget({ type: Number.isInteger(sessionId) && sessionId > 0 ? "game_session" : "chat_message", id: Number.isInteger(sessionId) && sessionId > 0 ? sessionId : target.id }); setSafetyOpen(true); setSafetyNotice(""); }}
                    onHide={toggleHiddenMessage}
                    isHidden={hiddenMessageIds.has(String(message?.id || messageIdentity(message)))}
                    onPrompt={(prompt) => {
                      setDraft(prompt);
                      draftInputRef.current?.focus();
                    }}
                    onGameAnswer={onGameAnswer}
                    onGameInviteResponse={onGameInviteResponse}
                    isGameCompleted={messages.some((item) =>
                      parseGameEventType(item) === "game_result" &&
                      Number(item?.game_payload?.session_id) === Number(message?.game_payload?.session_id)
                    )}
                    isRespondingGameInvite={respondingInviteId === Number(message?.game_payload?.session_id)}
                    isWaitingForMatch={waitingGameSessionId === Number(message?.game_payload?.session_id)}
                    isYourTurn={yourTurnGameSessionId === Number(message?.game_payload?.session_id)}
                  />
                )
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </section>

      <GameModal
        category={activeGame?.category || selectedGame}
        onAnswer={onModalGameAnswer}
        onPhotoScavengerUpload={onPhotoScavengerUpload}
        wordAssociationState={wordAssociationState}
        onWordAssociationSubmit={onWordAssociationSubmit}
        collaborativePlaylistState={collaborativePlaylistState}
        onCollaborativePlaylistSubmit={onCollaborativePlaylistSubmit}
        mysteryPlaylistMoodState={mysteryPlaylistMoodState}
        onMysteryPlaylistMoodSubmit={onMysteryPlaylistMoodSubmit}
        snakesLaddersState={snakesLaddersState}
        onSnakesLaddersAction={onSnakesLaddersAction}
        bingoState={bingoState}
        onBingoAction={onBingoAction}
        spotDifferenceState={spotDifferenceState}
        onSpotDifferenceAction={onSpotDifferenceAction}
        memoryMatchState={memoryMatchState}
        onMemoryMatchAction={onMemoryMatchAction}
        onClose={closeGameSession}
        onWaiting={(sessionId) => setWaitingGameSessionId(sessionId)}
        waitingForMatch={waitingGameSessionId === Number(activeGame?.session_id)}
        yourTurn={yourTurnGameSessionId === Number(activeGame?.session_id)}
        answeredQuestionIds={answeredGameQuestionIds}
        statementSets={gameStatementSets}
        guessedQuestionIds={guessedGameQuestionIds}
        currentUserId={user?.id}
        partnerName={matchInfo?.user?.name || "Your match"}
        ticTacToeState={ticTacToeState}
        onTicTacToeMove={onTicTacToeMove}
        dotsBoxesState={dotsBoxesState}
        onDotsBoxesMove={onDotsBoxesMove}
        pictionaryState={pictionaryState}
        onPictionaryAction={onPictionaryAction}
        wordSearchState={wordSearchState}
        onWordSearchSelect={onWordSearchSelect}
        unscrambleState={unscrambleState}
        unscrambleFeedback={unscrambleFeedback}
        onUnscrambleSubmit={onUnscrambleSubmit}
        socketError={socket.lastError}
        open={gameOpen}
        questions={activeGame?.questions || []}
        sessionId={activeGame?.session_id}
      />

      <form className="chat-composer" onSubmit={onSend}>
        {replyTo ? (
          <div className="chat-reply-preview">
            <span><strong>Replying to {Number(replyTo.sender_id) === Number(user?.id) ? "yourself" : matchInfo?.user?.name || "your match"}</strong><small>{replyTo.content}</small></span>
            <button aria-label="Cancel reply" onClick={() => setReplyTo(null)} type="button"><X size={16} /></button>
          </div>
        ) : null}
        {shouldShowIcebreakers ? (
          <Icebreaker
            loading={icebreakersLoading}
            onPick={(text) => {
              setDraft(text);
              draftInputRef.current?.focus();
            }}
            suggestions={icebreakers}
          />
        ) : null}

        {showGames ? <div className="chat-game-menu" aria-label="Chat games">
          <div className="chat-game-menu-title"><strong>Play a game</strong><button aria-label="Close games" onClick={() => setShowGames(false)} type="button"><X size={17} /></button></div>
          <p className="chat-game-menu-hint">Pick something quick, or let us surprise you.</p>
          <button className="chat-game-option chat-game-surprise" disabled={Boolean(startingGame) || !socket.isConnected} onClick={() => {
            const choices = GAME_ACTIONS.filter((game) => game.id !== selectedGame);
            const pick = choices[Math.floor(Math.random() * choices.length)];
            if (pick) onStartGame(pick.id);
          }} type="button"><Shuffle size={14} /> Surprise us</button>
          {visibleGames.map((game) => {
            const isActive = selectedGame === game.id;
            const isPending = startingGame === game.id;
            return (
              <button
                className={`chat-game-option ${isActive ? "is-active" : ""}`}
                disabled={Boolean(startingGame) || !socket.isConnected}
                key={game.id}
                onClick={() => onStartGame(game.id)}
                type="button"
              >
                <span>{game.emoji}</span>
                <span>{isPending ? "Sending invite..." : game.label}</span>
              </button>
            );
          })}
          <button className="chat-game-more" onClick={() => setShowAllGames((value) => !value)} type="button">
            {showAllGames ? "Show less" : "See all games"}
          </button>
        </div> : null}

        <div className="chat-compose-row">
          <button aria-expanded={showGames} aria-label="Open games" className="chat-games-trigger" onClick={() => setShowGames((open) => !open)} type="button"><Gamepad2 size={22} /></button>
          <input
            className="chat-message-input"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message..."
            ref={draftInputRef}
            value={draft}
          />
          <button
            className="chat-send-button"
            disabled={sending || !draft.trim()}
            type="submit"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </main>
  );
}
