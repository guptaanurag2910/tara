import { useEffect, useState } from "react";

function lineBetween(start, end) {
  const dr = end[0] - start[0];
  const dc = end[1] - start[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const rowStep = Math.sign(dr);
  const colStep = Math.sign(dc);
  return Array.from({ length: steps + 1 }, (_, offset) => [start[0] + rowStep * offset, start[1] + colStep * offset]);
}

export default function WordSearchGame({ state, sessionId, onSelect, onClose, socketError = "" }) {
  const [selection, setSelection] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const foundWords = state?.found_words || [];
  const foundCells = new Set(Object.values(state?.found_paths || {}).flat().map(([row, col]) => `${row},${col}`));
  const selectedCells = new Set(selection.map(([row, col]) => `${row},${col}`));

  useEffect(() => { setBusy(false); setError(""); setSelection([]); }, [state?.found_count, state?.phase]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  function chooseCell(row, col) {
    if (state?.your_completed || busy || foundCells.has(`${row},${col}`)) return;
    if (!selection.length) {
      setSelection([[row, col]]);
      setError("");
      return;
    }
    if (selection.length === 1) {
      const path = lineBetween(selection[0], [row, col]);
      if (path && path.length > 1) {
        setSelection(path);
        setError("");
      } else {
        setSelection([[row, col]]);
      }
      return;
    }
    setSelection([[row, col]]);
    setError("");
  }

  function submitSelection() {
    if (!selection.length || busy) return;
    setBusy(true); setError("");
    try {
      if (onSelect?.({ session_id: sessionId, cells: selection }) === false) throw new Error("Reconnect to continue the game.");
    } catch (submitError) {
      setBusy(false); setError(submitError?.message || "Could not check that word.");
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-[20px] border border-[#e7e7e7] bg-white p-3 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5" data-testid="word-search-modal">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">🔎 Word Search</p><h2 className="mt-1 text-xl font-bold text-[#262626]">{state?.your_completed ? "Your grid is complete!" : "Find the hidden words"}</h2><p className="mt-1 text-sm text-[#737373]">Tap a first letter, then the last letter of the word.</p></div>
        <button aria-label="Close Word Search" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-[#737373]" onClick={onClose} type="button">×</button>
      </header>
      {state?.grid?.length ? <>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fafafa] px-3 py-2 text-sm"><span className="font-semibold text-[#262626]">Found {state.found_count || 0} / {state.total_words || state.words?.length || 10}</span><span className="text-xs text-[#737373]">Your progress stays private</span></div>
        <div className="mt-3 grid grid-cols-12 gap-[2px] rounded-xl border bg-[#f0f2f5] p-1 sm:gap-1 sm:p-2" role="grid" aria-label="Word search grid">
          {state.grid.flatMap((line, row) => line.map((letter, col) => {
            const key = `${row},${col}`;
            const isSelected = selectedCells.has(key);
            const isFound = foundCells.has(key);
            return <button key={key} aria-label={`Row ${row + 1}, column ${col + 1}, ${letter}`} aria-pressed={isSelected || isFound} className={`aspect-square min-w-0 rounded-[3px] text-[0.66rem] font-bold transition sm:rounded-md sm:text-sm ${isSelected ? "bg-[#e1306c] text-white" : isFound ? "bg-[#d9f4e4] text-[#167744]" : "bg-white text-[#262626] hover:bg-[#fff3f7]"} disabled:cursor-default`} disabled={Boolean(state.your_completed) || isFound} onClick={() => chooseCell(row, col)} role="gridcell" type="button">{letter}</button>;
          }))}
        </div>
        <div className="mt-3 rounded-xl border border-[#eee] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">Find these words</p><div className="mt-2 flex flex-wrap gap-2">{(state.words || []).map((word) => <span key={word} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${foundWords.includes(word) ? "bg-[#e5f7ec] text-[#167744] line-through" : "bg-[#f5f5f5] text-[#444]"}`}>{word}</span>)}</div></div>
        {selection.length ? <p className="mt-2 text-center text-xs font-semibold tracking-wider text-[#e1306c]">{selection.map(([row, col]) => state.grid[row]?.[col]).join("")}</p> : null}
        <div className="mt-3 flex gap-2"><button className="flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold text-[#737373] disabled:opacity-50" disabled={!selection.length || busy} onClick={() => setSelection([])} type="button">Clear selection</button><button className="flex-1 rounded-full bg-[#e1306c] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={selection.length < 2 || busy || state.your_completed} onClick={submitSelection} type="button">{busy ? "Checking…" : "Check word"}</button></div>
        {state.your_completed ? <div className="mt-3 rounded-xl bg-[#f7f8ff] px-4 py-4 text-center"><p className="font-semibold text-[#262626]">{state.match_completed ? "You both finished!" : "Waiting for your match to finish"}</p><p className="mt-1 text-sm text-[#737373]">Your completed grid is saved. Come back any time to see the reveal.</p></div> : null}
      </> : <div className="mt-5 rounded-2xl bg-[#f7f8ff] px-4 py-8 text-center"><p className="font-semibold text-[#262626]">Loading your puzzle…</p></div>}
      {error ? <p className="mt-3 text-center text-sm text-[#d62964]">{error}</p> : null}
    </section>
  </div>;
}
