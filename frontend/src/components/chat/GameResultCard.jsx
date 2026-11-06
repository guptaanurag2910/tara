import { useEffect, useState } from "react";
import { fetchPhotoScavengerImage } from "../../services/gameService";

function PrivateGamePhoto({ path, alt }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!path) return undefined;
    let active = true;
    let objectUrl = "";
    fetchPhotoScavengerImage(path).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => setSource(""));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return source
    ? <img alt={alt} className="max-h-[360px] w-full rounded-xl bg-[#f5f5f5] object-contain" src={source} />
    : <div aria-label="Loading shared photo" className="grid aspect-[4/3] place-items-center rounded-xl bg-[#f5f5f5] text-2xl">📸</div>;
}

function ResultRow({ item, category, result, currentUserId, userLabel = "You", partnerLabel = "Partner" }) {
  if (Array.isArray(item?.chain)) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[#737373]">Starter word</p>
      <p className="mt-1 text-sm font-semibold text-[#262626]">{item.question}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Completed word chain">
        {item.chain.map((entry, index) => <div className="flex items-center gap-2" key={`${index}-${entry.word}`}>
          {index ? <span aria-hidden="true" className="text-[#b5b5b5]">→</span> : null}
          <span className="rounded-full border border-[#f0d2df] bg-white px-3 py-2 text-sm font-semibold capitalize text-[#333]">{entry.word}</span>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-[#737373]">Six turns, one wonderfully unpredictable chain.</p>
    </div>;
  }
  if (category === "secret_song_pick") {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm font-semibold text-[#262626]">{item.question}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[{ label: userLabel, song: item.user_a, tint: "text-[#e1306c]" }, { label: partnerLabel, song: item.user_b, tint: "text-[#0095f6]" }].map(({ label, song, tint }) => <div className="rounded-lg bg-white p-3" key={label}><p className={`text-xs font-bold ${tint}`}>{label} picked</p><p className="mt-1 text-sm font-semibold text-[#333]">{song || "—"}</p></div>)}
      </div>
      {item.match ? <p className="mt-3 text-center text-xs font-bold text-[#e1306c]">Same song! You found your soundtrack 🎵</p> : null}
    </div>;
  }
  if (category === "collaborative_playlist" && Array.isArray(item?.tracks)) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm font-semibold text-[#262626]">{item.question}</p>
      <ol className="mt-3 space-y-2">
        {item.tracks.map((track, index) => <li className="flex items-center gap-3 rounded-lg bg-white p-3" key={`${index}-${track.title}-${track.artist}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff0f5] text-xs font-bold text-[#d62964]">{index + 1}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#333]">{track.title}</span><span className="block truncate text-xs text-[#777]">{track.artist}</span>{track.note ? <span className="mt-1 block text-xs italic text-[#777]">“{track.note}”</span> : null}</span>
          <span className={`shrink-0 text-[10px] font-bold uppercase ${Number(track.user_id) === Number(currentUserId) ? "text-[#e1306c]" : "text-[#0095f6]"}`}>{Number(track.user_id) === Number(currentUserId) ? userLabel : partnerLabel}</span>
        </li>)}
      </ol>
    </div>;
  }
  if (category === "mystery_playlist_mood" && Array.isArray(item?.tracks)) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm font-semibold text-[#262626]">Your mood blend</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[{ label: userLabel, mood: result.mood_a, tint: "text-[#e1306c]" }, { label: partnerLabel, mood: result.mood_b, tint: "text-[#0095f6]" }].map(({ label, mood, tint }) => <div className="rounded-lg bg-white p-3" key={label}><p className={`text-[10px] font-bold uppercase ${tint}`}>{label} picked</p><p className="mt-1 text-sm font-semibold text-[#333]">{mood}</p></div>)}
      </div>
      <p className="mt-3 text-center text-xs font-bold text-[#a52b55]">{result.mood_matched ? "Same mood — great minds! ✨" : "Two moods, one playlist 🎶"}</p>
      <ol className="mt-3 space-y-2">
        {item.tracks.map((track, index) => { const own = Number(track.user_id) === Number(currentUserId); return <li className="flex items-center gap-3 rounded-lg bg-white p-3" key={`${index}-${track.title}-${track.artist}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff0f5] text-xs font-bold text-[#d62964]">{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#333]">{track.title}</span><span className="block truncate text-xs text-[#777]">{track.artist}</span>{track.note ? <span className="mt-1 block text-xs italic text-[#777]">“{track.note}”</span> : null}</span><span className={`shrink-0 text-[10px] font-bold uppercase ${own ? "text-[#e1306c]" : "text-[#0095f6]"}`}>{own ? userLabel : partnerLabel}</span></li>; })}
      </ol>
    </div>;
  }
  if (item?.user_a_photo_url || item?.user_b_photo_url) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm font-semibold text-[#262626]">{item.question}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[{ label: userLabel, path: item.user_a_photo_url, caption: item.user_a, tint: "text-[#e1306c]" }, { label: partnerLabel, path: item.user_b_photo_url, caption: item.user_b, tint: "text-[#0095f6]" }].map(({ label, path, caption, tint }) => <div className="min-w-0 rounded-xl bg-white p-2" key={label}>
          <p className={`mb-2 text-xs font-bold ${tint}`}>{label}</p>
          <PrivateGamePhoto alt={`${label}'s scavenger hunt photo`} path={path} />
          {caption ? <p className="mt-2 text-sm text-[#555]">“{caption}”</p> : null}
        </div>)}
      </div>
    </div>;
  }
  if (Object.hasOwn(item || {}, "answer")) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <div className="flex items-center justify-between gap-3"><p className="text-2xl font-bold tracking-wider text-[#262626]">{item.question}</p><span className="shrink-0 rounded-full bg-[#fff3f7] px-2 py-1 text-[10px] font-bold text-[#a52b55]">{item.answer}</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[{ label: userLabel, guess: item.user_a, correct: item.user_a_correct, tint: "text-[#e1306c]" }, { label: partnerLabel, guess: item.user_b, correct: item.user_b_correct, tint: "text-[#0095f6]" }].map(({ label, guess, correct, tint }) => <div className="rounded-lg bg-white p-2" key={label}><p className={`text-xs font-bold ${tint}`}>{label} · {correct ? "Correct ✓" : "Not quite"}</p><p className="mt-1 text-sm text-[#555]">{guess || "—"}</p></div>)}
      </div>
    </div>;
  }
  if (item?.scene_emoji) {
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fff3f7] text-3xl">{item.scene_emoji}</span><p className="text-sm font-semibold text-[#262626]">{item.question}</p></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-[#e1306c]">{userLabel}'s caption</p><p className="mt-1 text-sm text-[#555]">“{item.user_a || "—"}”</p></div>
        <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-[#0095f6]">{partnerLabel}'s caption</p><p className="mt-1 text-sm text-[#555]">“{item.user_b || "—"}”</p></div>
      </div>
    </div>;
  }
  if (Array.isArray(item?.user_a) && Array.isArray(item?.user_b) && item.user_a.every((entry) => entry && typeof entry === "object")) {
    const rankingList = (label, entries, tint) => (
      <div className="rounded-lg bg-white p-3">
        <p className={`mb-2 font-semibold ${tint}`}>{label}</p>
        <ol className="space-y-1">
          {entries.map((entry) => <li className="flex gap-2 text-xs text-[#555]" key={`${entry.rank}-${entry.item}`}><span className="w-5 font-bold text-[#a3a3a3]">{entry.rank}.</span><span>{entry.item}</span></li>)}
        </ol>
      </div>
    );
    return <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm font-semibold text-[#262626]">{item?.question}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{rankingList(userLabel, item.user_a, "text-[#e1306c]")}{rankingList(partnerLabel, item.user_b, "text-[#0095f6]")}</div>
    </div>;
  }
  if (Array.isArray(item?.user_a?.statements) && Array.isArray(item?.user_b?.statements)) {
    const person = (label, entry, guess, correct, color) => (
      <div className="rounded-lg bg-white p-2">
        <p className={`mb-1 font-semibold ${color}`}>{label}</p>
        {entry.statements.map((statement, index) => (
          <p className={`mt-1 text-xs ${index === entry.lie_index ? "font-semibold text-[#d62964]" : "text-[#737373]"}`} key={index}>
            {index + 1}. {statement}{index === entry.lie_index ? " · Lie" : ""}
          </p>
        ))}
        <p className="mt-2 text-xs text-[#737373]">Guessed: statement {Number(guess) + 1} {correct ? "✓" : "✗"}</p>
      </div>
    );
    return (
      <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
        <p className="text-sm font-semibold text-[#262626]">{item?.question}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {person(userLabel, item.user_a, item.user_a_guess, item.user_a_correct, "text-[#e1306c]")}
          {person(partnerLabel, item.user_b, item.user_b_guess, item.user_b_correct, "text-[#0095f6]")}
        </div>
      </div>
    );
  }
  if (Object.hasOwn(item || {}, "user_a_guess")) {
    return (
      <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
        <p className="text-sm font-semibold text-[#262626]">{item?.question}</p>
        <div className="mt-2 grid gap-2 text-[0.82rem] text-[#737373] sm:grid-cols-2">
          <div className="rounded-lg bg-white p-2">
            <p><span className="font-semibold text-[#e1306c]">{userLabel} picked:</span> {item?.user_a || "—"}</p>
            <p><span className="font-semibold text-[#e1306c]">Guessed:</span> {item?.user_a_guess || "—"} {item?.user_a_correct ? "✓" : ""}</p>
          </div>
          <div className="rounded-lg bg-white p-2">
            <p><span className="font-semibold text-[#0095f6]">{partnerLabel} picked:</span> {item?.user_b || "—"}</p>
            <p><span className="font-semibold text-[#0095f6]">Guessed:</span> {item?.user_b_guess || "—"} {item?.user_b_correct ? "✓" : ""}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3">
      <p className="text-sm text-[#262626]">{item?.question}</p>
      <div className="mt-1 space-y-1 text-[0.83rem] text-[#737373]">
        <p>
          <span className="font-semibold text-[#e1306c]">{userLabel}:</span> {item?.user_a || "—"}
        </p>
        <p>
          <span className="font-semibold text-[#e1306c]">{partnerLabel}:</span> {item?.user_b || "—"}
        </p>
      </div>
    </div>
  );
}

function gameLabel(category) {
  const value = String(category || "").toLowerCase();
  if (value === "predict_me") return "PREDICT ME";
  if (value === "guess_their_pick") return "GUESS THEIR PICK";
  if (value === "build_a_story") return "BUILD A STORY";
  if (value === "two_truths_and_a_lie") return "TWO TRUTHS & A LIE";
  if (value === "choose_your_adventure") return "CHOOSE YOUR ADVENTURE";
  if (value === "rank_these") return "RANK THESE";
  if (value === "would_you_rather") return "WOULD YOU RATHER?";
  if (value === "caption_this") return "CAPTION THIS";
  if (value === "tic_tac_toe") return "TIC TAC TOE";
  if (value === "dots_and_boxes") return "DOTS AND BOXES";
  if (value === "snakes_ladders") return "SNAKES, LADDERS & SECRETS";
  if (value === "bingo") return "BINGO · ARE WE IN SYNC?";
  if (value === "spot_the_difference") return "SPOT THE DIFFERENCE";
  if (value === "memory_match") return "MEMORY MATCH";
  if (value === "pictionary") return "PICTIONARY";
  if (value === "word_search") return "WORD SEARCH";
  if (value === "unscramble") return "UNSCRAMBLE";
  if (value === "emoji_decode") return "EMOJI DECODE";
  if (value === "cipher_breaker") return "CIPHER BREAKER";
  if (value === "photo_scavenger_hunt") return "PHOTO SCAVENGER HUNT";
  if (value === "word_association") return "WORD ASSOCIATION";
  if (value === "secret_song_pick") return "SECRET SONG PICK";
  if (value === "collaborative_playlist") return "COLLABORATIVE PLAYLIST";
  if (value === "mystery_playlist_mood") return "MYSTERY PLAYLIST MOOD";
  if (value === "deal_breaker") return "DEAL BREAKER";
  return "THIS OR THAT";
}

function gameEmoji(category) {
  const value = String(category || "").toLowerCase();
  if (value === "predict_me") return "🔮";
  if (value === "guess_their_pick") return "🔮";
  if (value === "build_a_story") return "📖";
  if (value === "two_truths_and_a_lie") return "🕵️";
  if (value === "choose_your_adventure") return "🗺️";
  if (value === "rank_these") return "📊";
  if (value === "would_you_rather") return "🤔";
  if (value === "caption_this") return "🎨";
  if (value === "tic_tac_toe") return "⭕";
  if (value === "dots_and_boxes") return "🔲";
  if (value === "snakes_ladders") return "🐍";
  if (value === "bingo") return "🎯";
  if (value === "spot_the_difference") return "🔍";
  if (value === "memory_match") return "🃏";
  if (value === "pictionary") return "✏️";
  if (value === "word_search") return "🔎";
  if (value === "unscramble") return "🔤";
  if (value === "emoji_decode") return "🧩";
  if (value === "cipher_breaker") return "🔐";
  if (value === "photo_scavenger_hunt") return "📸";
  if (value === "word_association") return "💭";
  if (value === "secret_song_pick") return "🎵";
  if (value === "collaborative_playlist") return "🎧";
  if (value === "mystery_playlist_mood") return "🎶";
  if (value === "deal_breaker") return "💔";
  return "⚖️";
}

export default function GameResultCard({
  result,
  category = "this_or_that",
  userLabel = "You",
  partnerLabel = "Partner",
  currentUserId = null,
}) {
  if (!result) {
    return null;
  }

  const questions = Array.isArray(result?.questions) ? result.questions : [];

  return (
    <section
      className="rounded-[18px] border border-[#e7e7e7] bg-white p-4"
      data-testid="game-result-card"
    >
      <div className="flex items-center justify-between text-[#e1306c]">
        <h3 className="text-[0.84rem] tracking-[0.28em]">
          <span className="mr-2">{gameEmoji(category)}</span>
          {gameLabel(category)}
        </h3>
        <span className="text-sm font-semibold text-[#262626]">
          {category === "build_a_story"
            ? `${result?.round_count ?? result?.total ?? questions.length} scenes`
            : category === "tic_tac_toe"
            ? result?.draw ? "DRAW" : `${result?.winner_mark || ""} WINS`
            : category === "dots_and_boxes"
            ? `${result?.user_a_mark || "X"} ${result?.user_a_score ?? 0} · ${result?.user_b_mark || "O"} ${result?.user_b_score ?? 0}`
            : category === "pictionary"
            ? `${result?.round_count ?? result?.rounds?.length ?? 0} drawings`
            : category === "spot_the_difference"
            ? `${result?.difference_count ?? result?.found?.length ?? 0} differences`
            : category === "memory_match"
            ? `${result?.moves ?? 0} turns`
            : category === "word_search"
            ? `${result?.total_words ?? 0} words found`
            : category === "unscramble"
            ? `${result?.total_rounds ?? 0} words solved`
            : category === "emoji_decode"
            ? `${result?.matched ?? 0}/${result?.total ?? 0} decoded`
            : category === "photo_scavenger_hunt"
            ? "2 PHOTOS REVEALED"
            : category === "word_association"
            ? `${result?.round_count ?? 6} TURNS`
            : category === "secret_song_pick"
            ? result?.questions?.[0]?.match ? "SAME SONG 🎵" : "PICKS REVEALED"
            : category === "collaborative_playlist"
            ? `${result?.tracks?.length ?? result?.round_count ?? 0} SONGS`
            : category === "mystery_playlist_mood"
            ? `${result?.tracks?.length ?? result?.round_count ?? 0} SONGS`
            : category === "caption_this"
            ? `${result?.round_count ?? result?.total ?? questions.length} scenes`
            : category === "guess_their_pick" || category === "two_truths_and_a_lie"
            ? `${result?.matched ?? 0}/${result?.round_count ? result.round_count * 2 : 0}`
            : `${result?.matched ?? 0}/${result?.total ?? 0}`}
        </span>
      </div>

      {category === "tic_tac_toe" && Array.isArray(result?.board) ? (
        <div aria-label="Final Tic Tac Toe board" className="mx-auto mt-4 grid w-full max-w-[210px] grid-cols-3 gap-1.5">
          {result.board.map((mark, index) => (
            <div className={`grid aspect-square place-items-center rounded-lg border text-3xl font-bold ${result?.winning_line?.includes(index) ? "border-[#f7b731] bg-[#fff8e7]" : "border-[#e7e7e7] bg-[#fafafa]"} ${mark === "X" ? "text-[#e1306c]" : "text-[#0095f6]"}`} key={index}>{mark || "·"}</div>
          ))}
        </div>
      ) : null}

      {category === "dots_and_boxes" && Array.isArray(result?.boxes) ? <div className="mx-auto mt-4 grid w-full max-w-[210px] grid-cols-3 gap-1.5 rounded-lg bg-[#e4e7eb] p-2" aria-label="Final Dots and Boxes board">
        {result.boxes.flatMap((row, rowIndex) => row.map((mark, colIndex) => <div className={`grid aspect-square place-items-center rounded-md text-2xl font-black ${mark === "X" ? "bg-[#fff0f5] text-[#e1306c]" : mark === "O" ? "bg-[#eff8ff] text-[#0095f6]" : "bg-white text-transparent"}`} key={`${rowIndex}-${colIndex}`}>{mark || "·"}</div>))}
      </div> : null}

      {category === "spot_the_difference" && Array.isArray(result?.differences) ? <div className="mt-3 rounded-xl bg-[#fffaf0] p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-[#8b6b35]">You found them all</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{result.differences.map((item) => <span className="rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#555]" key={item.id}>✓ {item.label}</span>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(result.scores || {}).map(([userId, score]) => <div className="rounded-lg bg-white p-2 text-center" key={userId}><p className="text-[10px] font-bold uppercase text-[#737373]">{Number(userId) === Number(currentUserId) ? userLabel : partnerLabel}</p><p className="mt-1 text-lg font-black text-[#a56f12]">{score}</p></div>)}</div>
      </div> : null}

      {category === "memory_match" && Array.isArray(result?.cards) ? <div className="mx-auto mt-3 grid w-full max-w-[300px] grid-cols-4 gap-1.5 rounded-xl bg-violet-100 p-2" aria-label="Completed Memory Match board">
        {result.cards.map((card) => <div className={`grid aspect-square place-items-center rounded-lg text-2xl ${card.matched ? "bg-emerald-50" : "bg-white"}`} key={card.id}>{card.face}</div>)}
      </div> : null}

      {category === "pictionary" && Array.isArray(result?.rounds) ? <div className="mt-3 space-y-2">
        {result.rounds.map((round, index) => <div className="rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3" key={index}>
          <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-[#737373]">Round {index + 1}</p><span className="text-xs font-semibold text-[#e1306c]">{round.solved ? "Guessed ✓" : "Revealed"}</span></div>
          <p className="mt-1 text-sm font-bold text-[#262626]">{round.prompt}</p>
          <div className="mt-2 aspect-[4/3] overflow-hidden rounded-lg border bg-white"><svg viewBox="0 0 1 1" preserveAspectRatio="none" className="h-full w-full">{(round.strokes || []).map((stroke, strokeIndex) => <polyline key={strokeIndex} points={(stroke.points || []).map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#e1306c" strokeWidth="0.008" strokeLinecap="round" strokeLinejoin="round" />)}</svg></div>
          <p className="mt-2 text-xs text-[#737373]">Guess: {round.guess || "—"}</p>
        </div>)}
        <p className="text-sm font-semibold text-[#262626]">Score: {Object.values(result.scores || {}).reduce((total, value) => total + Number(value || 0), 0)} correct guesses</p>
      </div> : null}

      {category === "unscramble" ? <div className="mt-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ label: userLabel, player: result.user_a, tint: "text-[#e1306c]" }, { label: partnerLabel, player: result.user_b, tint: "text-[#0095f6]" }].map(({ label, player, tint }) => <div className="rounded-xl bg-[#fafafa] p-3" key={label}>
            <div className="flex items-center justify-between gap-2"><p className={`text-xs font-bold ${tint}`}>{label}</p><span className="text-xs font-semibold text-[#555]">{player?.score ?? 0}/{result.total_rounds} · {player?.mistakes ?? 0} wrong</span></div>
            <div className="mt-2 flex flex-wrap gap-1">{(player?.words || []).map((word) => <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#555]" key={word}>{word}</span>)}</div>
          </div>)}
        </div>
      </div> : null}

      {category === "word_search" && Array.isArray(result?.grid) ? <div className="mt-3 space-y-3">
        <div className="mx-auto grid w-full max-w-[300px] grid-cols-12 gap-[2px] rounded-lg bg-[#f0f2f5] p-2" aria-label="Solved word search grid">
          {result.grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => <span className="grid aspect-square place-items-center rounded-[2px] bg-white text-[9px] font-bold text-[#444] sm:text-[10px]" key={`${rowIndex}-${colIndex}`}>{letter}</span>))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ label: userLabel, player: result.user_a, tint: "text-[#e1306c]" }, { label: partnerLabel, player: result.user_b, tint: "text-[#0095f6]" }].map(({ label, player, tint }) => <div className="rounded-xl bg-[#fafafa] p-3" key={label}>
            <p className={`text-xs font-bold ${tint}`}>{label} · {player?.score ?? player?.words?.length ?? 0}/{result.total_words}</p>
            <div className="mt-2 flex flex-wrap gap-1">{(player?.words || []).map((word) => <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#555]" key={word}>{word}</span>)}</div>
          </div>)}
        </div>
      </div> : null}

      <div className="mt-3 space-y-2">
        {questions.map((item, idx) => (
          <ResultRow
            category={category}
            result={result}
            currentUserId={currentUserId}
            item={item}
            key={`${item?.question || "q"}-${idx}`}
            partnerLabel={partnerLabel}
            userLabel={userLabel}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-[#e7e7e7] pt-3">
        {category === "choose_your_adventure" ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-[#fff3f7] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#e1306c]">Your ending</p><p className="mt-1 text-sm text-[#262626]">{result?.user_a_ending || "Your path is complete."}</p></div>
            <div className="rounded-xl bg-[#f0f8ff] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#0095f6]">{partnerLabel}'s ending</p><p className="mt-1 text-sm text-[#262626]">{result?.user_b_ending || "Their path is complete."}</p></div>
          </div>
        ) : null}
        <p className="text-[1rem] text-[#262626]">
          {result?.summary || "Result ready."}
        </p>
      </div>
    </section>
  );
}
