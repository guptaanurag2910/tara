import { useEffect, useState } from "react";
import GameTurnIndicator from "./GameTurnIndicator";

function SceneArt({ sceneId, variant }) {
  const pic = sceneId === "picnic_park";
  const cafe = sceneId === "cozy_cafe";
  const beach = sceneId === "beach_day";
  const sky = cafe ? "#fff0d8" : beach ? "#d8f5ff" : "#c9efff";
  const ground = cafe ? "#ecd5bb" : beach ? "#ffe6a6" : "#b6e6a1";
  const accent = cafe ? "#b77b5b" : beach ? "#f28b76" : "#7466d8";
  return <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000">
    <rect width="1000" height="1000" fill={sky} />
    <circle cx="835" cy="175" r="76" fill={variant && beach ? "#ff8b76" : "#ffd15c"} />
    {pic ? <g stroke="#f4a93e" strokeWidth="14" strokeLinecap="round">{(variant ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7]).map((ray) => <path key={ray} d="M835 82 V56" transform={`rotate(${ray * (variant ? 60 : 45)} 835 175)`} />)}</g> : null}
    {!cafe && !beach ? <g fill="#fff" opacity=".94"><ellipse cx="490" cy="155" rx={variant ? 80 : 68} ry="36"/><ellipse cx="540" cy="155" rx="58" ry="30"/><ellipse cx="455" cy="165" rx="42" ry="25"/></g> : null}
    <rect y="570" width="1000" height="430" fill={ground} />
    {pic ? <>
      <rect x="70" y="360" width="82" height="260" rx="24" fill="#8a5b3e"/><circle cx="112" cy="310" r="140" fill="#5da66e"/><circle cx="170" cy="350" r="82" fill="#69b978"/>
      <path d={variant ? "M180 250 L110 330 L215 330 Z" : "M180 250 L110 330 L180 360 L250 330 Z"} fill={accent}/><path d="M180 350 L180 415 L140 455 M180 415 L220 460" fill="none" stroke="#7a5b49" strokeWidth="12"/>
      <path d="M370 710 Q500 650 640 710 L610 870 Q500 920 385 860Z" fill="#ff8aa0"/><path d="M395 750 L625 750 M390 810 L620 810" stroke="#fff4ea" strokeWidth="24"/>
      <rect x="480" y="625" width="145" height="108" rx="22" fill="#b97843"/><path d="M500 625 Q550 555 605 625" fill="none" stroke="#87522f" strokeWidth="18"/><circle cx={variant ? "550" : "585"} cy="675" r="18" fill="#ffdb68"/>
      <g transform="translate(230 800)"><circle r="27" fill={variant ? "#ff795e" : "#ffda68"}/><circle cy="-34" r="18" fill="#ffda68"/><circle cx="32" r="18" fill="#ffda68"/><circle cy="34" r="18" fill="#ffda68"/><circle cx="-32" r="18" fill="#ffda68"/><circle r="10" fill="#80533d"/></g>
      {variant ? null : <path d="M680 386 q30 -30 60 0 q30 -30 60 0" fill="none" stroke="#344860" strokeWidth="15" strokeLinecap="round"/>}
    </> : null}
    {cafe ? <>
      <rect x="110" y="200" width="780" height="410" rx="36" fill="#fffaf0" stroke="#d7b899" strokeWidth="20"/><circle cx="500" cy="160" r="55" fill="#fff" stroke="#a66a51" strokeWidth="14"/><path d={variant ? "M500 160 L500 125 M500 160 L530 160" : "M500 160 L530 135 M500 160 L500 115"} stroke="#754b3c" strokeWidth="12" strokeLinecap="round"/>
      <path d="M120 330 H880" stroke="#e4c8a8" strokeWidth="15"/><path d="M240 610 V330 M750 610 V330" stroke="#a9d8e5" strokeWidth="28"/><rect x="260" y="665" width="500" height="46" rx="20" fill="#8d604b"/><path d="M330 710 V890 M690 710 V890" stroke="#805640" strokeWidth="22"/><path d="M270 200 V285" stroke="#805640" strokeWidth="12"/><path d={variant ? "M220 325 L320 325 L300 285 L240 285Z" : "M220 325 L320 325 L305 285 L235 285Z"} fill={variant ? "#f3a66b" : "#f0c75e"}/>
      <rect x="380" y="595" width="160" height="18" rx="8" fill="#fff"/><path d="M400 585 Q410 505 480 545 Q510 510 530 585Z" fill="#d99854"/><circle cx={variant ? "445" : "475"} cy="545" r="11" fill={variant ? "#e85d75" : "#fff0b3"}/><path d="M610 565 h86 v82 q-4 36 -43 36 q-40 0 -43 -36z" fill={variant ? "#f49b83" : "#8fc6bc"}/><path d="M696 585 q45 -5 28 42 q-8 18 -28 12" fill="none" stroke="#805640" strokeWidth="14"/>
      <path d="M160 600 l38 -92 l38 92z" fill={variant ? "#83c77b" : "#6ba77b"}/><path d="M198 600 v50" stroke="#aa7555" strokeWidth="15"/><path d="M830 285 h-95 v105 h95z" fill="#ebaa72"/><text x="782" y="350" textAnchor="middle" fontSize="28" fontWeight="800" fill="#fff">{variant ? "TEA" : "CAKE"}</text>
    </> : null}
    {beach ? <>
      <path d="M0 560 Q280 490 500 565 T1000 540 V650 H0Z" fill="#65c7dc"/><path d="M0 620 Q260 555 500 625 T1000 600" fill="none" stroke="#e6fbff" strokeWidth="20"/>
      <path d="M130 490 L260 260 L390 490Z" fill={variant ? "#75b9f1" : "#f28b76"}/><path d="M260 490 V575" stroke="#93633c" strokeWidth="22"/><path d="M130 490 H390" stroke="#fff4d4" strokeWidth="20"/>
      <path d="M520 780 L585 675 L650 780Z" fill="#e1a45a"/><path d="M535 780 L585 640 L635 780Z" fill="#efbd74"/>{variant ? <path d="M565 710 L585 665 L605 710Z" fill="#ffe1a6"/> : null}<rect x="545" y="775" width="80" height="70" fill="#cf8c4c"/>
      <circle cx="770" cy="720" r="72" fill={variant ? "#65c7dc" : "#ff7796"}/><path d="M770 648 Q820 720 770 792 M698 720 Q770 670 842 720" fill="none" stroke="#fff" strokeWidth="10"/><path d="M650 360 l85 -80 l10 90z" fill={variant ? "#f28b76" : "#fff"} stroke="#476a83" strokeWidth="8"/><path d="M735 370 L690 430 H800Z" fill="#f28b76"/><path d="M690 435 H805" stroke="#476a83" strokeWidth="10"/>
      <path d="M330 850 q40 -45 85 0 q-45 50 -85 0z" fill={variant ? "#f5a4b5" : "#fff"}/>
    </> : null}
    {cafe ? <rect y="895" width="1000" height="105" fill="#d9b997"/> : null}
    {pic ? <path d="M0 900 Q200 860 380 915 T760 900 T1000 925 V1000 H0Z" fill="#8bcf82"/> : null}
    <rect x="8" y="8" width="984" height="984" rx="40" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="16" />
  </svg>;
}

export default function SpotTheDifferenceGame({ state, sessionId, currentUserId, partnerName = "Your match", onAction, onClose, socketError = "" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const turnUserId = Number(state?.turn_user_id || 0);
  const myTurn = turnUserId === Number(currentUserId);
  const complete = Boolean(state?.completed);
  const myScore = Number(state?.scores?.[String(currentUserId)] || 0);
  const partnerScore = Number(Object.entries(state?.scores || {}).find(([id]) => Number(id) !== Number(currentUserId))?.[1] || 0);
  const last = state?.last_attempt;
  const turnStatus = complete ? state?.draw ? "A tie · you spotted them all together 🤝" : Number(state?.winner_user_id) === Number(currentUserId) ? "Sharp eyes · you win! 🏆" : `${partnerName} found more differences 🏆` : myTurn ? "Your turn · find a difference" : `${partnerName} is searching`;
  useEffect(() => { setBusy(false); setError(""); }, [state?.attempts, state?.completed]);
  useEffect(() => { if (socketError) { setBusy(false); setError(socketError); } }, [socketError]);

  function guess(event) {
    if (!myTurn || busy || complete || !onAction) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1000;
    const y = ((event.clientY - rect.top) / rect.height) * 1000;
    setBusy(true); setError("");
    try {
      if (onAction({ session_id: sessionId, action: "spot", x, y }) === false) throw new Error("Reconnect to keep looking.");
    } catch (err) { setBusy(false); setError(err?.message || "Could not save that spot."); }
  }

  const found = new Set((state?.found || []).map(String));
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
    <section className="max-h-[96dvh] w-full max-w-2xl overflow-y-auto rounded-[22px] border border-slate-200 bg-white p-3 shadow-2xl sm:p-5" data-testid="spot-difference-game">
      <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-amber-600">🔍 Spot the Difference</p><h2 className="mt-1 text-xl font-black text-slate-900">{state?.scene_title || "Find what changed"}</h2><p className="mt-1 text-xs text-slate-500">Take turns tapping a difference. Correct finds earn a point.</p></div><button aria-label="Close Spot the Difference" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xl text-slate-500" onClick={onClose} type="button">×</button></header>
      <div className="mt-3"><GameTurnIndicator status={turnStatus} detail={complete ? "The finished scene is saved in chat." : myTurn ? "Tap the changed detail in either picture. A miss passes the turn." : "Your board is saved. Come back when it’s your turn."} isMyTurn={myTurn} gameOver={complete} testId="spot-difference-turn" players={[{ name: "You", active: myTurn && !complete, status: `${myScore} found${myTurn ? " · Your move" : ""}` }, { name: partnerName, active: !myTurn && !complete, status: `${partnerScore} found${!myTurn && !complete ? " · Their move" : ""}` }]} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3" data-testid="spot-difference-pictures">
        {[{ name: "Picture A", variant: false }, { name: "Picture B", variant: true }].map((picture) => <button aria-label={`${picture.name}, tap to search`} className={`relative block aspect-square w-full overflow-hidden rounded-2xl border-2 bg-sky-50 ${myTurn && !complete ? "cursor-crosshair border-amber-200 hover:border-amber-400" : "cursor-default border-slate-200"}`} disabled={!myTurn || complete || busy} key={picture.name} onClick={guess} type="button"><SceneArt sceneId={state?.scene_id} variant={picture.variant} /><svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000">{(state?.found_markers || (state?.differences || []).filter((item) => found.has(String(item.id))) || []).map((marker) => <g key={marker.id}><circle cx={marker.x} cy={marker.y} r="58" fill="none" stroke="#fff" strokeWidth="24" opacity=".95"/><circle cx={marker.x} cy={marker.y} r="58" fill="none" stroke="#16a34a" strokeWidth="15"/></g>)}</svg><span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-extrabold text-slate-600">{picture.name === "Picture A" ? "A" : "B"}</span></button>)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span>{found.size} / {state?.difference_count || 6} found</span><span>{myTurn ? "Tap either image to search" : "Waiting for your match"}</span></div>
      {last ? <div aria-live="polite" className={`mt-2 rounded-xl p-3 text-center text-sm font-bold ${last.correct ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`} data-testid="spot-difference-feedback">{last.correct ? Number(last.user_id) === Number(currentUserId) ? "Nice find! Point earned · your match goes next ✨" : `Nice find! ${partnerName} scored · your turn ✨` : Number(last.user_id) === Number(currentUserId) ? "Not quite — your match gets the next turn." : `${partnerName} missed. Your turn to search!`}{last.difference_label ? <span className="mt-1 block text-xs font-medium">{last.difference_label}</span> : null}</div> : null}
      {complete ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-900">{state.draw ? "You spotted everything together. It’s a tie! 🤝" : Number(state.winner_user_id) === Number(currentUserId) ? "You have the sharpest eyes! 🏆" : `${partnerName} spotted more differences. Rematch? 🔍`}</div> : null}
      {error ? <p className="mt-2 text-center text-xs font-semibold text-rose-600" role="alert">{error}</p> : null}
    </section>
  </div>;
}
