import { useEffect, useMemo, useState } from "react";

export default function UnscrambleGame({ state, sessionId, feedback, onSubmit, onClose, socketError = "" }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const solved = useMemo(() => new Set((state?.solved_indices || []).map(Number)), [state?.solved_indices]);
  const current = (state?.rounds || []).find((round) => !solved.has(Number(round.index)));

  useEffect(() => {
    setBusy(false);
    setAnswer("");
    if (state?.solved_count) setNote("Correct! ✨");
  }, [state?.solved_count, state?.phase]);
  useEffect(() => {
    if (feedback?.session_id !== Number(sessionId)) return;
    setBusy(false);
    setNote(feedback.correct ? "Correct! ✨" : "Not quite—try again.");
    if (!feedback.correct) setAnswer("");
  }, [feedback, sessionId]);
  useEffect(() => {
    if (socketError) { setBusy(false); setNote(socketError); }
  }, [socketError]);

  function submit(event) {
    event.preventDefault();
    if (!current || !answer.trim() || busy) return;
    setBusy(true); setNote("");
    try {
      if (onSubmit?.({ session_id: sessionId, round_index: current.index, answer }) === false) {
        throw new Error("Reconnect to continue the game.");
      }
    } catch (submitError) {
      setBusy(false); setNote(submitError?.message || "Could not submit your answer.");
    }
  }

  const total = Number(state?.total_rounds || state?.rounds?.length || 10);

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="w-full max-w-md rounded-[20px] border border-[#e7e7e7] bg-white p-4 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5" data-testid="unscramble-modal">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">🔤 Unscramble</p><h2 className="mt-1 text-xl font-bold text-[#262626]">Solve at your own pace</h2><p className="mt-1 text-sm text-[#737373]">You and your match get the same ten words.</p></div><button aria-label="Close Unscramble" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-[#737373]" onClick={onClose} type="button">×</button></header>
      {state?.rounds?.length ? <>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fafafa] px-3 py-2 text-xs"><span className="font-semibold text-[#262626]">Solved {state.solved_count || 0} / {total}</span><span className="text-[#737373]">Wrong tries: {state.mistakes || 0}</span></div>
        {current ? <form className="mt-5" onSubmit={submit}>
          <p className="text-center text-xs font-bold uppercase tracking-wider text-[#737373]">Word {Number(current.index) + 1}</p>
          <div aria-label="Scrambled letters" className="mt-3 flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl bg-[#fff3f7] px-4 py-5">
            {String(current.scrambled || "").split("").map((letter, index) => <span className="grid h-11 w-10 place-items-center rounded-lg border border-[#f1d7e1] bg-white text-xl font-black text-[#262626] shadow-sm" key={`${index}-${letter}`}>{letter}</span>)}
          </div>
          <label className="mt-4 block text-xs font-semibold text-[#737373]" htmlFor="unscramble-answer">Your answer</label>
          <input autoComplete="off" autoFocus className="mt-1 w-full rounded-xl border border-[#dbdbdb] bg-[#fafafa] px-4 py-3 text-center text-lg font-bold uppercase tracking-widest text-[#262626] outline-none focus:border-[#e1306c]" id="unscramble-answer" maxLength={24} onChange={(event) => setAnswer(event.target.value)} placeholder="TYPE THE WORD" value={answer} />
          <button className="mt-3 w-full rounded-full bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !answer.trim()} type="submit">{busy ? "Checking…" : "Check answer"}</button>
        </form> : state.your_completed ? <div className="mt-5 rounded-2xl bg-[#f7f8ff] px-4 py-6 text-center"><span className="text-3xl">🧠</span><p className="mt-2 font-semibold text-[#262626]">All ten solved!</p><p className="mt-1 text-sm text-[#737373]">{state.match_completed ? "Your match is done too. Check the chat for your results." : "Your answers are saved. The reveal comes when your match finishes."}</p></div> : null}
        <div className="mt-4 flex flex-wrap gap-1.5">{(state.rounds || []).map((round) => <span aria-label={solved.has(Number(round.index)) ? `Word ${Number(round.index) + 1} solved` : `Word ${Number(round.index) + 1} unsolved`} className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${solved.has(Number(round.index)) ? "bg-[#e5f7ec] text-[#167744]" : Number(current?.index) === Number(round.index) ? "bg-[#e1306c] text-white" : "bg-[#f1f1f1] text-[#888]"}`} key={round.index}>{solved.has(Number(round.index)) ? "✓" : Number(round.index) + 1}</span>)}</div>
      </> : <div className="mt-5 rounded-2xl bg-[#f7f8ff] px-4 py-8 text-center text-sm text-[#737373]">Loading your words…</div>}
      {note ? <p aria-live="polite" className={`mt-3 text-center text-sm ${note.startsWith("Correct") ? "text-[#167744]" : "text-[#d62964]"}`}>{note}</p> : null}
    </section>
  </div>;
}
