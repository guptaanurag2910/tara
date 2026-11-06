import { useEffect, useRef, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

function Drawing({ strokes = [], interactive = false, onStroke }) {
  const active = useRef(false);
  const svgRef = useRef(null);
  const shown = strokes;

  function point(event) {
    const bounds = svgRef.current.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    return [Math.max(0, Math.min(1, (event.clientX - bounds.left) / width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / height))];
  }
  function start(event) {
    if (!interactive) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in a few embedded browsers; drawing can continue in place.
    }
    active.current = true;
    const firstPoint = point(event);
    onStroke?.((previous = []) => [...previous, { points: [firstPoint] }]);
  }
  function move(event) {
    if (!interactive || !active.current) return;
    const nextPoint = point(event);
    onStroke?.((previous = []) => previous.map((stroke, index) => index === previous.length - 1
      ? { points: [...(stroke.points || []), nextPoint] } : stroke));
  }
  function stop() { active.current = false; }

  return <svg aria-label={interactive ? "Drawing canvas" : "Drawing preview"} data-testid={interactive ? "pictionary-drawing-canvas" : undefined} ref={svgRef} viewBox="0 0 1 1" preserveAspectRatio="none" className={`h-full w-full touch-none ${interactive ? "cursor-crosshair" : ""}`} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}>
    {shown.map((stroke, index) => <polyline key={index} points={(stroke.points || []).map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#e1306c" strokeWidth="0.008" strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

export default function PictionaryGame({ state, sessionId, partnerName = "Your match", onAction, onClose, socketError = "" }) {
  const [strokes, setStrokes] = useState([]);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const phase = state?.phase || "drawing";
  const current = state?.current || {};
  const isDrawer = Boolean(state?.is_drawer);
  const scoreMap = state?.scores || {};
  const yourScore = Number(scoreMap[String(state?.your_user_id)] || 0);
  const otherScore = Object.entries(scoreMap).find(([id]) => Number(id) !== Number(state?.your_user_id))?.[1] || 0;
  const isMyTurn = (phase === "drawing" && isDrawer) || (phase === "guessing" && !isDrawer);
  const turnStatus = phase === "completed"
    ? "Both turns complete"
    : phase === "drawing"
      ? isDrawer ? "Your turn to draw" : `${partnerName}’s turn to draw`
      : isDrawer ? `${partnerName}’s turn to guess` : "Your turn to guess";
  const turnDetail = phase === "completed"
    ? "Both drawings are saved below."
    : phase === "drawing"
      ? isDrawer ? "Draw your secret word, then send it for your match to guess." : `${partnerName} is drawing. You can close this and come back when it’s ready.`
      : isDrawer ? "Your drawing is sent. Your match can guess whenever they’re ready." : "Look at the drawing and enter your guess below.";
  const youStatus = phase === "completed" ? "Finished"
    : phase === "drawing" ? isDrawer ? "Drawing now" : "Waiting for drawing"
      : isDrawer ? "Waiting for guess" : "Guessing now";
  const partnerStatus = phase === "completed" ? "Finished"
    : phase === "drawing" ? isDrawer ? "Up next to guess" : "Drawing now"
      : isDrawer ? "Guessing now" : "Up next to draw";

  useEffect(() => { setBusy(false); setGuess(""); setError(""); setStrokes([]); }, [state?.round_index, phase, state?.current?.strokes]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  async function submit(action, payload) {
    setBusy(true); setError("");
    try {
      const sent = await onAction?.(action, { session_id: sessionId, ...payload });
      if (sent === false) throw new Error("Reconnect to continue the game.");
    } catch (submitError) {
      setBusy(false); setError(submitError?.message || "Could not update the game.");
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-4 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5" data-testid="pictionary-modal">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">✏️ Pictionary · Round {Math.min(Number(state?.round_index || 0) + 1, 2)} of 2</p><h2 className="mt-1 text-xl font-bold text-[#262626]">Draw and guess together</h2><p className="mt-1 text-sm text-[#737373]">Take turns whenever you’re both around.</p></div>
        <button aria-label="Close Pictionary" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-[#737373]" onClick={onClose} type="button">×</button>
      </header>
      <div className="mt-3">
        <GameTurnIndicator
          status={turnStatus}
          detail={turnDetail}
          isMyTurn={isMyTurn}
          gameOver={phase === "completed"}
          testId="pictionary-turn-status"
          players={[
            { name: "You", active: isMyTurn, status: `${yourScore} points · ${youStatus}` },
            { name: partnerName, active: !isMyTurn && phase !== "completed", status: `${otherScore} points · ${partnerStatus}` },
          ]}
        />
      </div>

      {phase === "completed" ? <div className="mt-4 space-y-3">{(state?.rounds || []).map((round, index) => <div key={index} className="rounded-xl border p-3"><p className="text-xs font-bold uppercase text-[#737373]">Round {index + 1} · {round.solved ? "Guessed!" : "Revealed"}</p><p className="mt-1 font-bold text-[#262626]">{round.prompt}</p><div className="mt-2 aspect-[4/3] overflow-hidden rounded-lg bg-[#fffafc]"><Drawing strokes={round.strokes} /></div><p className="mt-2 text-sm text-[#737373]">Guess: {round.guess || "—"}</p></div>)}</div> : null}

      {phase !== "completed" && isDrawer ? <div className="mt-4">
        <div className="rounded-xl bg-[#fff3f7] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#e1306c]">Your secret word</p><p className="mt-1 text-xl font-bold text-[#262626]">{state?.prompt || "Loading prompt…"}</p><p className="mt-1 text-xs text-[#737373]">Keep it secret. Draw it without letters or numbers.</p></div>
        <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed border-[#e7d5dd] bg-[#fffdfd]"><Drawing interactive onStroke={setStrokes} strokes={strokes} /></div>
        <div className="mt-2 flex gap-2"><button className="flex-1 rounded-full border px-3 py-2 text-sm font-semibold text-[#737373]" onClick={() => setStrokes((items) => items.slice(0, -1))} type="button">Undo</button><button className="flex-1 rounded-full border px-3 py-2 text-sm font-semibold text-[#737373]" onClick={() => setStrokes([])} type="button">Clear</button></div>
        <button className="mt-3 w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !strokes.length} onClick={() => submit("drawing", { strokes })} type="button">{busy ? "Sending drawing…" : "Send drawing"}</button>
      </div> : null}

      {phase === "drawing" && !isDrawer ? <div className="mt-5 rounded-2xl bg-[#f7f8ff] px-4 py-8 text-center"><span className="text-4xl">🖍️</span><p className="mt-3 font-semibold text-[#262626]">Your match is drawing their prompt.</p><p className="mt-1 text-sm text-[#737373]">You can close this and come back later. We’ll save the game.</p></div> : null}

      {phase === "guessing" ? <div className="mt-4">
        <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-[#fffdfd]"><Drawing strokes={current.strokes || []} /></div>
        {isDrawer ? <div className="mt-4 rounded-xl bg-[#f7f8ff] px-4 py-5 text-center"><p className="font-semibold text-[#262626]">Your drawing is with your match.</p><p className="mt-1 text-sm text-[#737373]">We’ll reveal the answer once they guess or give up.</p></div> : <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); submit("guess", { guess }); }}><input autoComplete="off" className="min-w-0 flex-1 rounded-full border px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={120} onChange={(event) => setGuess(event.target.value)} placeholder="What do you think it is?" value={guess} /><button className="rounded-full bg-[#e1306c] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !guess.trim()} type="submit">Guess</button></form>}
        {!isDrawer ? <button className="mt-3 w-full rounded-full border border-[#dbdbdb] px-4 py-2 text-sm font-semibold text-[#737373]" disabled={busy} onClick={() => submit("give_up", {})} type="button">Reveal the word</button> : null}
      </div> : null}
      {error ? <p className="mt-3 text-center text-sm text-[#d62964]">{error}</p> : null}
    </section>
  </div>;
}
