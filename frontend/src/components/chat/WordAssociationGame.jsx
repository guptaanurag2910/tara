import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

export default function WordAssociationGame({
  state,
  sessionId,
  currentUserId,
  partnerName = "Your match",
  onSubmit,
  socketError = "",
  onClose,
}) {
  const [word, setWord] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const chain = Array.isArray(state?.chain) ? state.chain : [];
  const yourTurn = Number(state?.turn_user_id) === Number(currentUserId);
  const completed = Boolean(state?.completed);
  const targetTurns = Number(state?.target_turns || 6);
  const turnsPlayed = Number(state?.turns_played || 0);

  useEffect(() => {
    setWord("");
    setSubmitting(false);
    setError("");
  }, [sessionId, turnsPlayed]);

  useEffect(() => {
    if (socketError) {
      setSubmitting(false);
      setError(socketError);
    }
  }, [socketError]);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleaned = word.trim();
    if (!cleaned || !onSubmit || submitting) return;
    if (!/^[\p{L}\p{N}_'-]{1,30}$/u.test(cleaned)) {
      setError("Use one word with up to 30 letters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const sent = await onSubmit({ session_id: sessionId, word: cleaned });
      if (sent === false) throw new Error("Reconnect to add your word.");
      setWord("");
    } catch (submitError) {
      setSubmitting(false);
      setError(submitError?.message || "Could not add your word. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-5 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)]" data-testid="word-association-game">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">Word Association</p>
            <p className="mt-1 text-sm text-[#737373]">Add the first word that comes to mind. Take turns and build a chain together.</p>
          </div>
          <button aria-label="Close Word Association" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbdbdb] text-lg text-[#737373]" onClick={onClose} type="button">×</button>
        </header>

        <div className="mt-4 h-[3px] w-full rounded-full bg-[#efefef]"><div className="h-[3px] rounded-full bg-gradient-to-r from-[#f77737] via-[#e1306c] to-[#0095f6] transition-all" style={{ width: `${Math.min(100, Math.round((turnsPlayed / targetTurns) * 100))}%` }} /></div>
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-[#737373]">{completed ? "Your shared chain" : `Turn ${turnsPlayed + 1} of ${targetTurns}`}</p>

        <div aria-label="Word association chain" className="mt-3 flex flex-wrap items-center justify-center gap-2" data-testid="word-association-chain">
          {chain.map((entry, index) => {
            const owner = Number(entry.user_id) === Number(currentUserId) ? "You" : entry.user_id ? partnerName : "Start";
            return <div className="flex items-center gap-2" key={`${index}-${entry.word}`}>
              {index > 0 ? <span aria-hidden="true" className="text-[#c6c6c6]">→</span> : null}
              <div className={`rounded-2xl border px-3 py-2 text-center ${index === 0 ? "border-[#f4c8d8] bg-[#fff4f8]" : owner === "You" ? "border-[#f4c8d8] bg-[#fff9fb]" : "border-[#cfe4f4] bg-[#f5faff]"}`}>
                <p className="text-base font-bold capitalize text-[#262626]">{entry.word}</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#8a8a8a]">{owner}</p>
              </div>
            </div>;
          })}
        </div>

        {!completed ? <div className="mt-5">
          <GameTurnIndicator
            status={yourTurn ? "Your turn" : `${partnerName}’s turn`}
            detail={yourTurn ? `What word comes to mind after “${chain.at(-1)?.word || "the starter"}”?` : "Your match will add the next word when they’re ready."}
            isMyTurn={yourTurn}
            testId="word-association-turn-status"
            players={[
              { name: "You", active: yourTurn, status: yourTurn ? "Add a word now" : "Up next" },
              { name: partnerName, active: !yourTurn, status: !yourTurn ? "Add a word now" : "Up next" },
            ]}
          />
          {yourTurn ? <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <input aria-label="Your associated word" autoComplete="off" autoFocus className="w-full rounded-[14px] border border-[#dbdbdb] bg-[#fafafa] px-4 py-3 text-center text-lg text-[#262626] outline-none focus:border-[#e1306c]" maxLength={30} onChange={(event) => setWord(event.target.value)} placeholder="Your first word…" value={word} />
            <p className="text-center text-xs text-[#737373]">One word only. Your match sees the chain after each turn.</p>
            <button className="w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!word.trim() || submitting} type="submit">{submitting ? "Adding…" : "Add my word"}</button>
          </form> : null}
        </div> : <div className="mt-5 rounded-2xl bg-[#fff3f7] px-4 py-4 text-center"><p className="text-sm font-semibold text-[#a52b55]">You built this chain together ✨</p><p className="mt-1 text-sm text-[#7d5261]">Six turns, six associations. Keep the conversation going!</p></div>}

        {error ? <p className="mt-3 text-center text-xs text-[#d62964]">{error}</p> : null}
      </section>
    </div>
  );
}
