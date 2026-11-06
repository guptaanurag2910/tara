import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, X } from "lucide-react";

import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Loader from "../components/Loader";
import { fetchDailyMatches } from "../services/matchingService";

function recommendationErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status >= 500) {
    return "Stars are syncing right now. Please try again shortly.";
  }
  if (status === 0) {
    return "Cannot reach the server. Check your internet and try again.";
  }
  return apiError?.message || "Could not load your stars today.";
}

function initials(name) {
  if (!name) {
    return "T";
  }
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "T";
}

function insightText(match) {
  if (match?.insight) {
    return match.insight;
  }
  const kundaliScore = Number(match?.kundali_score || 0);
  const personalityScore = Number(match?.personality_score || 0);
  return `Today's score blends kundali ${kundaliScore}/36 with personality ${personalityScore}%.`;
}

function MatchSpotlight({ match, onClose }) {
  if (!match) {
    return null;
  }

  return (
    <div className="stars-spotlight-overlay" onClick={onClose}>
      <div aria-label="Match details" aria-modal="true" className="stars-spotlight" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="stars-spotlight-handle" />
        <button aria-label="Close details" className="stars-spotlight-close" onClick={onClose} type="button"><X size={20} /></button>
        <div className="flex items-center gap-3">
          {match.photo ? (
            <img
              alt={match.name || "Daily match"}
              className="h-14 w-14 rounded-full border border-white/25 object-cover"
              src={match.photo}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-gradient-to-br from-cyan-400/45 to-amber-300/40 text-lg font-semibold text-white">
              {initials(match.name)}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-white">{match.name}</p>
            <p className="text-xs text-cyan-100/80">{match.age} years · Curated for today</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Compatibility</p>
            <p className="mt-1 text-base font-semibold text-white">{match.compatibility_score ?? 0}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Kundali</p>
            <p className="mt-1 text-base font-semibold text-white">{match.kundali_score ?? 0}/36</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Personality</p>
            <p className="mt-1 text-base font-semibold text-white">{match.personality_score ?? 0}%</p>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-3 text-sm text-cyan-50">
          {insightText(match)}
        </p>

        <div className="mt-4">
          <Button onClick={onClose} type="button">
            Back to Stars
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DailyMatches() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [spotlightMatch, setSpotlightMatch] = useState(null);

  async function loadDailyMatches() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchDailyMatches();
      const curated = (Array.isArray(data) ? data : []).slice(0, 5);
      setMatches(curated);
    } catch (apiError) {
      setError(recommendationErrorMessage(apiError));
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDailyMatches();
  }, []);

  const headingCount = useMemo(() => Math.min(matches.length, 5), [matches.length]);

  return (
    <main className="tara-stars-today tara-container">
      <header className="stars-page-header">
        <div className="stars-brand">tara<span>.</span></div>
        <button aria-label="Back to matches" className="stars-back" onClick={() => navigate("/matches")} type="button"><ArrowLeft size={19} /></button>
        <p className="stars-eyebrow"><Sparkles size={12} /> DAILY CURATIONS</p>
        <h1>Your Top Matches Today</h1>
        <p className="mt-1 text-sm text-slate-300">
          {headingCount > 0
            ? `${headingCount} handpicked vibes tuned to your energy today.`
            : "Fresh stars are aligning. Come back in a bit."}
        </p>
      </header>

      {loading ? <Loader text="Reading today's stars..." /> : null}
      {!loading && error ? (
        <EmptyState
          title="We couldn't load today's matches"
          subtitle={error}
          action={(
            <Button onClick={loadDailyMatches} type="button">
              Try Again
            </Button>
          )}
        />
      ) : null}

      {!loading && !error && matches.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => navigate("/discover")} type="button">
              Swipe
            </Button>
          }
          subtitle="Use Swipe to help us tune your daily stars."
          title="Check back later for new matches ✨"
        />
      ) : null}

      {!loading && !error && matches.length > 0 ? (
        <section className="stars-list">
          {matches.slice(0, 5).map((match, index) => (
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className="stars-card"
              initial={{ opacity: 0, y: 10 }}
              key={`${match.user_id}-${index}`}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <div className="flex items-start gap-3">
                {match.photo ? (
                  <img
                    alt={match.name || "Daily match"}
                    className="h-14 w-14 shrink-0 rounded-full border border-white/30 object-cover"
                    src={match.photo}
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-cyan-400/40 to-amber-300/40 text-base font-semibold text-white">
                    {initials(match.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-base font-semibold text-white">
                      {match.name}
                      <span className="ml-1 text-sm font-normal text-slate-300">{match.age ? `· ${match.age}` : ""}</span>
                    </p>
                    <span className="stars-score">
                      {match.compatibility_score ?? 0}%
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-200">{insightText(match)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="stars-view-button"
                  onClick={() => setSpotlightMatch(match)}
                  type="button"
                >
                  View Details
                </button>
                <button
                  className="stars-swipe-button"
                  onClick={() => navigate("/discover")}
                  type="button"
                >
                  Swipe
                </button>
              </div>
            </motion.article>
          ))}
        </section>
      ) : null}

      <MatchSpotlight match={spotlightMatch} onClose={() => setSpotlightMatch(null)} />
    </main>
  );
}
