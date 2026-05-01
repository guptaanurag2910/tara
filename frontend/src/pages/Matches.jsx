import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Sparkles } from "lucide-react";

import { MatchesSkeleton } from "../components/AppSkeletons";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { fetchMatches } from "../services/matchingService";

function firstName(name) {
  return String(name || "Match").trim().split(/\s+/)[0] || "Match";
}

function normalizeInsight(text) {
  const sentence = String(text || "").split(/[.!?]/)[0]?.trim();
  if (!sentence) {
    return "Your moons align in a beautiful way.";
  }
  return sentence.length > 54 ? `${sentence.slice(0, 51)}...` : sentence;
}

function MatchAvatar({ name, photo, large = false }) {
  const size = large ? "h-20 w-20" : "h-16 w-16";
  return (
    <div className={`relative ${size} shrink-0`}>
      <div className="absolute inset-0 rounded-full bg-[color:var(--tara-violet)] opacity-40 blur-md" />
      <div className={`relative ${size} overflow-hidden rounded-full ring-2 ring-[color:var(--tara-gold)]/60 ring-offset-2 ring-offset-[#090338]`}>
        {photo ? (
          <img src={photo} alt={name || "Match"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/80 via-indigo-600/70 to-amber-300/70 text-base font-semibold text-white">
            {firstName(name).slice(0, 1)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMatches() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMatches();
        setMatches(Array.isArray(data) ? data : []);
      } catch (apiError) {
        setError(apiError?.message || "Could not load matches.");
      } finally {
        setLoading(false);
      }
    }
    loadMatches();
  }, []);

  const featured = useMemo(() => matches.slice(0, 4), [matches]);

  return (
    <main className="tara-container px-5 pb-28 pt-8">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Your constellations</p>
        <h1 className="tara-heading mt-2 text-6xl leading-none">Matches</h1>
        <p className="mt-1 text-[15px] text-[color:var(--tara-text-secondary)]">
          {loading ? "Reading your alignments..." : `${matches.length} souls aligned with yours.`}
        </p>
      </header>

      {loading ? <MatchesSkeleton /> : null}
      {error ? <p className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

      {!loading && !error && matches.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No matches yet"
            subtitle="When two people like each other, the connection lands here. Keep exploring and your first conversation will be one tap away."
            action={(
              <Link to="/discover">
                <Button type="button">Go to Discover</Button>
              </Link>
            )}
          />
        </div>
      ) : null}

      {!loading && !error && matches.length > 0 ? (
        <>
          <section className="mt-6">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[color:var(--tara-text-faint)]">New</h2>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {featured.map((match) => (
                <Link key={`new-${match.match_id}`} to={`/matches/${match.match_id}`} className="flex w-20 shrink-0 flex-col items-center gap-2">
                  <MatchAvatar large name={match?.user?.name} photo={match?.user?.photo} />
                  <p className="w-full truncate text-center text-xs font-medium text-[color:var(--tara-text-primary)]">{firstName(match?.user?.name)}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-[color:var(--tara-text-faint)]">All matches</h2>
            <div className="space-y-3">
              {matches.map((match) => (
                <Link
                  key={match.match_id}
                  to={`/matches/${match.match_id}`}
                  className="group flex items-center gap-4 rounded-3xl glass p-3 transition-all active:scale-[0.99]"
                >
                  <div className="relative h-16 w-16 shrink-0">
                    <div className="absolute inset-0 rounded-2xl bg-[color:var(--tara-violet)] opacity-30 blur-md" />
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-[color:var(--tara-card-border)]">
                      {match?.user?.photo ? (
                        <img src={match.user.photo} alt={match?.user?.name || "Match"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/80 via-indigo-600/70 to-amber-300/70 text-white">
                          {firstName(match?.user?.name).slice(0, 1)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="tara-heading text-3xl leading-none text-[color:var(--tara-text-primary)]">
                        {match?.user?.name || "Match"}
                        {match?.user?.age ? `, ${match.user.age}` : ""}
                      </h3>
                      <span className="text-sm font-semibold text-gold-gradient">{match?.compatibility_score ?? 0}%</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 truncate text-sm italic text-[color:var(--tara-text-secondary)]">
                      <Sparkles className="h-3 w-3 shrink-0 text-[color:var(--tara-gold)]" />
                      {normalizeInsight(match?.insight)}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--tara-text-faint)]" />
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
