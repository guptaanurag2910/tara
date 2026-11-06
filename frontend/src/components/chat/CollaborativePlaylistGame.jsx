import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

export default function CollaborativePlaylistGame({ state, sessionId, currentUserId, partnerName = "Your match", onSubmit, socketError = "", onClose }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
  const yourTurn = Number(state?.turn_user_id) === Number(currentUserId);
  const completed = Boolean(state?.completed);
  const targetTurns = Number(state?.target_turns || 6);
  const turnsPlayed = Number(state?.turns_played || 0);

  useEffect(() => {
    setTitle(""); setArtist(""); setNote(""); setSubmitting(false); setError("");
  }, [sessionId, turnsPlayed]);
  useEffect(() => {
    if (socketError) { setSubmitting(false); setError(socketError); }
  }, [socketError]);

  async function addTrack(event) {
    event.preventDefault();
    if (!title.trim() || !artist.trim() || submitting || !onSubmit) return;
    setSubmitting(true); setError("");
    try {
      const sent = await onSubmit({ session_id: sessionId, title: title.trim(), artist: artist.trim(), note: note.trim() });
      if (sent === false) throw new Error("Reconnect to add your song.");
    } catch (submitError) {
      setSubmitting(false); setError(submitError?.message || "Could not add your song. Please try again.");
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
    <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]" data-testid="collaborative-playlist-game">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">Collaborative Playlist 🎧</p><p className="mt-2 text-lg font-bold text-[#262626]">{state?.theme || "Your shared playlist"}</p><p className="mt-1 text-sm text-[#737373]">Take turns adding a song. Your playlist saves as you go.</p></div>
        <button aria-label="Close Collaborative Playlist" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#dbdbdb] text-lg text-[#737373]" onClick={onClose} type="button">×</button>
      </header>
      <div className="mt-4 h-[3px] w-full rounded-full bg-[#efefef]"><div className="h-[3px] rounded-full bg-gradient-to-r from-[#f77737] via-[#e1306c] to-[#0095f6] transition-all" style={{ width: `${Math.min(100, Math.round((turnsPlayed / targetTurns) * 100))}%` }} /></div>
      <p className="mt-3 text-center text-xs font-bold uppercase tracking-wide text-[#777]">{completed ? `${tracks.length} songs in your playlist` : `Song ${turnsPlayed + 1} of ${targetTurns}`}</p>
      <ol aria-label="Shared playlist" className="mt-3 space-y-2" data-testid="collaborative-playlist-tracks">
        {tracks.map((track, index) => {
          const addedByYou = Number(track.user_id) === Number(currentUserId);
          return <li className="flex items-center gap-3 rounded-xl border border-[#eee] bg-[#fafafa] p-3" key={`${index}-${track.title}-${track.artist}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0f5] text-sm font-bold text-[#d62964]">{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#333]">{track.title}</span><span className="block truncate text-xs text-[#777]">{track.artist}</span>{track.note ? <span className="mt-1 block text-xs italic text-[#777]">“{track.note}”</span> : null}</span>
            <span className={`shrink-0 text-[10px] font-bold uppercase ${addedByYou ? "text-[#e1306c]" : "text-[#0095f6]"}`}>{addedByYou ? "You" : partnerName}</span>
          </li>;
        })}
      </ol>
      {!completed ? <div className="mt-4">
        <GameTurnIndicator status={yourTurn ? "Your turn" : `${partnerName}’s turn`} detail={yourTurn ? "Add a song that fits the playlist." : "Your match can add their next song when they’re ready."} isMyTurn={yourTurn} testId="collaborative-playlist-turn-status" players={[
          { name: "You", active: yourTurn, status: yourTurn ? "Add a song now" : "Up next" },
          { name: partnerName, active: !yourTurn, status: !yourTurn ? "Add a song now" : "Up next" },
        ]} />
        {yourTurn ? <form className="mt-4 space-y-2" onSubmit={addTrack}>
          <input aria-label="Song title" autoComplete="off" autoFocus className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Song title" value={title} />
          <input aria-label="Artist" autoComplete="off" className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={100} onChange={(event) => setArtist(event.target.value)} placeholder="Artist" value={artist} />
          <input aria-label="Why this song fits (optional)" autoComplete="off" className="w-full rounded-xl border border-[#ddd] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={140} onChange={(event) => setNote(event.target.value)} placeholder="Why it fits (optional)" value={note} />
          {error ? <p aria-live="polite" className="text-sm text-[#c21f52]">{error}</p> : null}
          <button className="w-full rounded-xl bg-[#e1306c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" disabled={!title.trim() || !artist.trim() || submitting} type="submit">{submitting ? "Adding to playlist…" : "Add song"}</button>
        </form> : null}
      </div> : <div className="mt-5 rounded-xl bg-[#fff5f8] p-4 text-center"><p className="text-xl">🎶✨</p><p className="mt-1 text-sm font-semibold text-[#a52b55]">Your playlist is ready to play!</p></div>}
      {error && !yourTurn ? <p className="mt-3 text-center text-xs text-[#c21f52]">{error}</p> : null}
    </section>
  </div>;
}
