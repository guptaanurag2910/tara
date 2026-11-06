import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

export default function MemoryMatchGame({ state, sessionId, currentUserId, partnerName = "Your match", onAction, onClose, socketError = "" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const turnUserId = Number(state?.turn_user_id || 0);
  const myTurn = turnUserId === Number(currentUserId);
  const complete = Boolean(state?.completed);
  const mine = Number(state?.scores?.[String(currentUserId)] || 0);
  const theirs = Number(Object.entries(state?.scores || {}).find(([id]) => Number(id) !== Number(currentUserId))?.[1] || 0);
  const lastTurn = state?.last_turn;
  const turnStatus = complete ? state?.draw ? "You matched every pair · it’s a tie 🤝" : Number(state?.winner_user_id) === Number(currentUserId) ? "You found more pairs · you win! 🏆" : `${partnerName} found more pairs 🏆` : myTurn ? "Your turn · flip two cards" : `${partnerName} is remembering`;

  useEffect(() => { setBusy(false); setError(""); }, [state?.phase, state?.moves, state?.completed]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  function flip(cardId) {
    if (!myTurn || complete || busy || !onAction) return;
    setBusy(true); setError("");
    try {
      if (onAction({ session_id: sessionId, action: "flip", card_id: cardId }) === false) throw new Error("Reconnect to continue Memory Match.");
    } catch (err) { setBusy(false); setError(err?.message || "Could not flip that card."); }
  }

  const cards = state?.cards || [];
  const faceUpCount = (state?.face_up || []).length;
  const instruction = complete ? "Your finished board is saved in chat." : state?.phase === "second" && myTurn ? "First card saved · choose one more" : state?.phase === "next_turn" && myTurn ? "Your match missed · flip a card to begin your turn" : myTurn ? "Find a pair. Match them to keep your turn." : "The board is saved. Your match can take their turn whenever they’re back.";

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[96dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-3 shadow-2xl sm:p-5" data-testid="memory-match-game">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-violet-600">🃏 Memory Match · {state?.title || "Little treats"}</p><h2 className="mt-1 text-xl font-black text-slate-900">Find your pairs</h2><p className="mt-1 text-xs text-slate-500">Flip two cards. A match earns a point and another turn.</p></div><button aria-label="Close Memory Match" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-slate-500" onClick={onClose} type="button">×</button></header>
      <div className="mt-3"><GameTurnIndicator status={turnStatus} detail={instruction} isMyTurn={myTurn} gameOver={complete} testId="memory-match-turn" players={[{ name: "You", active: myTurn && !complete, status: `${mine} pair${mine === 1 ? "" : "s"}${myTurn ? " · Your move" : ""}` }, { name: partnerName, active: !myTurn && !complete, status: `${theirs} pair${theirs === 1 ? "" : "s"}${!myTurn && !complete ? " · Their move" : ""}` }]} /></div>
      <div aria-label="Memory Match board" className="mx-auto mt-3 grid w-full max-w-[420px] grid-cols-4 gap-2 rounded-2xl bg-violet-100 p-2 sm:gap-2.5 sm:p-3" data-testid="memory-match-board" role="grid">
        {cards.map((card, index) => {
          const faceUp = Boolean(card.revealed);
          const matched = Boolean(card.matched);
          return <button aria-label={faceUp ? `Card ${index + 1}: ${card.face || "revealed"}${matched ? ", matched" : ""}` : `Card ${index + 1}, face down`} className={`grid aspect-square min-w-0 place-items-center rounded-xl border-2 text-3xl shadow-sm transition duration-200 sm:rounded-2xl sm:text-4xl ${matched ? "border-emerald-300 bg-emerald-50" : faceUp ? "border-violet-300 bg-white" : myTurn && !complete && !busy ? "border-violet-200 bg-violet-700 text-white hover:-translate-y-0.5 hover:bg-violet-600" : "border-violet-200 bg-violet-700 text-white"}`} data-testid={`memory-card-${card.id}`} disabled={!myTurn || complete || busy || faceUp || matched} key={card.id} onClick={() => flip(card.id)} role="gridcell" type="button">{faceUp ? card.face : <span aria-hidden="true" className="text-xl opacity-90">✦</span>}</button>;
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500"><span>{state?.moves || 0} turns played</span><span>{state?.cards?.filter((card) => card.matched).length / 2 || 0} / {cards.length / 2 || 8} pairs found</span></div>
      {!complete && lastTurn ? <div aria-live="polite" className={`mt-2 rounded-xl p-3 text-center text-sm font-bold ${lastTurn.matched ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} data-testid="memory-match-feedback">{lastTurn.matched ? "A match! You get another turn ✨" : Number(lastTurn.user_id) === Number(currentUserId) ? `${partnerName} gets the next turn. The cards will stay visible until they flip.` : "No pair this time · your turn! The cards stay visible until you flip."}</div> : null}
      {complete ? <div className="mt-3 rounded-xl bg-violet-50 p-3 text-center text-sm font-bold text-violet-900">{state.draw ? "You found the same number of pairs. Great teamwork! 🤝" : Number(state.winner_user_id) === Number(currentUserId) ? "Your memory was on point! 🏆" : `${partnerName} found more pairs. Rematch? 🃏`}</div> : faceUpCount === 1 && myTurn ? <p className="mt-2 text-center text-[11px] font-semibold text-violet-600">One card revealed · flip one more</p> : null}
      {error ? <p className="mt-2 text-center text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}
    </section>
  </div>;
}
