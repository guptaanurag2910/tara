import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Moon, Sparkles, Sun } from "lucide-react";

import Loader from "../components/Loader";
import { fetchMatchDetail, setMatchConnection } from "../services/matchingService";

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

function Stat({ icon, label: statLabel, value, note }) {
  return (
    <div className="match-detail-stat">
      <div>{icon}<span>{statLabel}</span></div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function Attribute({ label: attributeLabel, value, icon }) {
  return (
    <div className="match-detail-attribute">
      <span>{icon}{attributeLabel}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionBusy, setConnectionBusy] = useState(false);

  const loadDetail = useCallback(async () => {
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
  }, [matchId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const name = detail?.user?.name || "Match";
  const age = detail?.user?.age ? `, ${detail.user.age}` : "";
  const compatibility = Number(detail?.compatibility_score ?? 0);
  const kundaliScore = Number(detail?.kundali_score ?? 0);
  const personalityScore = Number(detail?.personality_score ?? 0);
  const insight = detail?.insight || "Your stars suggest an emotionally aligned connection.";
  const hasDetail = Boolean(detail) && !error;

  async function resumeConnection() {
    setConnectionBusy(true);
    setError("");
    try {
      await setMatchConnection(matchId, "resume");
      await loadDetail();
    } catch (apiError) {
      setError(matchErrorMessage(apiError));
    } finally { setConnectionBusy(false); }
  }

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

  const hasKundaliAttributes = Boolean(sunSign || moonSign || nakshatra);
  const breakdownEntries = Object.entries(detail?.breakdown || {});
  const returnTo = location.state?.from === "chat" ? `/chat/${matchId}` : "/matches";
  const returnLabel = location.state?.from === "chat" ? "Back to chat" : "Back to matches";

  return (
    <main className="tara-match-detail tara-container">
      <div className="match-detail-hero">
        {detail?.user?.photo ? (
          <img src={detail.user.photo} alt={name} />
        ) : (
          <div className="match-detail-placeholder">{name.charAt(0).toUpperCase()}</div>
        )}
        <div className="match-detail-hero-shade" />
        <button
          onClick={() => navigate(returnTo)}
          className="match-detail-back"
          type="button"
          aria-label={returnLabel}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="match-detail-hero-copy">
          <h1>
            {hasDetail ? name : "Match unavailable"}
            {hasDetail ? <span>{age}</span> : null}
          </h1>
          {hasDetail && (sunSign || moonSign) ? (
            <div className="match-detail-signs">
              {sunSign ? <span>{sunSign} sun</span> : null}
              {moonSign ? <span>{moonSign} moon</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="match-detail-content">
        {loading ? <Loader text="Loading compatibility..." /> : null}
        {!loading && error ? (
          <div className="match-detail-error" role="alert">
            <p>{error}</p>
            <button onClick={loadDetail} type="button">Try again</button>
          </div>
        ) : null}

        {!loading && !error && hasDetail ? (
          <>
            <div className="match-detail-score-card">
              <p>YOUR CONNECTION</p>
              <div><strong>{compatibility}</strong><span>% match</span></div>
              <p className="match-detail-insight">{insight}</p>
            </div>

            <div className="match-detail-stats">
              <Stat icon={<Moon size={17} />} label="Kundali" value={`${kundaliScore}/36`} note="Guna score" />
              <Stat icon={<Sparkles size={17} />} label="Personality" value={`${personalityScore}%`} note="Vibe score" />
            </div>

            {hasKundaliAttributes ? (
              <section className="match-detail-section">
                <h2>Astrology details</h2>
                <div className="match-detail-attributes">
                  {sunSign ? <Attribute label="Sun sign" value={sunSign} icon={<Sun size={17} />} /> : null}
                  {moonSign ? <Attribute label="Moon sign" value={moonSign} icon={<Moon size={17} />} /> : null}
                  {nakshatra ? <Attribute label="Nakshatra" value={nakshatra} icon={<Sparkles size={17} />} /> : null}
                </div>
              </section>
            ) : null}

            {breakdownEntries.length ? (
              <section className="match-detail-section">
                <h2>Ashtakoota breakdown</h2>
                <div className="match-detail-attributes">
                  {breakdownEntries.map(([key, value]) => {
                    const score = Number(value);
                    const shownScore = Number.isFinite(score) ? (Number.isInteger(score) ? score : score.toFixed(1)) : String(value);
                    return (
                      <div className="match-detail-attribute" key={key}>
                        <span>{label(key)}</span>
                        <strong>{shownScore}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="match-detail-section">
                <h2>Ashtakoota breakdown</h2>
                <p className="match-detail-breakdown-empty">Detailed Kundali scores aren’t available for this match yet.</p>
              </section>
            )}

            <div className="match-detail-action">
              {detail.is_visible === false ? <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center"><p className="font-semibold text-amber-900">This connection is paused</p><p className="mt-1 text-sm text-amber-800">Chat and game invites are paused for both of you.</p><button className="mt-3 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={connectionBusy} onClick={resumeConnection} type="button">{connectionBusy ? "Resuming…" : "Resume connection"}</button></div> : <Link
                to={`/chat/${matchId}`}
                className="match-detail-chat"
              >
                <MessageCircle size={18} />
                Start chatting
              </Link>}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
