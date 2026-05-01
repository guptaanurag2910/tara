import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import GameModal from "../components/chat/GameModal";
import GameResultCard from "../components/chat/GameResultCard";
import EmptyState from "../components/EmptyState";
import Icebreaker from "../components/Icebreaker";
import Loader from "../components/Loader";
import MessageBubble from "../components/MessageBubble";
import { useAuth } from "../hooks/useAuth";
import { useChatSocket } from "../hooks/useChatSocket";
import { fetchMatchDetail, fetchMatchIcebreakers, fetchMatches } from "../services/matchingService";
import { fetchMatchMessages, sendMatchMessage } from "../services/chatService";
import { submitGameAnswer } from "../services/gameService";

const GAME_ACTIONS = [
  { id: "this_or_that", label: "This or That", emoji: "⚖️" },
  { id: "predict_me", label: "Predict Me", emoji: "🔮" },
  { id: "deal_breaker", label: "Deal Breaker", emoji: "💔" },
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
    timestamp: raw.timestamp || raw.created_at,
    status: normalizeStatus(raw.status, isRead),
    is_read: isRead,
  };
}

function messageIdentity(message) {
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
    questions: result.questions.map((item) => ({
      ...item,
      user_a: item?.user_b ?? null,
      user_b: item?.user_a ?? null,
    })),
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

  return "now";
}

function firstSentence(text) {
  const sentence = String(text || "").split(/[.!?]/)[0]?.trim();
  return sentence || "Say hi and start your cosmic conversation ✨";
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
    <div className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full border border-amber-200/40 bg-[#14144e]">
      {photo ? (
        <img alt={name || "Match"} className="h-full w-full object-cover" src={photo} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/70 to-amber-300/70 text-sm font-semibold text-white">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

function ConversationsList({ loading, error, conversations, query, setQuery }) {
  return (
    <main className="tara-container px-5 pb-28 pt-8">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Whispers</p>
        <h1 className="tara-heading mt-2 text-6xl leading-none">Conversations</h1>
      </header>

      <div className="relative mt-4">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[color:var(--tara-text-faint)]">⌕</span>
        <input
          className="h-12 w-full rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] pl-12 pr-4 text-[15px] text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:border-indigo-300/35 focus:outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search messages"
          value={query}
        />
      </div>

      {loading ? <Loader text="Loading conversations..." /> : null}
      {error ? <p className="mt-4 rounded-xl bg-rose-500/20 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      {!loading && !error && conversations.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Start a conversation 👀" />
        </div>
      ) : null}

      {!loading && conversations.length > 0 ? (
        <section className="mt-5 space-y-2">
          {conversations.map((item, index) => (
            <Link
              className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-white/5"
              key={item.match_id}
              to={`/chat/${item.match_id}`}
            >
              <div className="relative">
                <Avatar name={item.user?.name} photo={item.user?.photo} />
                {index < 2 ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-300" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="tara-heading truncate text-[2rem] leading-none">{item.user?.name || "Match"}</p>
                <p className="mt-1 truncate text-[15px] text-[color:var(--tara-text-secondary)]">{item.preview}</p>
              </div>

              <p className="self-start pt-1 text-[13px] text-[color:var(--tara-text-faint)]">{item.timeLabel}</p>
            </Link>
          ))}
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
  const [draft, setDraft] = useState("");
  const [icebreakers, setIcebreakers] = useState([]);
  const [icebreakersLoading, setIcebreakersLoading] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState("this_or_that");
  const [startingGame, setStartingGame] = useState("");
  const [pendingGameStart, setPendingGameStart] = useState("");
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [answeringByQuestion, setAnsweringByQuestion] = useState({});
  const [error, setError] = useState("");
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const endRef = useRef(null);
  const draftInputRef = useRef(null);

  const hasMatch = Boolean(matchId);
  const socket = useChatSocket({
    matchId,
    enabled: hasMatch,
    onMessage: (payload) => {
      if (payload?.event === "read_receipt") {
        setMessages((prev) => applyReadReceipt(prev, payload));
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
          String(message.message_type || "text") === "text",
      ),
    [messages, user?.id],
  );

  const shouldShowIcebreakers = Boolean(
    hasMatch && !loading && !firstMessageSent && !hasUserSentMessage,
  );

  const questionAnswersById = useMemo(() => buildQuestionAnswersMap(messages), [messages]);
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
          safeList.slice(0, 12).map(async (match, index) => {
            try {
              const history = await fetchMatchMessages(match.match_id);
              const safeHistory = Array.isArray(history) ? history : [];
              const last = safeHistory[safeHistory.length - 1];

              return {
                ...match,
                preview: String(last?.content || "").trim() || firstSentence(match.insight),
                timeLabel: formatTimeLabel(last?.timestamp || last?.created_at, index),
              };
            } catch {
              return {
                ...match,
                preview: firstSentence(match.insight),
                timeLabel: formatTimeLabel(null, index),
              };
            }
          }),
        );

        const tail = safeList.slice(12).map((match, index) => ({
          ...match,
          preview: firstSentence(match.insight),
          timeLabel: formatTimeLabel(null, index + 2),
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
    const startedEvent = socket.events?.game_started;
    if (!startedEvent?.session_id) {
      return;
    }
    if (startedEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(startedEvent.message)));
    }
    setActiveGame(startedEvent);
    setSelectedGame(startedEvent.category || "this_or_that");
    setStartingGame("");
    setGameOpen(true);
  }, [socket.events?.game_started]);

  useEffect(() => {
    const resultEvent = socket.events?.game_result;
    if (!resultEvent?.result) {
      return;
    }
    if (resultEvent?.message) {
      setMessages((prev) => mergeMessage(prev, normalizeMessage(resultEvent.message)));
    }
    setGameOpen(false);
    setStartingGame("");
    setActiveGame(null);
  }, [socket.events?.game_result]);

  useEffect(() => {
    if (!socket.lastError) {
      return;
    }
    setStartingGame("");
    setPendingGameStart("");
  }, [socket.lastError]);

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
    if (!hasMatch) {
      setLoading(false);
      return;
    }

    async function loadChat() {
      setLoading(true);
      setError("");
      setFirstMessageSent(false);
      setAnsweringByQuestion({});
      setIcebreakers([]);
      setIcebreakersLoading(true);
      try {
        const [detail, history, suggestionList] = await Promise.all([
          fetchMatchDetail(matchId),
          fetchMatchMessages(matchId),
          fetchMatchIcebreakers(matchId).catch(() => []),
        ]);
        setMatchInfo(detail);
        setMessages(Array.isArray(history) ? history.map(normalizeMessage) : []);
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
        setMessages(Array.isArray(history) ? history.map(normalizeMessage) : []);
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

  function onStartGame(category) {
    const gameId = String(category || "").trim();
    if (!gameId) {
      return;
    }

    setError("");
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

  async function onSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !hasMatch || sending) {
      return;
    }

    setSending(true);
    setError("");
    const clientMessageId = createClientMessageId();
    setMessages((prev) =>
      mergeMessage(prev, {
        id: null,
        client_message_id: clientMessageId,
        sender_id: user?.id,
        content: text,
        timestamp: new Date().toISOString(),
        status: "sent",
        is_read: false,
      }),
    );
    try {
      const sentViaSocket = socket.sendMessage(text, clientMessageId);
      if (!sentViaSocket) {
        const created = await sendMatchMessage(matchId, text, clientMessageId);
        setMessages((prev) => mergeMessage(prev, normalizeMessage(created)));
      }
      setFirstMessageSent(true);
      setDraft("");
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
        error={conversationError}
        loading={conversationLoading}
        query={conversationQuery}
        setQuery={setConversationQuery}
      />
    );
  }

  return (
    <main className="tara-container flex h-[calc(100dvh-112px)] flex-col sm:h-[calc(100dvh-96px)]">
      <header className="border-b border-[color:var(--tara-card-border)] bg-[color:var(--tara-card-bg)] px-4 py-3 backdrop-blur-xl">
        <p className="tara-heading text-[1.35rem] leading-none">{matchInfo?.user?.name || "Chat"}</p>
        <p className="tara-copy mt-1 text-sm italic">✧ {insightText}</p>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? <Loader text="Loading messages..." /> : null}
        {error ? <p className="mb-3 rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
        {!error && socket.lastError ? (
          <p className="mb-3 rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-100">{socket.lastError}</p>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="w-full max-w-xs">
              <EmptyState compact title="Start a conversation 👀" />
            </div>
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
                    onGameAnswer={onGameAnswer}
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
        onClose={() => setGameOpen(false)}
        open={gameOpen}
        questions={activeGame?.questions || []}
        sessionId={activeGame?.session_id}
      />

      <form className="border-t border-[color:var(--tara-card-border)] bg-[color:var(--tara-card-bg)] px-3 py-3 backdrop-blur-xl" onSubmit={onSend}>
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

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {GAME_ACTIONS.map((game) => {
            const isActive = selectedGame === game.id;
            const isPending = startingGame === game.id;
            return (
              <button
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-all ${
                  isActive
                    ? "border-[color:var(--tara-gold)] bg-[color:var(--tara-card-bg)] text-[color:var(--tara-text-primary)]"
                    : "border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] text-[color:var(--tara-text-secondary)]"
                } ${!socket.isConnected ? "opacity-60" : ""}`}
                disabled={Boolean(startingGame) || !socket.isConnected}
                key={game.id}
                onClick={() => onStartGame(game.id)}
                type="button"
              >
                <span>{game.emoji}</span>
                <span>{isPending ? "Starting..." : game.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            className="h-11 flex-1 rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)] px-4 text-sm text-[color:var(--tara-text-primary)] placeholder:text-[color:var(--tara-text-faint)] focus:border-indigo-200/45 focus:outline-none"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message..."
            ref={draftInputRef}
            value={draft}
          />
          <button
            className="tara-primary-btn inline-flex h-11 min-w-[74px] items-center justify-center px-4 text-sm font-semibold text-white disabled:opacity-60"
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
