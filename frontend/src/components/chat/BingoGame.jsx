import { useEffect, useMemo, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

const LETTERS = ["B", "I", "N", "G", "O"];

export default function BingoGame({ state, sessionId, currentUserId, partnerName = "Your match", onAction, onClose, socketError = "" }) {
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const userKey = String(currentUserId);
  const card = state?.cards?.[userKey] || [];
  const turnUserId = Number(state?.turn_user_id || 0);
  const myTurn = turnUserId === Number(currentUserId);
  const pending = state?.pending;
  const isCaller = Number(pending?.caller_id) === Number(currentUserId);
  const isAnswerer = Number(pending?.answerer_id) === Number(currentUserId);
  const awaitingAnswer = state?.phase === "answer" && isCaller;
  const answering = state?.phase === "answer" && isAnswerer;
  const completed = Boolean(state?.completed);
  const selectedCell = useMemo(() => card.find((cell) => Number(cell.prompt_id) === Number(selectedPromptId)), [card, selectedPromptId]);
  const myCount = Number(state?.correct_counts?.[userKey] || 0);
  const partnerEntry = Object.entries(state?.correct_counts || {}).find(([id]) => Number(id) !== Number(currentUserId));
  const partnerCount = Number(partnerEntry?.[1] || 0);
  const turnStatus = completed
    ? state?.draw ? "It’s a tie! You read each other equally well 🤝" : Number(state?.winner_user_id) === Number(currentUserId) ? "Bingo! You won 🎯" : `${partnerName} called Bingo 🎯`
    : awaitingAnswer ? `Waiting for ${partnerName} to answer`
      : answering ? "Your turn · answer the prompt"
        : myTurn ? "Your turn · choose a square"
          : `${partnerName}’s turn`;

  useEffect(() => { setBusy(false); setError(""); setChoice(""); setSelectedPromptId(null); }, [state?.phase, state?.turns_played, state?.last_reveal]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  function submit(action, payload) {
    if (!onAction || busy) return;
    setBusy(true); setError("");
    try {
      if (onAction({ session_id: sessionId, action, ...payload }) === false) throw new Error("Reconnect to continue Bingo.");
    } catch (err) { setBusy(false); setError(err?.message || "Could not save your Bingo move."); }
  }

  const marked = (card || []).filter((cell) => cell.correct && !cell.free).length;
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[96dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-3 shadow-2xl sm:p-5" data-testid="bingo-game">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-pink-600">🎯 Bingo · Are We in Sync?</p><h2 className="mt-1 text-xl font-black text-slate-900">Guess their pick</h2><p className="mt-1 text-xs text-slate-500">Pick a square, predict your match, and earn a stamp for a correct guess.</p></div><button aria-label="Close Bingo" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-slate-500" onClick={onClose} type="button">×</button></header>

      <div className="mt-3"><GameTurnIndicator status={turnStatus} detail={completed ? "Your final cards are saved in chat." : awaitingAnswer ? "Your prediction stays secret until they answer." : answering ? "Your match has locked a prediction. Choose your answer." : myTurn ? "Choose any available square on your card." : "Your board is saved. You can return when it’s your turn."} isMyTurn={myTurn || answering} gameOver={completed} testId="bingo-turn-status" players={[
        { name: "You", active: (myTurn || answering) && !completed, status: `${myCount} correct${(myTurn || answering) ? " · Your move" : ""}` },
        { name: partnerName, active: !myTurn && !answering && !completed, status: `${partnerCount} correct${!myTurn && !answering && !completed ? " · Their move" : ""}` },
      ]} /></div>

      <div aria-label="Your Bingo card" className="mx-auto mt-3 grid w-full max-w-[440px] grid-cols-5 gap-1 rounded-2xl bg-violet-100 p-1.5 sm:gap-1.5 sm:p-2" data-testid="bingo-board" role="grid">
        {LETTERS.map((letter) => <div className="grid aspect-square place-items-center rounded-lg bg-violet-700 text-sm font-black text-white" key={letter} role="columnheader">{letter}</div>)}
        {card.map((cell, index) => {
          const selected = Number(cell.prompt_id) === Number(selectedPromptId);
          const description = cell.free ? "Free square, already stamped" : cell.correct ? "Marked correct" : cell.called ? "Already played" : `Available · ${cell.prompt}`;
          return <button aria-label={description} aria-pressed={selected} className={`relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border p-1 text-center transition ${cell.free ? "border-amber-300 bg-amber-100 text-amber-800" : cell.correct ? "border-emerald-300 bg-emerald-100 text-emerald-900" : cell.called ? "border-slate-200 bg-slate-100 text-slate-400" : selected ? "border-pink-500 bg-pink-50 text-pink-800 ring-2 ring-pink-300" : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"}`} data-testid={cell.free ? "bingo-free-square" : `bingo-square-${cell.prompt_id}`} disabled={cell.free || cell.called || !myTurn || state?.phase !== "predict" || completed} key={`${cell.prompt_id ?? "free"}-${index}`} onClick={() => { setSelectedPromptId(cell.prompt_id); setChoice(""); }} role="gridcell" type="button">
            <span className="line-clamp-3 text-[8px] font-bold leading-tight sm:text-[10px]">{cell.free ? "FREE ✨" : cell.correct ? `✓ ${cell.prompt}` : cell.called ? `· ${cell.prompt}` : cell.prompt}</span>
            {cell.correct ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 text-[9px]">💜</span> : null}
          </button>;
        })}
      </div>
      <p className="mt-2 text-center text-[11px] font-semibold text-slate-500">{marked} correct stamp{marked === 1 ? "" : "s"} · First to 5 in a line wins</p>

      {!completed && state?.phase === "predict" && myTurn && selectedCell ? <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 sm:p-4" data-testid="bingo-prediction-panel">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">Your square</p><h3 className="mt-1 text-base font-extrabold text-slate-900">{selectedCell.prompt}</h3>
        <p className="mt-3 text-xs font-bold text-slate-600">What will {partnerName} pick?</p>
        <div className="mt-1 grid grid-cols-2 gap-2">{selectedCell.options.map((option) => <button aria-pressed={choice === option} className={`rounded-xl border p-2 text-xs font-bold ${choice === option ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 bg-white text-slate-700"}`} data-testid="bingo-prediction-option" key={option} onClick={() => setChoice(option)} type="button">{option}</button>)}</div>
        <button className="mt-3 w-full rounded-xl bg-violet-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-40" disabled={!choice || busy} onClick={() => submit("make_prediction", { prompt_id: selectedCell.prompt_id, prediction: choice })} type="button">Lock prediction</button>
      </div> : null}

      {!completed && awaitingAnswer && pending ? <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 sm:p-4" data-testid="bingo-answer-panel"><p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Your match picked a square</p><h3 className="mt-1 text-base font-extrabold text-slate-900">{pending.prompt}</h3><p className="mt-2 text-center text-sm font-bold text-sky-800">🔒 Their guess is hidden. Choose your answer when you’re ready.</p></div> : null}

      {!completed && answering && pending ? <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 sm:p-4" data-testid="bingo-answer-panel"><p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Your match is guessing</p><h3 className="mt-1 text-base font-extrabold text-slate-900">{pending.prompt}</h3><p className="mt-2 text-xs font-bold text-slate-600">What’s your answer?</p><div className="mt-2 grid grid-cols-2 gap-2">{(pending.options || []).map((option) => <button className={`rounded-xl border p-2 text-xs font-bold ${choice === option ? "border-sky-500 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-700"}`} data-testid="bingo-answer-option" key={option} onClick={() => setChoice(option)} type="button">{option}</button>)}</div><button className="mt-3 w-full rounded-xl bg-sky-700 py-2.5 text-sm font-extrabold text-white disabled:opacity-40" disabled={!choice || busy} onClick={() => submit("answer_prompt", { answer: choice })} type="button">Reveal both answers</button></div> : null}

      {state?.last_reveal ? <div aria-live="polite" className={`mt-3 rounded-xl p-3 text-center ${state.last_reveal.correct ? "bg-emerald-50" : "bg-amber-50"}`} data-testid="bingo-last-reveal"><p className="text-xs font-extrabold text-slate-800">{state.last_reveal.correct ? "🎉 Correct prediction · stamp earned!" : "So close · no stamp this time"}</p><p className="mt-1 text-xs text-slate-600">{state.last_reveal.prompt}</p><p className="mt-1 text-xs text-slate-700">You guessed <b>{state.last_reveal.prediction}</b> · They picked <b>{state.last_reveal.answer}</b></p></div> : null}
      {completed ? <div className="mt-3 rounded-xl bg-violet-50 p-3 text-center text-sm font-bold text-violet-900">{state.draw ? "A perfect tie—you know each other equally well! 🤝" : Number(state.winner_user_id) === Number(currentUserId) ? "Bingo! You read your match and completed a line. 🎯" : `${partnerName} completed a line first. Rematch? 🎯`}</div> : null}
      {error ? <p className="mt-2 text-center text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}
    </section>
  </div>;
}
