import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Moon, Sparkles, Sun } from "lucide-react";

import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Loader from "../components/Loader";
import { fetchMatchDetail } from "../services/matchingService";

function matchErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status === 404) {
    return "This match isn't available anymore.";
  }
  if (status >= 500) {
    return "Compatibility details are unavailable right now. Please try again shortly.";
  }
  return apiError?.message || "Could not load this match.";
}

function label(value, fallback = "") {
  const normalized = String(value || fallback || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function insightPreview(text) {
  const preview = String(text || "").split(/[.!?]/)[0]?.trim();
  return preview || "Your stars suggest an emotionally aligned connection.";
}

function traitsFromInsight(insight) {
  const words = insightPreview(insight).split(/\s+/).filter(Boolean);
  const base = ["Intuitive", "Grounded", "Warm", "Curious"];
  if (words.length < 4) {
    return base;
  }
  return [words[0], words[1], words[2], words[3]].map((word) => label(word.replace(/[^a-z]/gi, "")) || "Aligned");
}

function Stat({ icon, label: statLabel, value, note }) {
  return (
    <div className="tara-screen-panel rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[color:var(--tara-gold)]">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">{statLabel}</span>
      </div>
      <p className="mt-1 font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-primary)]">{value}</p>
      <p className="text-[11px] text-[color:var(--tara-text-secondary)]">{note}</p>
    </div>
  );
}

function Attribute({ label: attributeLabel, value, icon }) {
  return (
    <div className="tara-list-row flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--tara-violet)_16%,transparent)]">{icon}</div>
        <span className="text-sm text-[color:var(--tara-text-secondary)]">{attributeLabel}</span>
      </div>
      <span className="font-[var(--font-serif)] text-xl text-[color:var(--tara-text-primary)]">{value}</span>
    </div>
  );
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMatchDetail(matchId);
        setDetail(data || null);
      } catch (apiError) {
        setError(matchErrorMessage(apiError));
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [matchId]);

  const name = detail?.user?.name || "Match";
  const age = detail?.user?.age ? `, ${detail.user.age}` : "";
  const compatibility = Number(detail?.compatibility_score ?? 0);
  const kundaliScore = Number(detail?.kundali_score ?? 0);
  const personalityScore = Number(detail?.personality_score ?? 0);
  const insight = detail?.insight || "Your stars suggest an emotionally aligned connection.";
  const hasDetail = Boolean(detail) && !error;

  const moonSign = useMemo(() => {
    const source = detail?.user?.moon_sign || detail?.moon_sign || "";
    return label(source);
  }, [detail?.moon_sign, detail?.user?.moon_sign]);

  const sunSign = useMemo(() => {
    const source = detail?.user?.sun_sign || detail?.sun_sign || "";
    return label(source);
  }, [detail?.sun_sign, detail?.user?.sun_sign]);

  const nakshatra = useMemo(() => {
    const source = detail?.user?.nakshatra || detail?.nakshatra || "";
    return label(source);
  }, [detail?.nakshatra, detail?.user?.nakshatra]);

  const traits = useMemo(() => traitsFromInsight(insight), [insight]);
  const hasKundaliAttributes = Boolean(sunSign || moonSign || nakshatra);

  return (
    <main className="tara-page-shell px-5 pb-28 pt-6">
      <header className="mb-4 flex items-center gap-3">
        <button
          aria-label="Back"
          className="tara-back-btn"
          onClick={() => navigate("/matches")}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="tara-kicker">Match details</p>
          <h1 className="tara-type-section mt-1 text-[2.2rem]">Cosmic compatibility</h1>
        </div>
      </header>

      {loading ? (
        <div className="tara-screen-panel p-5">
          <Loader text="Loading compatibility..." />
        </div>
      ) : null}

      {!loading && error ? (
        <EmptyState
          action={(
            <Button onClick={() => navigate("/matches")} type="button" variant="ghost">
              Back to matches
            </Button>
          )}
          subtitle={error}
          title="Match unavailable"
        />
      ) : null}

      {!loading && !error && hasDetail ? (
        <div className="space-y-4">
          <section className="tara-screen-intro tara-scene-motif p-5" data-scene="night">
            <div className="flex items-start gap-4">
              {detail?.user?.photo ? (
                <img
                  alt={name}
                  className="h-28 w-24 rounded-[1.4rem] border border-[color:var(--tara-card-border)] object-cover shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                  src={detail.user.photo}
                />
              ) : (
                <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-[1.4rem] border border-[color:var(--tara-card-border)] bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--tara-color-soft-blue)_38%,transparent)_0%,color-mix(in_srgb,var(--tara-violet)_34%,transparent)_45%,transparent_100%)] text-3xl font-semibold text-[color:var(--tara-text-primary)]">
                  {name.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="tara-kicker">Mutual alignment</p>
                <h2 className="tara-type-page mt-2 text-[2.8rem] leading-[0.96]">
                  {name}
                  <span className="ml-2 text-[1.1rem] font-normal text-[color:var(--tara-text-secondary)]">{age}</span>
                </h2>
                <p className="tara-copy mt-3 max-w-[15rem] text-sm">{insightPreview(insight)}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {sunSign ? <span className="tara-chip px-3 py-1 text-xs">{sunSign} sun</span> : null}
                  {moonSign ? <span className="tara-chip px-3 py-1 text-xs">{moonSign} moon</span> : null}
                  {nakshatra ? <span className="tara-chip tara-chip-gold px-3 py-1 text-xs">{nakshatra}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="tara-screen-panel rounded-[1.75rem] p-5">
            <p className="tara-kicker">Compatibility score</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-[var(--font-serif)] text-7xl text-aurora">{compatibility}</span>
              <span className="pb-2 font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-secondary)]">%</span>
            </div>
            <p className="tara-support-surface mt-4 rounded-2xl px-4 py-4 text-sm italic text-[color:var(--tara-text-primary)]">
              &quot;{insight}&quot;
            </p>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Moon className="h-4 w-4" />} label="Kundali" value={`${kundaliScore}/36`} note="Strong guna match" />
            <Stat icon={<Sparkles className="h-4 w-4" />} label="Personality" value={`${personalityScore}%`} note="Compatible vibes" />
          </div>

          {hasKundaliAttributes ? (
            <section className="space-y-2">
              <h2 className="text-xs uppercase tracking-widest text-[color:var(--tara-text-faint)]">Kundali attributes</h2>
              {sunSign ? (
                <Attribute label="Sun sign" value={sunSign} icon={<Sun className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
              ) : null}
              {moonSign ? (
                <Attribute label="Moon sign" value={moonSign} icon={<Moon className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
              ) : null}
              {nakshatra ? (
                <Attribute label="Nakshatra" value={nakshatra} icon={<Sparkles className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-[color:var(--tara-text-faint)]">Their vibe</h2>
            <div className="flex flex-wrap gap-2">
              {traits.map((trait) => (
                <span key={trait} className="tara-chip px-4 py-2 text-xs font-medium">
                  {trait}
                </span>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link
              className="tara-secondary-btn tara-motion-pressable flex items-center justify-center px-4 py-3 text-sm font-medium"
              to="/matches"
            >
              Back to matches
            </Link>
            <Link
              className="tara-primary-btn tara-motion-pressable flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
              to={`/chat/${matchId}`}
            >
              <MessageCircle className="h-4 w-4" />
              Start chatting
            </Link>
          </div>
        </div>
      ) : null}
    </main>
  );
}
