import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

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

function scoreColor(score) {
  const value = Number(score || 0);
  if (value >= 80) {
    return "tara-chip-gold";
  }
  if (value >= 65) {
    return "";
  }
  return "";
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
    <div className="tara-overlay-surface fixed inset-0 z-50 flex items-end">
      <div className="tara-modal-surface tara-motion-modal-enter w-full rounded-t-[1.8rem] p-5">
        <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[color:var(--tara-card-border)]" />
        <div className="flex items-center gap-3">
          {match.photo ? (
            <img
              alt={match.name || "Daily match"}
              className="h-14 w-14 rounded-full border border-[color:var(--tara-card-border)] object-cover"
              src={match.photo}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--tara-color-info)_36%,transparent)_0%,color-mix(in_srgb,var(--tara-gold)_28%,transparent)_52%,transparent_100%)] text-lg font-semibold text-[color:var(--tara-text-primary)]">
              {initials(match.name)}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-[color:var(--tara-text-primary)]">{match.name}</p>
            <p className="text-xs text-[color:var(--tara-text-secondary)]">{match.age} years · Curated for today</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="tara-card rounded-xl px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[color:var(--tara-text-faint)]">Compatibility</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--tara-text-primary)]">{match.compatibility_score ?? 0}%</p>
          </div>
          <div className="tara-card rounded-xl px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[color:var(--tara-text-faint)]">Kundali</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--tara-text-primary)]">{match.kundali_score ?? 0}/36</p>
          </div>
          <div className="tara-card rounded-xl px-2 py-3">
            <p className="text-[10px] uppercase tracking-wide text-[color:var(--tara-text-faint)]">Personality</p>
            <p className="mt-1 text-base font-semibold text-[color:var(--tara-text-primary)]">{match.personality_score ?? 0}%</p>
          </div>
        </div>

        <p className="tara-support-surface mt-4 rounded-xl px-3 py-3 text-sm text-[color:var(--tara-text-primary)]">
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
    <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
      <header className="tara-screen-intro tara-scene-motif px-5 py-5" data-scene="day">
        <p className="tara-kicker">Daily curations</p>
        <h1 className="tara-type-page mt-2 leading-none">Your Top Matches Today</h1>
        <p className="tara-copy mt-2 max-w-sm">
          {headingCount > 0
            ? `${headingCount} handpicked vibes tuned to your energy today.`
            : "Fresh stars are aligning. Come back in a bit."}
        </p>
      </header>

      {loading ? (
        <div className="tara-screen-panel p-5">
          <Loader text="Reading today's stars..." />
        </div>
      ) : null}
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
        <section className="space-y-3">
          {matches.slice(0, 5).map((match, index) => (
            <motion.article
              animate={{ opacity: 1, y: 0 }}
              className="tara-screen-panel p-4"
              initial={{ opacity: 0, y: 10 }}
              key={`${match.user_id}-${index}`}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <div className="flex items-start gap-3">
                {match.photo ? (
                  <img
                    alt={match.name || "Daily match"}
                    className="h-14 w-14 shrink-0 rounded-full border border-[color:var(--tara-card-border)] object-cover"
                    src={match.photo}
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--tara-card-border)] bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--tara-color-info)_36%,transparent)_0%,color-mix(in_srgb,var(--tara-gold)_28%,transparent)_52%,transparent_100%)] text-base font-semibold text-[color:var(--tara-text-primary)]">
                    {initials(match.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-base font-semibold text-[color:var(--tara-text-primary)]">
                      {match.name}
                      <span className="ml-1 text-sm font-normal text-[color:var(--tara-text-secondary)]">{match.age ? `· ${match.age}` : ""}</span>
                    </p>
                    <span className={`tara-chip px-2.5 py-1 text-xs font-semibold ${scoreColor(match.compatibility_score)}`}>
                      {match.compatibility_score ?? 0}%
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[color:var(--tara-text-secondary)]">{insightText(match)}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="tara-secondary-btn tara-motion-pressable inline-flex items-center justify-center px-3 py-2 text-sm font-medium"
                  onClick={() => setSpotlightMatch(match)}
                  type="button"
                >
                  View Details
                </button>
                <button
                  className="tara-primary-btn tara-motion-pressable inline-flex items-center justify-center px-3 py-2 text-sm font-semibold"
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
