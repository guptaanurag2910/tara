import { useEffect, useRef } from "react";
import { Activity, Heart, Moon, Sparkles, UserRound, X } from "lucide-react";

import KundaliChart from "./KundaliChart";

const KUTAS = [
  ["varna", "Varna", "Traditional values and outlook comparison."],
  ["vashya", "Vashya", "Traditional sign-based influence compatibility."],
  ["tara", "Tara", "Nakshatra distance used in traditional matching."],
  ["yoni", "Yoni", "Traditional instinctive-chemistry category."],
  ["graha_maitri", "Graha Maitri", "Friendship between the Moon-sign rulers."],
  ["gana", "Gana", "Traditional temperament-category comparison."],
  ["bhakoot", "Bhakoot", "Relationship between the two Moon signs."],
  ["nadi", "Nadi", "Traditional Nadi category comparison."],
];

function display(value, fallback = "Not available") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function points(value, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return `— / ${max}`;
  return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)} / ${max}`;
}

function weightedOverall(kundaliScore, personalityScore, astrologyWeight) {
  const kundali = Number(kundaliScore);
  const personality = Number(personalityScore);
  if (!Number.isFinite(kundali) || !Number.isFinite(personality)) return null;
  return Math.round((kundali / 36) * astrologyWeight + (personality / 100) * (100 - astrologyWeight));
}

function ProfileCard({ user }) {
  const kundali = user?.kundali;
  const chart = kundali?.chart_data || {};
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        {user?.photos?.[0] ? <img src={user.photos[0]} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-violet-700"><UserRound size={21} /></span>}
        <div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{display(user?.name, "Unnamed user")}</h3><p className="truncate text-xs text-slate-500">{display(user?.email)}</p></div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
        <div><dt className="text-xs text-slate-400">Moon sign</dt><dd className="mt-0.5 font-medium capitalize">{display(kundali?.moon_sign)}</dd></div>
        <div><dt className="text-xs text-slate-400">Nakshatra</dt><dd className="mt-0.5 font-medium">{display(kundali?.nakshatra)}{kundali?.nakshatra_pada ? ` · Pada ${kundali.nakshatra_pada}` : ""}</dd></div>
        <div><dt className="text-xs text-slate-400">Lagna</dt><dd className="mt-0.5 font-medium capitalize">{display(kundali?.lagna)}</dd></div>
        <div><dt className="text-xs text-slate-400">Birth time</dt><dd className="mt-0.5 font-medium">{display(user?.birth_time)}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-400">Birth details</dt><dd className="mt-0.5 font-medium">{display(user?.date_of_birth)} · {display(user?.birth_place)}{kundali?.timezone_name ? ` · ${kundali.timezone_name}` : ""}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-400">Birth coordinates</dt><dd className="mt-0.5 font-medium">{user?.latitude != null && user?.longitude != null ? `${Number(user.latitude).toFixed(4)}, ${Number(user.longitude).toFixed(4)}` : "Not stored"}</dd></div>
      </dl>
      {user?.bio ? <p className="mt-4 line-clamp-3 text-sm leading-5 text-slate-600">{user.bio}</p> : null}
      {user?.interests?.length ? <p className="mt-2 text-xs text-slate-500">Interests: {user.interests.join(", ")}</p> : null}
      {kundali ? <>
        <div className="mt-5 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lagna chart</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${kundali.is_accurate ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{kundali.is_accurate ? "Birth time provided" : "Time uncertain"}</span></div>
        {chart.houses && chart.planets ? <KundaliChart className="mt-2" houses={chart.houses} planets={chart.planets} timeKnown={kundali.is_accurate} /> : <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Chart placements are not stored for this profile.</p>}
      </> : <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No Kundali profile is available for this user.</p>}
    </article>
  );
}

export default function RecommendationDetailPanel({ recommendation, detail, loading, error, onClose, astrologyWeight = 80 }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!recommendation) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("button")?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [recommendation, onClose]);

  if (!recommendation) return null;
  const users = detail?.users || [];
  const score = detail?.score_snapshot || {};
  const kundaliMatch = detail?.kundali_match || {};
  const personalityMatch = detail?.personality_match || {};
  const previewOverall = weightedOverall(score.kundali, score.personality, astrologyWeight);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/45" onClick={onClose}>
      <section aria-labelledby="recommendation-detail-title" aria-modal="true" className="h-full w-full overflow-y-auto bg-[#f8fafc] p-4 shadow-2xl sm:p-6 xl:max-w-6xl" onClick={(event) => event.stopPropagation()} ref={dialogRef} role="dialog" tabIndex={-1}>
        <header className="sticky top-[-16px] z-10 -mx-4 -mt-4 flex items-start justify-between border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6">
          <div><p className="text-xs font-bold uppercase tracking-wider text-violet-700">Recommendation · #{recommendation.id}</p><h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl" id="recommendation-detail-title">Compatibility details</h2><p className="mt-1 text-sm text-slate-500">See the saved recommendation scores and the current profile comparisons.</p></div>
          <button aria-label="Close recommendation details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><X size={20} /></button>
        </header>

        {loading ? <div className="grid min-h-64 place-items-center text-sm text-slate-500">Loading both profiles and match details…</div> : null}
        {!loading && error ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{error}</div> : null}
        {!loading && detail ? <div className="space-y-6 py-5">
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-violet-700 p-5 text-white sm:col-span-1"><p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Overall at {astrologyWeight}/{100 - astrologyWeight} weights</p><p className="mt-2 text-4xl font-bold">{previewOverall ?? "—"}<span className="text-xl">{previewOverall == null ? "" : "%"}</span></p><p className="mt-2 text-xs text-violet-100">Saved score: {score.overall == null ? "Not available" : `${Math.round(Number(score.overall))}%`} · captured {score.captured_at ? new Date(score.captured_at).toLocaleString() : "when generated"}</p></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Moon size={16} className="text-violet-600" /> Astrology</div><p className="mt-2 text-2xl font-bold">{points(score.kundali, 36)}</p><p className="mt-1 text-xs text-slate-500">Saved recommendation score</p></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Heart size={16} className="text-rose-500" /> Personality</div><p className="mt-2 text-2xl font-bold">{score.personality == null ? "Not available" : `${Math.round(Number(score.personality))}%`}</p><p className="mt-1 text-xs text-slate-500">{personalityMatch.available ? "Saved score; current trait comparison below" : "One or both profiles have no shared trait data"}</p></article>
          </section>

          <section className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm leading-6 text-slate-700 sm:p-5">
            <h3 className="font-semibold text-slate-900">How the saved overall score is formed</h3>
            <p className="mt-1">This preview uses Astrology at {astrologyWeight}% and Personality at {100 - astrologyWeight}%: (Ashtakoota points ÷ 36 × {astrologyWeight}) + (personality similarity ÷ 100 × {100 - astrologyWeight}). The saved numbers are a snapshot from when the recommendation was generated; the breakdowns below use the profiles as they exist now.</p>
            <p className="mt-1">The selected weights recalculate the admin preview. They do not change the stored recommendation scores or member-facing rankings.</p>
            {!personalityMatch.available ? <p className="mt-2 font-medium text-amber-800">The saved algorithm may have treated missing or non-overlapping personality traits as 0. The current profile comparison is unavailable, so read the saved personality score with that limitation.</p> : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><Sparkles size={18} /></span><div><h3 className="font-semibold">Ashtakoota breakdown</h3><p className="mt-1 text-sm text-slate-500">{kundaliMatch.available ? `Current profile calculation: ${points(kundaliMatch.total_score, 36)} · ${kundaliMatch.compatibility}` : kundaliMatch.reason || "Kundali comparison unavailable."}</p></div></div>
            {kundaliMatch.available ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {KUTAS.map(([key, label, description]) => {
                const value = Number(kundaliMatch.breakdown?.[key] || 0);
                const max = key === "varna" ? 1 : key === "vashya" ? 2 : key === "tara" ? 3 : key === "yoni" ? 4 : key === "graha_maitri" ? 5 : key === "gana" ? 6 : key === "bhakoot" ? 7 : 8;
                return <article className="rounded-xl bg-slate-50 p-3" key={key}><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{label}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><strong className="shrink-0 text-sm text-violet-800">{points(value, max)}</strong></div><div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div></article>;
              })}
            </div> : null}
            <p className="mt-4 text-xs leading-5 text-slate-400">Traditional astrology matching rules; this breakdown is an interpretive framework, not a relationship prediction.</p>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><Activity size={17} className="text-violet-700" /><div><h3 className="font-semibold">Both birth charts</h3><p className="text-xs text-slate-500">Current chart profiles are shown below; these may differ from the saved recommendation score if a profile changed later.</p></div></div>
            {users.length === 2 ? <div className="grid items-start gap-4 xl:grid-cols-2"><ProfileCard user={users[0]} /><ProfileCard user={users[1]} /></div> : <p className="rounded-xl bg-white p-4 text-sm text-slate-500">Could not load both user profiles.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><Heart size={17} /></span><div><h3 className="font-semibold">Personality comparison</h3><p className="mt-1 text-sm text-slate-500">{personalityMatch.available ? `Current shared-trait similarity: ${personalityMatch.score}%` : personalityMatch.status === "no_shared_traits" ? "Both profiles exist, but there are no shared traits to compare." : "Personality results are incomplete for this pair."}</p></div></div>
            {personalityMatch.available ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-2">Trait</th><th className="py-2">{users[0]?.name || "User 1"}</th><th className="py-2">{users[1]?.name || "User 2"}</th><th className="py-2">Similarity</th></tr></thead><tbody className="divide-y divide-slate-100">{personalityMatch.traits.map((item) => <tr key={item.trait}><td className="py-3 font-medium capitalize">{item.trait.replace(/_/g, " ")}</td><td className="py-3">{item.user_a}</td><td className="py-3">{item.user_b}</td><td className="py-3 font-semibold text-violet-700">{Math.round(item.similarity)}%</td></tr>)}</tbody></table></div> : null}
            <p className="mt-4 text-xs leading-5 text-slate-400">Personality similarities compare the shared numeric traits in the stored profiles. They are not a psychological assessment.</p>
          </section>
        </div> : null}
      </section>
    </div>
  );
}
