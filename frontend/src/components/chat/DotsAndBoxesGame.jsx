import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

export default function DotsAndBoxesGame({ state, sessionId, currentUserId, partnerName = "Your match", onMove, onClose, socketError = "" }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const marks = state?.marks || {};
  const scores = state?.scores || {};
  const myMark = marks[String(currentUserId)] || "X";
  const myTurn = Number(state?.turn_user_id) === Number(currentUserId);
  const finished = Boolean(state?.completed);
  const opponentScore = Object.entries(scores).find(([id]) => Number(id) !== Number(currentUserId))?.[1] ?? 0;
  const myScore = scores[String(currentUserId)] ?? 0;
  const partnerMark = myMark === "X" ? "O" : "X";
  const turnStatus = finished
    ? state.draw ? "Game over · Tie" : Number(state.winner_user_id) === Number(currentUserId) ? "You won!" : `${partnerName} won!`
    : myTurn ? "Your turn" : `${partnerName}’s turn`;

  useEffect(() => { setSubmitting(false); setError(""); }, [state?.last_move, state?.completed]);
  useEffect(() => { if (socketError) { setSubmitting(false); setError(socketError); } }, [socketError]);

  function chooseEdge(orientation, row, col) {
    if (!onMove || submitting || !myTurn || finished) return;
    setSubmitting(true); setError("");
    try {
      if (onMove({ session_id: sessionId, orientation, row, col }) === false) throw new Error("Reconnect to make your move.");
    } catch (moveError) {
      setSubmitting(false); setError(moveError?.message || "Could not save that line.");
    }
  }

  function edgeButton(orientation, row, col, owner) {
    const horizontal = orientation === "horizontal";
    const occupied = owner !== null && owner !== undefined;
    const color = owner === "X" ? "after:bg-[#e1306c]" : owner === "O" ? "after:bg-[#0095f6]" : "after:bg-[#d1d5db]";
    return <button aria-label={`${horizontal ? "Horizontal" : "Vertical"} line row ${row + 1} column ${col + 1}${occupied ? ` claimed by ${owner}` : " available"}`} className={`relative grid aspect-square place-items-center disabled:cursor-default ${horizontal ? "after:absolute after:left-0 after:top-1/2 after:h-[3px] after:w-full after:-translate-y-1/2" : "after:absolute after:left-1/2 after:top-0 after:h-full after:w-[3px] after:-translate-x-1/2"} ${color} ${!occupied && myTurn && !finished ? "hover:after:bg-[#e1306c]/70" : ""}`} disabled={occupied || !myTurn || finished || submitting} key={`${orientation}-${row}-${col}`} onClick={() => chooseEdge(orientation, row, col)} type="button" />;
  }

  const cells = [];
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      if (row % 2 === 0 && col % 2 === 0) {
        cells.push(<div aria-hidden="true" className="z-10 grid aspect-square place-items-center" key={`dot-${row}-${col}`}><span className="h-2.5 w-2.5 rounded-full bg-[#31343b] sm:h-3 sm:w-3" /></div>);
      } else if (row % 2 === 0) {
        const r = row / 2; const c = (col - 1) / 2;
        cells.push(edgeButton("horizontal", r, c, state?.horizontal?.[r]?.[c]));
      } else if (col % 2 === 0) {
        const r = (row - 1) / 2; const c = col / 2;
        cells.push(edgeButton("vertical", r, c, state?.vertical?.[r]?.[c]));
      } else {
        const r = (row - 1) / 2; const c = (col - 1) / 2;
        const owner = state?.boxes?.[r]?.[c];
        cells.push(<div aria-label={owner ? `Box claimed by ${owner}` : "Unclaimed box"} className={`grid aspect-square place-items-center text-lg font-black ${owner === "X" ? "bg-[#fff0f5] text-[#e1306c]" : owner === "O" ? "bg-[#eff8ff] text-[#0095f6]" : ""}`} key={`box-${r}-${c}`}>{owner || ""}</div>);
      }
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="w-full max-w-md rounded-[20px] border border-[#e7e7e7] bg-white p-4 font-[DM_Sans] shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-5" data-testid="dots-and-boxes-modal">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#e1306c]">🔲 Dots and Boxes</p><h2 className="mt-1 text-xl font-bold text-[#262626]">Shared board</h2><p className="mt-1 text-sm text-[#737373]">Complete a box to score and earn another turn.</p></div><button aria-label="Close Dots and Boxes" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-[#737373]" onClick={onClose} type="button">×</button></header>
      <div className="mt-4">
        <GameTurnIndicator
          status={turnStatus}
          detail={finished ? "The final board is saved in chat." : myTurn ? "Choose an open line to connect two dots." : `${partnerName} is choosing a line. You can come back anytime.`}
          isMyTurn={myTurn}
          gameOver={finished}
          testId="dots-and-boxes-turn-status"
          players={[
            { name: "You", mark: myMark, active: myTurn, status: `${myScore} boxes${myTurn ? " · Playing now" : " · Up next"}` },
            { name: partnerName, mark: partnerMark, active: !myTurn, status: `${opponentScore} boxes${!myTurn ? " · Playing now" : " · Up next"}` },
          ]}
        />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#fafafa] px-3 py-2 text-xs"><span className="font-semibold text-[#262626]">You · <b className={myMark === "X" ? "text-[#e1306c]" : "text-[#0095f6]"}>{myMark}</b> · {myScore} boxes</span><span className="font-semibold text-[#262626]">Match · <b className={myMark === "X" ? "text-[#0095f6]" : "text-[#e1306c]"}>{myMark === "X" ? "O" : "X"}</b> · {opponentScore} boxes</span></div>
      <div aria-label="Dots and Boxes board" className="mx-auto mt-4 grid w-full max-w-[340px] grid-cols-7" role="grid">{cells}</div>
      <p className="mt-3 text-center text-xs text-[#737373]">{finished ? "The final board is saved in chat." : "A completed box earns a point and another turn."}</p>
      {error ? <p className="mt-2 text-center text-xs text-[#d62964]">{error}</p> : null}
    </section>
  </div>;
}
