import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Star } from "lucide-react";

import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import { DiscoverSkeleton } from "../components/AppSkeletons";
import MatchPopup from "../components/MatchPopup";
import SwipeCard from "../components/SwipeCard";
import Logo from "../components/tara/Logo";
import { useAuth } from "../hooks/useAuth";
import { fetchRecommendations, swipeLike, swipePass } from "../services/matchingService";

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
    <article className="pointer-events-none absolute inset-x-3 top-3 h-[68vh] max-h-[640px] rounded-[2rem] border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg)_82%,transparent)] opacity-70 blur-[0.2px]">
      <div className="absolute inset-0 overflow-hidden rounded-[1.7rem]">
        {profile.user?.photo ? (
          <img alt={profile.user.name} className="h-full w-full object-cover opacity-80" src={profile.user.photo} />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_80%_10%,color-mix(in_srgb,var(--tara-color-info)_72%,transparent)_0%,color-mix(in_srgb,var(--tara-color-destructive)_62%,transparent)_45%,color-mix(in_srgb,var(--tara-violet)_58%,transparent)_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--tara-bg-surface)]/95 to-transparent" />
      </div>
    </article>
  );
}

export default function SwipeScreen() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [matchPopup, setMatchPopup] = useState(null);
  const cardRef = useRef(null);

  const currentProfile = profiles[currentIndex] ?? null;
  const nextProfile = profiles[currentIndex + 1] ?? null;
  const isDone = !loading && currentProfile === null;

  async function loadProfiles() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRecommendations();
      setProfiles(Array.isArray(data) ? data : []);
      setCurrentIndex(0);
    } catch (apiError) {
      setError(recommendationErrorMessage(apiError));
      setProfiles([]);
      setCurrentIndex(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  async function commitSwipe(direction) {
    if (!currentProfile || submitting) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      let swipeResult;
      if (direction === "right") {
        swipeResult = await swipeLike(currentProfile.user_id);
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
            compatibility: currentProfile.compatibility_score ?? 0,
            kundali: currentProfile.kundali_score ?? 0,
            personality: currentProfile.personality_score ?? 0,
            insight: currentProfile.insight || "You both value emotional depth.",
          },
        });
      }

      setCurrentIndex((value) => value + 1);
    } catch (apiError) {
      setError(apiError?.message || "Unable to save your swipe.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="tara-page-shell tara-scene-shell flex min-h-[calc(100dvh-132px)] flex-col px-5 pt-6">
      <header className="tara-screen-intro mb-5 flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <div>
            <p className="tara-kicker">Discovery</p>
            <h1 className="tara-type-section mt-1 text-[2rem] leading-none">Find your next spark</h1>
            <p className="tara-type-helper mt-1">Atmosphere around the card, clarity inside it.</p>
          </div>
        </div>
        <button
          className="tara-icon-button inline-flex h-10 w-10 items-center justify-center"
          type="button"
          aria-label="Filters"
        >
          <SlidersHorizontal className="h-4 w-4 text-[color:var(--tara-text-primary)]" />
        </button>
      </header>

      {loading ? (
        <DiscoverSkeleton />
      ) : (
        <div className="relative flex-1">
          {!error ? (
            <>
              <div className="pointer-events-none absolute inset-x-6 top-10 h-40 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--tara-violet)_28%,transparent)_0%,transparent_72%)] blur-3xl" />
              <div className="pointer-events-none absolute inset-x-2 top-2 h-[70vh] max-h-[650px] rounded-[2.5rem] border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg-strong)_66%,transparent)] opacity-60" />
            </>
          ) : null}
          {!error ? <NextCardPreview profile={nextProfile} /> : null}
          {error ? (
            <div className="flex h-[67vh] max-h-[590px] items-center justify-center">
              <div className="w-full max-w-sm">
                <EmptyState
                  subtitle={error}
                  title="We couldn't load your matches"
                  action={(
                    <Button fullWidth onClick={loadProfiles} type="button">
                      Try Again
                    </Button>
                  )}
                />
              </div>
            </div>
          ) : currentProfile ? (
            <SwipeCard key={currentProfile.user_id} ref={cardRef} disabled={submitting} onSwiped={commitSwipe} profile={currentProfile} />
          ) : (
            <div className="flex h-[67vh] max-h-[590px] items-center justify-center">
              <div className="w-full max-w-sm">
                <EmptyState
                  kind="discovery"
                  eyebrow="Discovery pause"
                  icon="✦"
                  title="No more souls nearby right now"
                  subtitle="You've seen everyone in your current pool. Refresh the feed now, or check back a little later for fresh recommendations."
                  action={(
                    <Button fullWidth onClick={loadProfiles} type="button">
                      Refresh feed
                    </Button>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-center gap-4 pb-2">
        <button
          className="tara-icon-button inline-flex h-14 w-14 items-center justify-center text-[2rem] text-[color:var(--tara-text-secondary)] disabled:opacity-50"
          disabled={loading || submitting || isDone || Boolean(error)}
          onClick={() => cardRef.current?.swipeLeft()}
          type="button"
        >
          ✕
        </button>
        <button
          className="tara-chip tara-chip-gold inline-flex h-12 w-12 items-center justify-center p-0 text-[1.05rem] shadow-[0_0_20px_rgba(230,179,76,0.25)] disabled:opacity-50"
          disabled={loading || submitting || isDone || Boolean(error)}
          type="button"
        >
          <Star className="h-5 w-5" />
        </button>
        <button
          className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_28%_18%,#a8b7ff,#7f87ff_52%,#d7c48a)] text-[2.2rem] text-white shadow-[0_0_36px_rgba(131,132,255,0.62)] disabled:opacity-50"
          disabled={loading || submitting || isDone || Boolean(error)}
          onClick={() => cardRef.current?.swipeRight()}
          type="button"
        >
          ♡
        </button>
      </div>

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
