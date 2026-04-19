import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../../hooks/useAuth";
import { useChatSocket } from "../../hooks/useChatSocket";
import GameModal from "./GameModal";
import GameResultCard from "./GameResultCard";
import MessageBubble from "./MessageBubble";

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const GAME_ACTIONS = [
  { id: "this_or_that", label: "This or That", emoji: "⚖️" },
  { id: "predict_me", label: "Predict Me", emoji: "🔮" },
  { id: "deal_breaker", label: "Deal Breaker", emoji: "💔" },
];

export default function ChatScreen({
  matchId,
  title = "Meera",
  subtitle = "82% aligned",
  partnerLabel = "Partner",
  onBack,
}) {
  const { user } = useAuth();
  const endRef = useRef(null);

  const [draft, setDraft] = useState("");
  const [gameOpen, setGameOpen] = useState(false);
  const [activeGame, setActiveGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState("this_or_that");
  const [resultCards, setResultCards] = useState([]);

  const socket = useChatSocket(matchId);
  const messages = Array.isArray(socket.messages) ? socket.messages : [];
  const textMessages = useMemo(
    () => messages.filter((item) => String(item?.message_type || "text") === "text"),
    [messages],
  );

  useEffect(() => {
    if (!socket.events?.game_started) {
      return;
    }
    setActiveGame(socket.events.game_started);
    setGameOpen(true);
  }, [socket.events?.game_started]);

  useEffect(() => {
    const resultEvent = socket.events?.game_result;
    if (!resultEvent?.result) {
      return;
    }
    setGameOpen(false);
    setResultCards((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        category: activeGame?.category || selectedGame,
        result: resultEvent.result,
      },
      ...prev,
    ]);
  }, [socket.events?.game_result, activeGame?.category, selectedGame]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [textMessages.length, resultCards.length]);

  function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    const sent = socket.sendMessage(text, createClientMessageId());
    if (sent) {
      setDraft("");
    }
  }

  async function handleAnswer(payload) {
    const sent = socket.answerQuestion(payload);
    if (!sent) {
      throw new Error("Could not submit answer on live socket.");
    }
  }

  function handleGameStart(gameId) {
    setSelectedGame(gameId);
    socket.startGame(gameId);
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-cosmic text-white">
      <div className="star-field pointer-events-none absolute inset-0 opacity-65" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-glow blur-3xl" />

      <header className="relative z-20 border-b border-white/10 bg-[#0d1144]/70 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-[#131952]/70 text-lg text-white/80 transition-colors hover:text-white"
            onClick={onBack}
            type="button"
          >
            ←
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#7b78ff] to-[#d8b86a] text-sm font-semibold text-white">
            {String(title || "T")
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-xl leading-none text-white">{title}</p>
            <p className="mt-1 text-xs tracking-wide text-[#d7be72]">✦ {subtitle}</p>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-sm text-white/75">📞</button>
          <button className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-sm text-white/75">📹</button>
        </div>
      </header>

      <section className="relative z-10 flex-1 overflow-y-auto px-4 pb-36 pt-5">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full border border-white/10 bg-[#1a1f64]/70 px-3 py-1 text-[10px] tracking-[0.17em] text-white/65">
            YOU MATCHED TODAY
          </span>
        </div>

        {textMessages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-white/55">Say something cosmic to begin.</p>
        ) : (
          <div className="space-y-3">
            {textMessages.map((message, index) => (
              <MessageBubble
                isOwn={Number(message?.sender_id) === Number(user?.id)}
                key={message?.id || message?.client_message_id || `msg-${index}`}
                message={message}
              />
            ))}
          </div>
        )}

        {resultCards.length > 0 ? (
          <div className="mt-5 space-y-3">
            {resultCards.map((item) => (
              <GameResultCard
                category={item.category}
                key={item.id}
                partnerLabel={partnerLabel}
                result={item.result}
                userLabel="You"
              />
            ))}
          </div>
        ) : null}

        <div ref={endRef} />
      </section>

      <div className="pointer-events-none absolute inset-x-0 bottom-[86px] z-10 h-12 bg-gradient-to-t from-[#090b35] to-transparent" />

      <form
        className="fixed bottom-0 left-1/2 z-30 w-full max-w-md border-t border-white/10 bg-[#0d1144]/92 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-xl"
        onSubmit={handleSend}
      >
        <div className="mb-3 flex items-center gap-2">
          {GAME_ACTIONS.map((game) => {
            const active = selectedGame === game.id;
            return (
              <button
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-all ${
                  active
                    ? "border-[#d7be72]/70 bg-[#20256c] text-white"
                    : "border-white/20 bg-[#121753]/70 text-white/80"
                }`}
                key={game.id}
                onClick={() => handleGameStart(game.id)}
                type="button"
              >
                <span>{game.emoji}</span>
                <span>{game.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#d7be72]">
              ✨
            </span>
            <input
              className="h-11 w-full rounded-full border border-[#2f347b] bg-[#0f1450]/80 pl-9 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#6f75ff] focus:outline-none"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write something cosmic..."
              value={draft}
            />
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-r from-[#6e6bff] to-[#9da2ff] text-lg text-white shadow-[0_8px_24px_rgba(87,89,255,0.45)] transition-transform active:scale-[0.98]"
            type="submit"
          >
            ➤
          </button>
        </div>
      </form>

      <GameModal
        category={activeGame?.category}
        onAnswer={handleAnswer}
        onClose={() => setGameOpen(false)}
        open={gameOpen}
        questions={activeGame?.questions || []}
        sessionId={activeGame?.session_id}
      />
    </main>
  );
}
