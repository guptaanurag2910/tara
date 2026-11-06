import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

const TYPE_ICONS = { ladder: "🪜", snake: "🐍", route: "↗️", challenge: "✨", shield: "🛡️", bonus: "🎲", swap: "🪄" };

function squareType(state, square) {
  if (state?.ladders?.[String(square)]) return "ladder";
  if (state?.snakes?.[String(square)]) return "snake";
  if ((state?.route_squares || []).includes(square)) return "route";
  if ((state?.challenge_squares || []).includes(square)) return "challenge";
  const power = state?.power_squares?.[String(square)];
  return power || "";
}

export default function SnakesLaddersGame({ state, sessionId, currentUserId, partnerName = "Your match", onAction, onClose, socketError = "" }) {
  const [pick, setPick] = useState("");
  const [prediction, setPrediction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const positions = state?.positions || {};
  const myPosition = Number(positions[String(currentUserId)] || 0);
  const partnerEntry = Object.entries(positions).find(([id]) => Number(id) !== Number(currentUserId));
  const partnerPosition = Number(partnerEntry?.[1] || 0);
  const myTurn = Number(state?.turn_user_id) === Number(currentUserId);
  const completed = Boolean(state?.completed);
  const challenge = state?.challenge;
  const options = challenge?.options || [];
  const ownSubmitted = challenge?.own_pick != null;
  const turnLabel = completed
    ? Number(state?.winner_user_id) === Number(currentUserId) ? "You won the race! 🏁" : `${partnerName} won the race 🏁`
    : state?.phase === "challenge" ? ownSubmitted ? "Secret pick locked" : "Secret square · both play" : state?.phase === "route_choice" ? "Choose your route" : myTurn ? "Your turn · roll the die" : `${partnerName}’s turn`;

  useEffect(() => { setBusy(false); setError(""); setPick(""); setPrediction(""); }, [state?.last_event, state?.phase]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  function send(action, payload = {}) {
    if (!onAction || busy) return;
    setBusy(true); setError("");
    try {
      if (onAction({ session_id: sessionId, action, ...payload }) === false) throw new Error("Reconnect to continue your game.");
    } catch (err) { setBusy(false); setError(err?.message || "Could not save your move."); }
  }

  const squares = [];
  for (let row = 0; row < 7; row += 1) {
    const rowFromBottom = 6 - row;
    for (let col = 0; col < 7; col += 1) {
      const number = rowFromBottom * 7 + (rowFromBottom % 2 === 0 ? col + 1 : 7 - col);
      const type = squareType(state, number);
      const isMine = myPosition === number;
      const isPartner = partnerPosition === number;
      squares.push(
        <div aria-label={`Square ${number}${type ? `, ${type}` : ""}${isMine ? ", you" : ""}${isPartner ? `, ${partnerName}` : ""}`} className={`relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border p-0.5 text-[9px] sm:rounded-lg sm:text-xs ${type === "challenge" ? "border-violet-200 bg-violet-50" : type === "snake" ? "border-rose-200 bg-rose-50" : type === "ladder" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`} key={number} data-square={number}>
          <span className="absolute left-1 top-0.5 font-bold text-slate-500">{number}</span>
          {type ? <span className="mt-1 text-[11px] sm:text-sm">{TYPE_ICONS[type]}</span> : null}
          {(isMine || isPartner) ? <span className="mt-0.5 flex gap-0.5" aria-label="Player tokens">
            {isMine ? <span title="You" className="grid h-4 w-4 place-items-center rounded-full bg-pink-600 text-[8px] font-black text-white">Y</span> : null}
            {isPartner ? <span title={partnerName} className="grid h-4 w-4 place-items-center rounded-full bg-sky-600 text-[8px] font-black text-white">M</span> : null}
          </span> : null}
        </div>,
      );
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[96dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-3 shadow-2xl sm:p-5" data-testid="snakes-ladders-game">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-pink-600">🐍 Snakes, Ladders & Secrets</p><h2 className="mt-1 text-xl font-black text-slate-900">Race to 49</h2><p className="mt-1 text-xs text-slate-500">Climb ladders, dodge snakes, and predict each other’s picks.</p></div><button aria-label="Close Snakes and Ladders" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-slate-500" onClick={onClose} type="button">×</button></header>
      <div className="mt-3"><GameTurnIndicator status={turnLabel} detail={completed ? "The finished race is saved in chat." : myTurn ? "Your move is ready. Your match can play later." : `${partnerName} can make their move whenever they return.`} isMyTurn={myTurn} gameOver={completed} testId="snakes-ladders-turn-status" players={[
        { name: "You", active: myTurn && !completed, status: `Square ${myPosition || "Start"}${myTurn ? " · Playing now" : ""}` },
        { name: partnerName, active: !myTurn && !completed, status: `Square ${partnerPosition || "Start"}${!myTurn && !completed ? " · Playing now" : ""}` },
      ]} /></div>
      <div aria-label="Snakes and Ladders board" className="mx-auto mt-3 grid w-full max-w-[390px] grid-cols-7 gap-1 rounded-xl bg-slate-100 p-1.5 sm:gap-1.5 sm:p-2" role="grid">{squares}</div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 sm:text-xs"><span>🪜 Ladder</span><span>🐍 Snake</span><span>↗️ Risky fork</span><span>✨ Secret pick</span><span>🛡️ / 🎲 / 🪄 Power</span></div>
      {state?.last_roll ? <p className="mt-3 text-center text-sm font-bold text-slate-700">🎲 Last roll: {state.last_roll} · {state.last_event?.text}</p> : null}
      {!completed && state?.phase === "roll" ? <div className="mt-3 text-center"><button className="rounded-xl bg-pink-600 px-6 py-3 text-sm font-extrabold text-white shadow-md disabled:opacity-50" data-testid="snakes-ladders-roll" disabled={!myTurn || busy} onClick={() => send("roll")} type="button">{busy ? "Rolling…" : myTurn ? "🎲 Roll the die" : `Waiting for ${partnerName}`}</button></div> : null}
      {!completed && state?.phase === "route_choice" && Number(state?.pending_route?.user_id) === Number(currentUserId) ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-center"><p className="text-sm font-bold text-slate-800">Pick your path</p><div className="mt-2 flex justify-center gap-2"><button className="rounded-lg border bg-white px-3 py-2 text-xs font-bold" disabled={busy} onClick={() => send("choose_route", { route: "steady" })} type="button">🌿 Steady · safe</button><button className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white" disabled={busy} onClick={() => send("choose_route", { route: "shortcut" })} type="button">🚀 Shortcut · risky</button></div></div> : null}
      {!completed && state?.phase === "route_choice" && Number(state?.pending_route?.user_id) !== Number(currentUserId) ? <p className="mt-3 text-center text-sm font-semibold text-amber-700">Your match is choosing a route…</p> : null}
      {!completed && state?.phase === "challenge" && challenge ? <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 sm:p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700">✨ Secret square · square {challenge.square}</p><h3 className="mt-1 text-base font-extrabold text-slate-900">{challenge.prompt}</h3>
        {ownSubmitted ? <div className="mt-3 rounded-xl bg-white p-3 text-center"><p className="font-bold text-slate-800">🔒 Your answers are locked in</p><p className="mt-1 text-xs text-slate-500">They’ll both reveal when {partnerName} answers.</p></div> : <>
          <p className="mt-3 text-xs font-bold text-slate-600">Your pick</p><div className="mt-1 grid grid-cols-2 gap-2">{options.map((option) => <button key={`pick-${option}`} className={`rounded-xl border p-2 text-xs font-bold ${pick === option ? "border-violet-500 bg-violet-100 text-violet-800" : "bg-white text-slate-700"}`} onClick={() => setPick(option)} type="button">{option}</button>)}</div>
          <p className="mt-3 text-xs font-bold text-slate-600">What will your match pick?</p><div className="mt-1 grid grid-cols-2 gap-2">{options.map((option) => <button key={`guess-${option}`} className={`rounded-xl border p-2 text-xs font-bold ${prediction === option ? "border-pink-500 bg-pink-50 text-pink-700" : "bg-white text-slate-700"}`} onClick={() => setPrediction(option)} type="button">{option}</button>)}</div>
          <button className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-extrabold text-white disabled:opacity-40" disabled={!pick || !prediction || busy} onClick={() => send("answer_challenge", { pick, prediction })} type="button">Lock in privately</button>
        </>}
        {challenge.reveal ? <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(challenge.reveal.picks || {}).map(([id, answer]) => <div key={id} className="rounded-xl bg-white p-2 text-xs"><b>{Number(id) === Number(currentUserId) ? "You" : partnerName}</b><p>Your pick: {answer}</p><p>Predicted: {challenge.reveal.predictions?.[id]}</p><p className="mt-1 font-bold">{challenge.reveal.correct?.[id] ? "✅ Prediction correct · +1 square" : "Close guess · no bonus"}</p></div>)}</div> : null}
      </div> : null}
      {error ? <p role="alert" className="mt-2 text-center text-xs font-semibold text-rose-600">{error}</p> : null}
    </section>
  </div>;
}
