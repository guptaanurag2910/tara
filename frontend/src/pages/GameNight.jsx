import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock3, Flag, Heart, Send, Sparkles, X } from "lucide-react";

import {
  fetchGameNightSchedule, fetchGameNightStatus, joinGameNight, leaveGameNightQueue,
  playGameNightMove, reportGameNight, sendGameNightMessage, voteGameNight,
} from "../services/matchingService";

const gameDescriptions = {
  forbidden_word: "Describe the secret. Your partner gets three guesses, then you swap.",
  emoji_decode: "Act out a scene with emojis. Your partner guesses, then you swap.",
  split_clue: "You each have a different clue. Chat to solve the mystery together.",
  plot_twist: "Build a story together, one line at a time. A twist arrives halfway through.",
};

function formatWhen(value, zone) {
  if (!value) return "To be announced";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long", hour: "numeric", minute: "2-digit", timeZone: zone || undefined,
  }).format(new Date(value));
}

function timeLeft(value, now) {
  if (!value) return "";
  const seconds = Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function countdown(value, now) {
  if (!value) return "";
  const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - now) / 60000));
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d ${Math.ceil((minutes % 1440) / 60)}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}

function addCalendarReminder(schedule) {
  if (!schedule?.starts_at || !schedule?.ends_at) return;
  const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const calendar = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tara//Game Night//EN",
    "BEGIN:VEVENT", `UID:tara-game-night-${schedule.window_id}-${stamp(schedule.starts_at)}@tara`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(schedule.starts_at)}`, `DTEND:${stamp(schedule.ends_at)}`,
    "SUMMARY:Tara Game Night", "DESCRIPTION:Join Tara to play a short game with someone new.",
    "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Tara Game Night starts in 15 minutes", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "tara-game-night.ics";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function GameBoard({ room, onMove, busy }) {
  const [move, setMove] = useState("");
  const game = room.game;
  const isActor = game.actor_id === room.your_id;
  const guessing = game.stage === "guess" && !isActor;
  const clueTurn = game.stage === "clue" && isActor;
  const storyTurn = game.next_user_id === room.your_id;
  const canMove = !room.game_done && room.status === "active" && (
    room.game_kind === "split_clue" ||
    room.game_kind === "plot_twist" && storyTurn ||
    ["forbidden_word", "emoji_decode"].includes(room.game_kind) && (clueTurn || guessing)
  );

  let prompt = "Wait for your partner's move";
  if (room.game_kind === "split_clue") prompt = "Your guess";
  if (room.game_kind === "plot_twist" && storyTurn) prompt = "Add the next line";
  if (clueTurn) prompt = room.game_kind === "emoji_decode" ? "Send your emoji clue" : "Send a clue";
  if (guessing) prompt = "Guess the secret";

  async function submit(event) {
    event.preventDefault();
    if (!move.trim()) return;
    if (await onMove(move.trim())) setMove("");
  }

  return <section className="rounded-[28px] border border-[#f4d6de] bg-white p-5 shadow-[0_18px_50px_rgba(225,48,108,.07)] sm:p-7">
    <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff0f5] text-[#e1306c]"><Sparkles size={21} /></span><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#b86280]">Tonight's game</p><h2 className="text-xl font-bold text-[#262626]">{room.game_name}</h2></div></div>
    <p className="mb-5 text-sm leading-6 text-[#6e6268]">{gameDescriptions[room.game_kind]}</p>
    {room.game_kind === "plot_twist" ? <div className="space-y-3 rounded-2xl bg-[#fff8fa] p-4"><p className="font-semibold text-[#383036]">{game.card.starter}</p>{game.lines.map((line, index) => <p className="border-l-2 border-[#e1306c] pl-3 text-sm text-[#544b50]" key={index}>{line.text}</p>)}{game.lines.length >= 2 ? <p className="rounded-xl bg-[#ffe6ee] p-3 text-sm font-medium text-[#9b3157]">Plot twist: {game.card.twist}</p> : null}</div> : null}
    {room.game_kind === "split_clue" ? <div className="rounded-2xl bg-[#fff8fa] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#aa5c79]">Your private clue</p><p className="mt-2 text-lg font-semibold text-[#383036]">{game.card.your_clue}</p><p className="mt-2 text-xs text-[#8e7e86]">Your partner sees a different clue. Share yours in chat.</p>{game.solved ? <p className="mt-3 font-semibold text-[#0c8b75]">Mystery solved together.</p> : null}</div> : null}
    {["forbidden_word", "emoji_decode"].includes(room.game_kind) ? <div className="rounded-2xl bg-[#fff8fa] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#aa5c79]">Round {Math.min(game.round, 2)} of 2</p>{isActor && game.card.secret && !room.game_done ? <><p className="mt-2 text-lg font-semibold text-[#383036]">{game.card.secret}</p>{game.card.forbidden?.length ? <p className="mt-1 text-xs text-[#a3495f]">Don't use: {game.card.forbidden.join(", ")}</p> : null}</> : null}{!isActor && game.clue ? <p className="mt-2 text-lg font-semibold text-[#383036]">Clue: {game.clue}</p> : null}<p className="mt-2 text-xs text-[#8e7e86]">{isActor ? game.stage === "clue" ? "Your turn to give a clue." : "Your partner is guessing." : game.stage === "guess" ? `Your turn to guess (${3 - game.guesses} tries left).` : "Waiting for their clue."}</p></div> : null}
    {room.game_done ? <p className="mt-5 rounded-xl bg-[#f1faf7] px-4 py-3 text-sm font-medium text-[#107e68]">Game complete. Choose privately below.</p> : <form className="mt-5 flex gap-2" onSubmit={submit}><input aria-label={prompt} className="min-w-0 flex-1 rounded-2xl border border-[#eadde1] bg-white px-4 py-3 text-sm outline-none focus:border-[#e1306c]" disabled={!canMove || busy} maxLength={140} onChange={(event) => setMove(event.target.value)} placeholder={prompt} value={move} /><button aria-label="Play move" className="rounded-2xl bg-[#e1306c] px-4 text-white disabled:opacity-40" disabled={!canMove || !move.trim() || busy} type="submit"><ArrowRight size={19} /></button></form>}
  </section>;
}

export default function GameNight() {
  const [schedule, setSchedule] = useState(null);
  const [room, setRoom] = useState({ state: "idle" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(Date.now());

  async function reload() {
    setRetrying(true);
    setError("");
    try {
      const [nextSchedule, nextRoom] = await Promise.all([fetchGameNightSchedule(), fetchGameNightStatus()]);
      setSchedule(nextSchedule);
      setRoom(nextRoom);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Game Night is unavailable right now.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const [nextSchedule, nextRoom] = await Promise.all([
          fetchGameNightSchedule(),
          room.state === "waiting" && schedule?.is_open ? joinGameNight() : fetchGameNightStatus(),
        ]);
        setSchedule(nextSchedule);
        setRoom(nextRoom);
      } catch (err) { setError(err.message); }
    }, room.state === "room" || room.state === "waiting" ? 2500 : 15000);
    return () => window.clearInterval(timer);
  }, [room.state, schedule?.is_open]);

  async function act(operation) {
    setBusy(true);
    setError("");
    try { setRoom(await operation()); return true; }
    catch (err) { setError(err.message || "Please try again."); return false; }
    finally { setBusy(false); }
  }

  async function sendChat(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    const content = draft.trim();
    if (await act(() => sendGameNightMessage(room.id, content))) setDraft("");
  }

  async function report() {
    if (!window.confirm("Report this room and leave?")) return;
    await act(() => reportGameNight(room.id, "Safety concern").then(() => fetchGameNightStatus()));
  }

  const activeRoom = room.state === "room";
  const inPlay = activeRoom && room.status === "active";
  const closed = activeRoom && ["passed", "expired"].includes(room.status);

  return <main className="min-h-full bg-[radial-gradient(circle_at_50%_0%,#fff0f4_0%,#fff_55%)] px-4 pb-12 pt-5 text-[#262626] sm:px-6">
    <div className="mx-auto max-w-[940px]">
      <header className="mb-8 flex items-center justify-between"><Link aria-label="Back to Discover" className="grid h-10 w-10 place-items-center rounded-full border border-[#f0d8df] bg-white text-[#484048]" to="/discover"><ArrowLeft size={19} /></Link><span className="text-xl font-black tracking-[-.08em]">tara<span className="text-[#e1306c]">.</span></span><span className="w-10" /></header>
      <div className="mb-7 text-center"><p className="text-xs font-bold uppercase tracking-[.25em] text-[#d54d7b]">A little spark, live</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Game Night</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#756a70]">Meet someone who is here right now. Play together, then decide if you want to keep talking.</p></div>
      {error ? <div className="mx-auto mb-5 flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><span>{error}</span><button className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50" disabled={retrying} onClick={reload} type="button">{retrying ? "Retrying…" : "Try again"}</button></div> : null}
      {loading ? <p className="text-center text-sm text-[#887c82]">Loading Game Night…</p> : null}
      {!loading && !activeRoom ? <div className="mx-auto max-w-xl space-y-5">
        <section className="rounded-[30px] border border-[#f1dbe1] bg-white p-6 text-center shadow-[0_20px_50px_rgba(225,48,108,.08)] sm:p-9"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#f77737,#e1306c)] text-white"><Sparkles size={28} /></span><h2 className="mt-5 text-2xl font-bold">{room.state === "waiting" ? "Finding your co-player" : schedule?.is_open ? "The room is open" : "Your next Game Night"}</h2><p className="mt-2 text-sm text-[#756a70]">{room.state === "waiting" ? "Stay here while we find someone active and compatible." : schedule?.is_open ? "Join now for one random game together." : schedule?.starts_at ? `Starts ${formatWhen(schedule.starts_at, schedule.timezone)}` : "New sessions will be announced here."}</p>{schedule?.starts_at && !schedule.is_open ? <p className="mt-5 text-3xl font-black tabular-nums text-[#d6336c]">{countdown(schedule.starts_at, now)}</p> : null}{room.state === "waiting" ? <button className="mt-7 w-full rounded-2xl border border-[#eacbd5] px-5 py-3 font-semibold text-[#ab4a6e]" onClick={() => act(async () => { await leaveGameNightQueue(); return { state: "idle" }; })} type="button">Leave queue</button> : <button className="mt-7 w-full rounded-2xl bg-[#e1306c] px-5 py-3 font-bold text-white disabled:opacity-40" disabled={!schedule?.is_open || busy} onClick={() => act(joinGameNight)} type="button">Join Game Night</button>}{!schedule?.is_open && schedule?.starts_at ? <><button className="mt-3 text-sm font-semibold text-[#b33967]" onClick={() => addCalendarReminder(schedule)} type="button">Add a 15-minute calendar reminder</button><p className="mt-1 text-xs text-[#a0959b]">For the next session only. Calendar entries won't update if the schedule changes.</p></> : null}</section>
        <section className="rounded-3xl border border-[#f1dbe1] bg-white/80 p-5"><div className="flex items-center gap-2 font-semibold"><Clock3 size={18} className="text-[#d6336c]" /> Upcoming windows</div><div className="mt-3 space-y-2 text-sm text-[#6e6268]">{schedule?.windows?.length ? schedule.windows.map((item, index) => <p key={`${item.weekday}-${item.start}-${index}`}>{item.weekday} · {item.start}–{item.end} · {item.timezone}</p>) : <p>No windows are enabled right now.</p>}</div></section>
      </div> : null}
      {activeRoom ? <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5"><div className="flex items-center justify-between rounded-2xl border border-[#f1dbe1] bg-white px-4 py-3"><div><p className="text-xs uppercase tracking-wide text-[#ae7488]">Playing with</p><p className="font-bold">{room.partner.name}</p></div><span className="rounded-full bg-[#fff0f5] px-3 py-1 text-sm font-bold tabular-nums text-[#b33967]">{timeLeft(room.play_ends_at, now)}</span></div>
          {inPlay ? <GameBoard key={room.id} busy={busy} onMove={(content) => act(() => playGameNightMove(room.id, content))} room={room} /> : <section className="rounded-[28px] border border-[#f1dbe1] bg-white p-7 text-center"><Heart className="mx-auto text-[#e1306c]" size={34} /><h2 className="mt-3 text-2xl font-bold">{room.status === "matched" ? "It's a match" : room.status === "passed" ? "This round has ended" : "Time's up"}</h2><p className="mt-2 text-sm text-[#756a70]">{room.status === "matched" ? "You both chose to keep talking." : "No match was made. Another story is ahead."}</p>{room.match_id ? <Link className="mt-5 inline-flex rounded-xl bg-[#e1306c] px-5 py-3 font-semibold text-white" params={{ matchId: String(room.match_id) }} to="/chat/$matchId">Open chat</Link> : null}<button className="mt-4 block w-full text-sm font-semibold text-[#a35b76]" onClick={() => act(async () => { await leaveGameNightQueue(); return { state: "idle" }; })} type="button">Back to Game Night</button></section>}
          {inPlay ? <div className="rounded-3xl border border-[#f1dbe1] bg-white p-5"><h3 className="font-bold">Your decision</h3><p className="mt-1 text-xs text-[#8b7b82]">Your choice stays private. A chat opens only if you both choose Match.</p>{room.your_vote ? <p className="mt-4 rounded-xl bg-[#fff0f5] p-3 text-sm font-semibold text-[#9a3d62]">{room.your_vote === "match" ? "You chose Match. Waiting for their decision." : "You chose Pass."}</p> : <div className="mt-4 flex gap-3"><button className="flex-1 rounded-xl border border-[#ead7df] px-4 py-3 font-semibold text-[#765e68]" disabled={busy} onClick={() => act(() => voteGameNight(room.id, "pass"))} type="button"><X className="mr-1 inline" size={16} /> Pass</button><button className="flex-1 rounded-xl bg-[#e1306c] px-4 py-3 font-semibold text-white disabled:opacity-40" disabled={busy || !room.game_done} onClick={() => act(() => voteGameNight(room.id, "match"))} type="button"><Heart className="mr-1 inline" size={16} /> Match</button></div>}<button className="mt-4 flex items-center gap-1 text-xs font-medium text-[#977e88]" onClick={report} type="button"><Flag size={13} /> Report and leave</button></div> : null}
        </div>
        {inPlay ? <section className="flex min-h-[380px] flex-col rounded-[28px] border border-[#f1dbe1] bg-white p-5"><div className="border-b border-[#f7e7ed] pb-3"><h2 className="font-bold">Talk while you play</h2><p className="text-xs text-[#8b7b82]">Only you two can see this room.</p></div><div aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto py-4">{room.messages?.length ? room.messages.map((message) => <p className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${message.sender_id === room.your_id ? "self-end bg-[#e1306c] text-white" : "self-start bg-[#f7f3f5] text-[#353035]"}`} key={message.id}>{message.content}</p>) : <p className="text-center text-xs text-[#a4979e]">Say hello or share a clue to start.</p>}</div><form className="flex gap-2" onSubmit={sendChat}><input aria-label="Chat message" className="min-w-0 flex-1 rounded-2xl border border-[#eadde1] px-4 py-3 text-sm outline-none focus:border-[#e1306c]" maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" value={draft} /><button aria-label="Send message" className="rounded-2xl bg-[#e1306c] px-4 text-white disabled:opacity-40" disabled={!draft.trim() || busy || room.game_done} type="submit"><Send size={18} /></button></form></section> : null}
      </div> : null}
    </div>
  </main>;
}
