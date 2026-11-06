import { useEffect, useState } from "react";

export default function SecretSongPickGame({
  question,
  sessionId,
  questionId,
  answered = false,
  waitingForMatch = false,
  onAnswer,
  socketError = "",
  onClose,
}) {
  const [song, setSong] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSong("");
    setSubmitting(false);
    setError("");
  }, [sessionId]);

  useEffect(() => {
    if (socketError) {
      setSubmitting(false);
      setError(socketError);
    }
  }, [socketError]);

  async function submit(event) {
    event.preventDefault();
    const pick = song.trim();
    if (!pick || submitting || !onAnswer) return;
    if (pick.length > 160) {
      setError("Keep your song pick under 160 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onAnswer({ session_id: sessionId, question_id: questionId, text_answer: pick });
    } catch (submitError) {
      setSubmitting(false);
      setError(submitError?.message || "Could not save your song. Please try again.");
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
    <section className="w-full max-w-md rounded-[20px] border border-[#e7e7e7] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]" data-testid="secret-song-pick-game">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">Secret Song Pick 🎵</p><p className="mt-2 text-lg font-bold text-[#262626]">{question || "Pick a song"}</p></div>
        <button aria-label="Close Secret Song Pick" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbdbdb] text-lg text-[#737373]" onClick={onClose} type="button">×</button>
      </header>
      {!answered ? <form className="mt-5" onSubmit={submit}>
        <label className="text-sm font-semibold text-[#444]" htmlFor="secret-song-title">What song comes to mind?</label>
        <input autoComplete="off" className="mt-2 w-full rounded-xl border border-[#dbdbdb] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" id="secret-song-title" maxLength={160} onChange={(event) => setSong(event.target.value)} placeholder="Song title — Artist" value={song} />
        <p className="mt-2 text-xs text-[#858585]">Your pick stays secret until your match adds theirs.</p>
        {error ? <p aria-live="polite" className="mt-3 text-sm text-[#c21f52]">{error}</p> : null}
        <button className="mt-4 w-full rounded-xl bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!song.trim() || submitting} type="submit">{submitting ? "Saving your pick…" : "Lock in my song"}</button>
      </form> : <div aria-live="polite" className="mt-5 rounded-xl bg-[#fff5f8] p-4 text-center"><p className="text-2xl">🤫🎶</p><p className="mt-2 font-semibold text-[#262626]">Your song is locked in</p><p className="mt-1 text-sm text-[#737373]">{waitingForMatch ? "We’ll reveal both picks here when your match is ready." : "Your match has picked too. Check the chat for your reveal!"}</p></div>}
    </section>
  </div>;
}
