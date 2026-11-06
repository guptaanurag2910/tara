import { useEffect, useRef, useState } from "react";
import { Heart, SlidersHorizontal, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { DiscoverSkeleton } from "../components/AppSkeletons";
import DiscoverSheet from "../components/DiscoverSheet";
import MatchPopup from "../components/MatchPopup";
import SwipeCard from "../components/SwipeCard";
import { useAuth } from "../hooks/useAuth";
import { fetchGameNightSchedule, fetchRecommendationFeed, prepareRecommendations, swipeLike, swipePass } from "../services/matchingService";

function recommendationErrorMessage(apiError) {
  const status = Number(apiError?.status || 0);
  if (status === 401) {
    return "Your session expired. Please log in again.";
  }
  if (status >= 500) {
    return "Match service is busy right now. Please try again in a moment.";
  }
  if (status === 0) {
    return "Cannot reach the server. Check your connection and try again.";
  }
  return apiError?.message || "Could not load recommendations right now.";
}

function NextCardPreview({ profile }) {
  if (!profile) {
    return null;
  }

  return (
    <article aria-hidden="true" className="discover-next-card pointer-events-none absolute inset-x-3 top-2 overflow-hidden">
      <div className="absolute inset-0">
        {profile.user?.photo ? (
          <img alt="" className="h-full w-full object-cover" src={profile.user.photo} />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,#f77737,#e1306c,#facddc)]" />
        )}
      </div>
    </article>
  );
}

function StatePanel({ title, description, actionLabel, onAction }) {
  return (
    <section className="discover-state-card" role="status">
      <span className="discover-state-mark">✦</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="discover-state-action" onClick={onAction} type="button">{actionLabel}</button>
    </section>
  );
}

function connectionReasons(profile) {
  const reasons = [];
  if (profile.shared_interests?.length) {
    reasons.push({
      title: "You have interests in common",
      detail: profile.shared_interests.slice(0, 3).join(", "),
      kind: "interest",
    });
  }
  if (profile.personality_highlights?.length) {
    reasons.push({
      title: "Your personality profiles are similar",
      detail: `Closest on ${profile.personality_highlights.map((item) => item.trait).join(" and ")}. Based on optional personality answers.`,
      kind: "personality",
    });
  }
  if (profile.kundali_score !== null && profile.kundali_score !== undefined) {
    reasons.push({
      title: "An optional astrology lens",
      detail: `Traditional Ashtakoota score: ${profile.kundali_score} out of 36. This is one cultural perspective, not a prediction.`,
      kind: "astrology",
    });
  }
  return reasons.slice(0, 3);
}

function conversationPrompt(profile) {
  if (profile.shared_interests?.length) {
    return `You both enjoy ${profile.shared_interests[0]}. What do you like most about it?`;
  }
  if (profile.personality_highlights?.length) {
    return `Your profiles seem similar on ${profile.personality_highlights[0].trait}. What helps you feel comfortable getting to know someone?`;
  }
  const interest = profile.interests?.find((item) => typeof item === "string" && item.trim());
  if (interest) return `I saw you enjoy ${interest}. What got you into it?`;
  return "What is something you have enjoyed learning about lately?";
}

export default function SwipeScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [swipedIds, setSwipedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [generationStatus, setGenerationStatus] = useState("unknown");
  const [readyCount, setReadyCount] = useState(0);
  const [feedPollTick, setFeedPollTick] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [matchPopup, setMatchPopup] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);
  const [gameNightSchedule, setGameNightSchedule] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [filters, setFilters] = useState({ gender: "everyone", minAge: 18, maxAge: 70 });
  const cardRef = useRef(null);

  const remainingProfiles = profiles.filter((profile) => !swipedIds.has(profile.user_id));
  const filteredProfiles = remainingProfiles.filter((profile) => {
    const rawAge = profile.age ?? profile.user?.age;
    const age = rawAge == null ? NaN : Number(rawAge);
    const matchesAge = !Number.isFinite(age) || (age >= filters.minAge && age <= filters.maxAge);
    const matchesGender = filters.gender === "everyone" || profile.user?.gender === filters.gender;
    return matchesAge && matchesGender;
  });
  const currentProfile = filteredProfiles[0] ?? null;
  const nextProfile = filteredProfiles[1] ?? null;
  const noteInterest = currentProfile?.interests?.find((item) => typeof item === "string" && item.trim());
  const whyReasons = currentProfile ? connectionReasons(currentProfile) : [];
  const whyPrompt = currentProfile ? conversationPrompt(currentProfile) : "";
  const isDone = !loading && currentProfile === null;
  const hasActiveFilters = filters.gender !== "everyone" || filters.minAge !== 18 || filters.maxAge !== 70;

  async function loadProfiles({ append = false } = {}) {
    if (!append) setLoading(true);
    setError("");
    try {
      const feed = await fetchRecommendationFeed();
      setGenerationStatus(feed.generationStatus);
      setReadyCount(feed.readyCount);
      if (append) {
        setProfiles((current) => {
          const known = new Set(current.map((profile) => profile.user_id));
          return [...current, ...feed.results.filter((profile) => !known.has(profile.user_id))];
        });
      } else {
        setProfiles(feed.results);
        setSwipedIds(new Set());
      }
    } catch (apiError) {
      setError(recommendationErrorMessage(apiError));
      if (!append) {
        setProfiles([]);
        setSwipedIds(new Set());
      }
    } finally {
      if (!append) setLoading(false);
      else setFeedPollTick((tick) => tick + 1);
    }
  }

  useEffect(() => {
    loadProfiles();
    fetchGameNightSchedule().then(setGameNightSchedule).catch(() => {});
  }, []);

  const nextGameNight = gameNightSchedule?.starts_at
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", timeZone: gameNightSchedule.timezone || undefined }).format(new Date(gameNightSchedule.starts_at))
    : "Soon";

  useEffect(() => {
    const generating = ["pending", "running"].includes(generationStatus);
    const needsRefill = filteredProfiles.length <= 5 && remainingProfiles.length < 100 && readyCount > remainingProfiles.length;
    if (loading || error || (!generating && !needsRefill)) {
      return undefined;
    }
    const timer = window.setTimeout(() => loadProfiles({ append: true }), 2500);
    return () => window.clearTimeout(timer);
  }, [loading, error, generationStatus, filteredProfiles.length, remainingProfiles.length, readyCount, swipedIds, feedPollTick]);

  async function commitSwipe(direction, { note = "" } = {}) {
    if (!currentProfile || submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let swipeResult;
      if (direction === "right") {
        swipeResult = await swipeLike(currentProfile.user_id, note);
      } else {
        swipeResult = await swipePass(currentProfile.user_id);
      }

      if (swipeResult?.is_match) {
        setMatchPopup({
          matchedUser: {
            name: currentProfile.user?.name || "New match",
            photo: currentProfile.user?.photo || null,
          },
          breakdown: {
            matchId: swipeResult?.match_id || null,
            compatibility: currentProfile.compatibility_score,
            kundali: currentProfile.kundali_score,
            personality: currentProfile.personality_score,
            insight: currentProfile.insight,
          },
        });
      }

      setSwipedIds((ids) => new Set(ids).add(currentProfile.user_id));
      return true;
    } catch (apiError) {
      setError(apiError?.message || "Unable to save your swipe.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function retryRecommendations() {
    try {
      await prepareRecommendations();
      await loadProfiles({ append: true });
    } catch (apiError) {
      setError(recommendationErrorMessage(apiError));
    }
  }

  async function sendLikeWithNote() {
    if (!noteDraft.trim()) return;
    const saved = await commitSwipe("right", { note: noteDraft.trim() });
    if (saved) {
      setNoteDraft("");
      setActiveSheet(null);
    }
  }

  async function swipeFromWhy(direction) {
    const saved = await commitSwipe(direction);
    if (saved) setActiveSheet(null);
  }

  return (
    <main className="tara-discover tara-container">
      <header className="discover-header">
        <div className="flex items-center justify-between gap-3"><div className="discover-brand">tara<span>.</span></div><Link className="rounded-full border border-[#f4d6e0] bg-[#fff2f6] px-3 py-1.5 text-[11px] font-bold text-[#b73363]" to="/game-night">✦ Game Night · {gameNightSchedule?.is_open ? "Live now" : nextGameNight}</Link></div>
        <div className="discover-heading-row">
          <div>
            <p className="discover-eyebrow">YOUR SPACE TO CONNECT</p>
            <h1>Discover</h1>
            <p className="discover-subtitle">A little closer to your kind of person.</p>
          </div>
        <button
          aria-expanded={activeSheet === "filters"}
          className={`discover-filter-trigger ${hasActiveFilters ? "is-active" : ""}`}
          onClick={() => setActiveSheet((sheet) => sheet === "filters" ? null : "filters")}
          type="button"
          aria-label="Filters"
        >
          <SlidersHorizontal size={18} strokeWidth={2} />
        </button>
        </div>
      </header>

      {loading ? (
        <div className="discover-stage"><DiscoverSkeleton /></div>
      ) : (
        <div className="discover-stage">
          {!error ? <NextCardPreview profile={nextProfile} /> : null}
          {error ? (
            <StatePanel title="We couldn't load your matches" description={error} actionLabel="Try again" onAction={loadProfiles} />
          ) : currentProfile ? (
            <SwipeCard key={currentProfile.user_id} ref={cardRef} disabled={submitting} onSwiped={commitSwipe} onWhy={() => setActiveSheet("why")} onNote={() => { setNoteDraft(""); setActiveSheet("note"); }} profile={currentProfile} />
          ) : generationStatus === "pending" || generationStatus === "running" ? (
            <StatePanel title="Preparing your recommendations" description="We’re scoring eligible profiles in the background. New profiles will appear as they’re ready." actionLabel="Check again" onAction={() => loadProfiles({ append: true })} />
          ) : generationStatus === "failed" ? (
            <StatePanel title="We couldn't prepare your recommendations" description="Please try again. If this keeps happening, contact support." actionLabel="Try again" onAction={retryRecommendations} />
          ) : (
            <StatePanel
              title={hasActiveFilters && remainingProfiles.length ? "No profiles match your filters" : "You're all caught up"}
              description={hasActiveFilters && remainingProfiles.length ? "Try a wider age range or choose everyone to see more people." : "You've seen everyone for now. Come back soon for new connections."}
              actionLabel={hasActiveFilters && remainingProfiles.length ? "Reset filters" : "Refresh feed"}
              onAction={hasActiveFilters && remainingProfiles.length ? () => setFilters({ gender: "everyone", minAge: 18, maxAge: 70 }) : loadProfiles}
            />
          )}
        </div>
      )}

      <div className="discover-actions">
        <button
          aria-label="Pass"
          className="discover-action discover-action-pass"
          disabled={loading || submitting || isDone || Boolean(error)}
          onClick={() => cardRef.current?.swipeLeft()}
          type="button"
        >
          <X size={23} strokeWidth={2.3} /> <span>Pass</span>
        </button>
        <button
          aria-label="Like"
          className="discover-action discover-action-like"
          disabled={loading || submitting || isDone || Boolean(error)}
          onClick={() => cardRef.current?.swipeRight()}
          type="button"
        >
          <Heart size={21} strokeWidth={2.2} /> <span>Like</span>
        </button>
      </div>

      {activeSheet === "filters" ? (
        <DiscoverSheet closeLabel="Close filters" label="Discovery filters" onClose={() => setActiveSheet(null)} title="Your preferences">
          <p className="discover-sheet-intro">Keep the people you want to meet in view.</p>
          <div className="discover-filter-fields">
            <label>Show me
              <select value={filters.gender} onChange={(event) => setFilters((value) => ({ ...value, gender: event.target.value }))}>
                <option value="everyone">Everyone</option><option value="female">Women</option><option value="male">Men</option>
              </select>
            </label>
            <div className="discover-filter-age">
              <label>Age from<input aria-label="Minimum age" min="18" max={filters.maxAge} type="number" value={filters.minAge} onChange={(event) => setFilters((value) => ({ ...value, minAge: Math.max(18, Math.min(Number(event.target.value) || 18, value.maxAge)) }))} /></label>
              <label>Age to<input aria-label="Maximum age" min={filters.minAge} max="70" type="number" value={filters.maxAge} onChange={(event) => setFilters((value) => ({ ...value, maxAge: Math.min(70, Math.max(Number(event.target.value) || 70, value.minAge)) }))} /></label>
            </div>
          </div>
          <div className="discover-sheet-footer">
            {hasActiveFilters ? <button className="discover-filter-reset" onClick={() => setFilters({ gender: "everyone", minAge: 18, maxAge: 70 })} type="button">Reset filters</button> : <span />}
            <button className="discover-sheet-primary" onClick={() => setActiveSheet(null)} type="button">Show profiles</button>
          </div>
        </DiscoverSheet>
      ) : null}

      {activeSheet === "why" && currentProfile ? (
        <DiscoverSheet label="Why we fit" onClose={() => setActiveSheet(null)} title="Why you might connect">
          <p className="discover-sheet-intro">A few things you can explore with {currentProfile.user.name}. These are conversation starters, not promises about a relationship.</p>
          <div className="discover-why-scores">
            {currentProfile.compatibility_score !== null ? <div><strong>{currentProfile.compatibility_score}%</strong><span>overall match</span></div> : null}
            {currentProfile.kundali_score !== null ? <div><strong>{currentProfile.kundali_score}/36</strong><span>Kundali</span></div> : null}
            {currentProfile.personality_score !== null ? <div><strong>{currentProfile.personality_score}%</strong><span>personality</span></div> : null}
          </div>
          {currentProfile.compatibility_score !== null ? <p className="discover-score-explainer">The overall score uses 80% traditional astrology and 20% personality similarity; missing personality data may count as zero. Treat it as one guide, not a prediction.</p> : null}
          <section aria-label="Reasons you may connect" className="discover-connection-reasons">
            {whyReasons.map((reason, index) => <article className={`discover-connection-reason is-${reason.kind}`} key={reason.kind}>
              <span aria-hidden="true" className="discover-connection-number">{index + 1}</span>
              <div><h3>{reason.title}</h3><p>{reason.detail}</p></div>
            </article>)}
            {!whyReasons.length ? <p className="discover-why-insight">There is not enough shared profile information to explain this recommendation yet. You can still explore their profile and decide for yourself.</p> : null}
          </section>
          {currentProfile.bio ? <section className="discover-why-section"><h3>In their own words</h3><p>{currentProfile.bio}</p></section> : null}
          {currentProfile.interests?.length ? <section className="discover-why-section"><h3>{currentProfile.shared_interests?.length ? "Interests you share" : "Things they enjoy"}</h3><div className="discover-interest-list">{(currentProfile.shared_interests?.length ? currentProfile.shared_interests : currentProfile.interests).filter((item) => typeof item === "string" && item.trim()).map((item) => <span key={item}>{item}</span>)}</div></section> : null}
          <section className="discover-conversation-prompt"><p>Try asking</p><blockquote>{whyPrompt}</blockquote><button onClick={() => { setNoteDraft(whyPrompt); setActiveSheet("note"); }} type="button">Use this in a note</button></section>
          <p className="discover-why-disclaimer">Scores come from available profile details. Astrology and personality are optional lenses; your own judgment matters most.</p>
          {error ? <p className="discover-note-error" role="alert">{error}</p> : null}
          <div className="discover-why-actions"><button disabled={submitting} onClick={() => swipeFromWhy("left")} type="button">Pass</button><button disabled={submitting} onClick={() => swipeFromWhy("right")} type="button"><Heart size={16} /> Like</button></div>
        </DiscoverSheet>
      ) : null}

      {activeSheet === "note" && currentProfile ? (
        <DiscoverSheet label="Like with note" onClose={() => setActiveSheet(null)} title={`Say hello to ${currentProfile.user.name}`}>
          <p className="discover-sheet-intro">Your note will appear in your chat only if you both like each other.</p>
          <div className="discover-note-suggestions">
            {[noteInterest ? `What drew you to ${noteInterest}?` : "What are you looking forward to?", "What makes a great first conversation for you?"].map((suggestion) => <button key={suggestion} onClick={() => setNoteDraft(suggestion)} type="button">{suggestion}</button>)}
          </div>
          <label className="discover-note-label" htmlFor="discover-note">Your note</label>
          <textarea id="discover-note" maxLength={280} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write something personal..." value={noteDraft} />
          <p className="discover-note-count">{noteDraft.length}/280</p>
          {error ? <p className="discover-note-error" role="alert">{error}</p> : null}
          <button className="discover-sheet-primary discover-sheet-wide" disabled={!noteDraft.trim() || submitting} onClick={sendLikeWithNote} type="button">{submitting ? "Sending..." : "Send like with note"}</button>
        </DiscoverSheet>
      ) : null}

      <MatchPopup
        breakdown={matchPopup?.breakdown}
        matchedUser={matchPopup?.matchedUser}
        onClose={() => setMatchPopup(null)}
        open={Boolean(matchPopup)}
        selfUser={{
          ...user,
          photo: user?.photo || user?.photos?.[0]?.image_url || user?.photos?.[0]?.src || null,
        }}
      />
    </main>
  );
}
