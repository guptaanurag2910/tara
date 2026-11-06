import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, Sparkles } from "lucide-react";

import { MatchesSkeleton } from "../components/AppSkeletons";
import { fetchMatches } from "../services/matchingService";

function firstName(name) {
  return String(name || "Match").trim().split(/\s+/)[0] || "Match";
}

function normalizeInsight(text) {
  const sentence = String(text || "").split(/[.!?]/)[0]?.trim();
  if (!sentence) return "A new connection worth getting to know.";
  return sentence.length > 64 ? `${sentence.slice(0, 61)}...` : sentence;
}

function matchesErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 401) return "Your session expired. Please log in again.";
  if (status >= 500) return "Your matches are temporarily unavailable. Please try again shortly.";
  if (status === 0) return "Cannot reach the server. Check your connection and try again.";
  return apiError?.message || "Could not load your matches.";
}

function MatchAvatar({ name, photo, square = false }) {
  return (
    <span className={`matches-avatar ${square ? "matches-avatar-square" : ""}`}>
      {photo ? <img src={photo} alt="" /> : <span>{firstName(name).slice(0, 1)}</span>}
    </span>
  );
}

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMatches() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchMatches();
      setMatches(Array.isArray(data) ? data : []);
    } catch (apiError) {
      setError(matchesErrorMessage(apiError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatches();
  }, []);

  return (
    <main className="tara-matches tara-container">
      <header className="matches-header">
        <div className="matches-brand">tara<span>.</span></div>
        <p className="matches-eyebrow">YOUR CONNECTIONS</p>
        <h1>Matches</h1>
        <p className="matches-subtitle">
          {loading ? "Finding your connections..." : error ? "Your connections are temporarily unavailable." : matches.length === 1 ? "1 person liked you back." : `${matches.length} people liked you back.`}
        </p>
      </header>

      <Link className="matches-daily-link" to="/stars-today">
        <span className="matches-daily-icon"><Sparkles size={20} /></span>
        <span className="matches-daily-copy"><strong>Stars Today</strong><small>Fresh picks for you</small></span>
        <ArrowRight aria-hidden="true" size={18} />
      </Link>

      {loading ? <MatchesSkeleton /> : null}

      {!loading && error ? (
        <section className="matches-state" role="alert">
          <span className="matches-state-icon"><Heart size={25} /></span>
          <h2>Couldn't load your matches</h2>
          <p>{error}</p>
          <button onClick={loadMatches} type="button">Try again</button>
        </section>
      ) : null}

      {!loading && !error && matches.length === 0 ? (
        <section className="matches-state">
          <span className="matches-state-icon"><Heart size={25} /></span>
          <h2>No matches yet</h2>
          <p>When you both like each other, you'll see them here. Your next connection could be one swipe away.</p>
          <Link to="/discover">Explore Discover <ArrowRight size={17} /></Link>
        </section>
      ) : null}

      {!loading && !error && matches.length > 0 ? (
        <>
          <section className="matches-featured" aria-label="Your connections">
            <div className="matches-section-heading"><h2>Your connections</h2><span>{matches.length}</span></div>
            <div className="matches-featured-row">
              {matches.slice(0, 4).map((match) => (
                <Link key={`featured-${match.match_id}`} to={`/matches/${match.match_id}`} className="matches-featured-item">
                  <MatchAvatar name={match?.user?.name} photo={match?.user?.photo} />
                  <span>{firstName(match?.user?.name)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="matches-list-section" aria-label="All matches">
            <div className="matches-section-heading"><h2>All matches</h2></div>
            <div className="matches-list">
              {matches.map((match) => (
                <Link key={match.match_id} to={`/matches/${match.match_id}`} className="matches-list-card">
                  <MatchAvatar square name={match?.user?.name} photo={match?.user?.photo} />
                  <span className="matches-list-copy">
                    <span className="matches-list-name">{match?.user?.name || "Match"}{match?.user?.age ? <span>, {match.user.age}</span> : null}</span>
                    <span className="matches-list-insight"><Sparkles size={13} /><span>{normalizeInsight(match?.insight)}</span></span>
                  </span>
                  <span className="matches-list-score">{match?.compatibility_score ?? 0}%</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
