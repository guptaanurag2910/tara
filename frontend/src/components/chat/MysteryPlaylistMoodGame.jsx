import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

export default function MysteryPlaylistMoodGame({ state, sessionId, currentUserId, partnerName = "Your match", onSubmit, socketError = "", onClose }) {
  const [selectedMood, setSelectedMood] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const moodOptions = Array.isArray(state?.mood_options) ? state.mood_options : [];
  const moodPicks = state?.mood_picks || {};
  const moodPhase = state?.phase === "mood_pick";
  const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
  const yourTurn = Number(state?.turn_user_id) === Number(currentUserId);
  const completed = Boolean(state?.completed);
  const ownMoodSubmitted = Boolean(state?.own_mood_submitted) || Number(state?.last_user_id) === Number(currentUserId);
  const turnsPlayed = Number(state?.turns_played || 0);
  const targetTurns = Number(state?.target_turns || 6);

  useEffect(() => {
    setSelectedMood(""); setTitle(""); setArtist(""); setNote(""); setSubmitting(false); setError("");
  }, [sessionId]);
  useEffect(() => {
    if (state?.own_mood) setSelectedMood(state.own_mood);
    if (state?.phase === "songs") setSubmitting(false);
  }, [state?.own_mood, state?.phase]);
  useEffect(() => {
    if (socketError) { setSubmitting(false); setError(socketError); }
  }, [socketError]);

  async function send(payload) {
    if (!onSubmit || submitting) return;
    setSubmitting(true); setError("");
    try {
      const sent = await onSubmit({ session_id: sessionId, ...payload });
      if (sent === false) throw new Error("Reconnect to continue the playlist.");
    } catch (submitError) {
      setSubmitting(false); setError(submitError?.message || "Could not save that. Please try again.");
    }
  }

  function chooseMood(mood) {
    setSelectedMood(mood);
    send({ action: "mood_pick", mood });
  }

  async function addTrack(event) {
    event.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    await send({ action: "add_song", title: title.trim(), artist: artist.trim(), note: note.trim() });
  }

  const moodTitle = moodPhase ? "Pick your playlist mood" : `${moodPicks[String(currentUserId)] || "Your vibe"} + ${Object.entries(moodPicks).find(([id]) => Number(id) !== Number(currentUserId))?.[1] || "their vibe"}`;

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
    <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]" data-testid="mystery-playlist-mood-game">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">Mystery Playlist Mood 🎶</p><p className="mt-2 text-lg font-bold text-[#262626]">{moodPhase ? state?.theme_prompt || "Choose a mood" : moodTitle}</p><p className="mt-1 text-sm text-[#737373]">{moodPhase ? "Choose privately. Your moods reveal together." : "Take turns adding songs that fit your combined vibe."}</p></div>
        <button aria-label="Close Mystery Playlist Mood" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbdbdb] text-lg text-[#737373]" onClick={onClose} type="button">×</button>
      </header>

      {moodPhase ? <div className="mt-5">
        {!ownMoodSubmitted ? <>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#777]">Choose one mood</p>
          <div className="grid grid-cols-2 gap-2">
            {moodOptions.map((mood) => <button className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${selectedMood === mood ? "border-[#e1306c] bg-[#fff1f6] text-[#b52759]" : "border-[#e7e7e7] bg-white text-[#444] hover:border-[#f1a9c2]"}`} disabled={submitting} key={mood} onClick={() => chooseMood(mood)} type="button">{mood}</button>)}
          </div>
          <p className="mt-3 text-center text-xs text-[#888]">You can’t see your match’s choice yet.</p>
        </> : <div aria-live="polite" className="rounded-xl bg-[#fff5f8] p-4 text-center"><p className="text-2xl">🤫🎶</p><p className="mt-2 font-semibold text-[#262626]">Your mood is locked in</p><p className="mt-1 text-sm font-semibold text-[#a52b55]">{selectedMood || state?.own_mood}</p><p className="mt-1 text-sm text-[#737373]">{Number(state?.mood_picks_count || 1) < 2 ? "Waiting for your match to choose their mood." : "Your moods are ready to reveal!"}</p></div>}
        {error ? <p aria-live="polite" className="mt-3 text-center text-sm text-[#c21f52]">{error}</p> : null}
      </div> : <>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[{ label: "Your mood", value: moodPicks[String(currentUserId)], tint: "text-[#e1306c]" }, { label: `${partnerName}’s mood`, value: Object.entries(moodPicks).find(([id]) => Number(id) !== Number(currentUserId))?.[1], tint: "text-[#0095f6]" }].map(({ label, value, tint }) => <div className="rounded-xl bg-[#fafafa] p-3" key={label}><p className={`text-[10px] font-bold uppercase ${tint}`}>{label}</p><p className="mt-1 text-sm font-semibold text-[#333]">{value}</p></div>)}
        </div>
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-wide text-[#777]">{completed ? `${tracks.length} songs · playlist complete` : `Song ${turnsPlayed + 1} of ${targetTurns}`}</p>
        <ol aria-label="Mystery mood shared playlist" className="mt-3 space-y-2" data-testid="mystery-playlist-tracks">
          {tracks.map((track, index) => { const own = Number(track.user_id) === Number(currentUserId); return <li className="flex items-center gap-3 rounded-xl border border-[#eee] bg-[#fafafa] p-3" key={`${index}-${track.title}-${track.artist}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff0f5] text-xs font-bold text-[#d62964]">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#333]">{track.title}</span><span className="block truncate text-xs text-[#777]">{track.artist}</span>{track.note ? <span className="mt-1 block text-xs italic text-[#777]">“{track.note}”</span> : null}</span><span className={`shrink-0 text-[10px] font-bold uppercase ${own ? "text-[#e1306c]" : "text-[#0095f6]"}`}>{own ? "You" : partnerName}</span></li>; })}
        </ol>
        {!completed ? <div className="mt-4"><GameTurnIndicator status={yourTurn ? "Your turn" : `${partnerName}’s turn`} detail={yourTurn ? "Add a song for this mood combination." : "Your match can add the next song when they’re ready."} isMyTurn={yourTurn} testId="mystery-playlist-turn-status" players={[{ name: "You", active: yourTurn, status: yourTurn ? "Add a song now" : "Up next" }, { name: partnerName, active: !yourTurn, status: !yourTurn ? "Add a song now" : "Up next" }]} />
          {yourTurn ? <form className="mt-4 space-y-2" onSubmit={addTrack}><input aria-label="Song title" autoComplete="off" autoFocus className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Song title" value={title} /><input aria-label="Artist" autoComplete="off" className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={100} onChange={(event) => setArtist(event.target.value)} placeholder="Artist" value={artist} /><input aria-label="Why it fits (optional)" autoComplete="off" className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={140} onChange={(event) => setNote(event.target.value)} placeholder="Why it fits (optional)" value={note} />{error ? <p aria-live="polite" className="text-sm text-[#c21f52]">{error}</p> : null}<button className="w-full rounded-xl bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!title.trim() || !artist.trim() || submitting} type="submit">{submitting ? "Adding to playlist…" : "Add song"}</button></form> : null}
        </div> : <div className="mt-5 rounded-xl bg-[#fff5f8] p-4 text-center"><p className="text-xl">🎶✨</p><p className="mt-1 text-sm font-semibold text-[#a52b55]">The mystery mood playlist is ready!</p></div>}
      </>}
    </section>
  </div>;
}
