import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../components/Button";
import Card from "../components/Card";
import Loader from "../components/Loader";
import { fetchProfileSummary } from "../services/onboardingService";

const TRAIT_TEXT_MAP = {
  overthinking: {
    emoji: "✨",
    title: "Thoughtful",
    note: "You pay attention to emotional nuance and rarely miss mixed signals.",
  },
  emotional_depth: {
    emoji: "🌙",
    title: "Emotionally deep",
    note: "You connect best through sincerity, softness, and meaningful conversations.",
  },
  communication: {
    emoji: "💬",
    title: "Communicative",
    note: "Clarity matters to you, and you feel safest when people say what they mean.",
  },
  stability: {
    emoji: "🪐",
    title: "Grounded",
    note: "You bring steadiness into relationships and usually prefer calm over chaos.",
  },
  chaos: {
    emoji: "🔥",
    title: "Spontaneous",
    note: "You like energy, movement, and chemistry that feels alive in the moment.",
  },
  openness: {
    emoji: "🌠",
    title: "Open-minded",
    note: "You tend to meet people with curiosity and give new experiences a fair chance.",
  },
};

function toReadableLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapTraitsToVibes(traits) {
  const entries = Object.entries(traits || {})
    .map(([key, value]) => [key, Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (entries.length === 0) {
    return [];
  }

  return entries.map(([key, score]) => {
    const mapped = TRAIT_TEXT_MAP[key];
    if (mapped) {
      return {
        id: key,
        emoji: mapped.emoji,
        title: mapped.title,
        note: mapped.note,
        score,
      };
    }

    return {
      id: key,
      emoji: "✨",
      title: toReadableLabel(key),
      note: "This trait shows up strongly in the way you answered your onboarding questions.",
      score,
    };
  });
}

export default function YourVibe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traits, setTraits] = useState({});
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const profile = await fetchProfileSummary();
        if (!active) {
          return;
        }
        setTraits(profile?.traits || {});
        setResponseCount(Array.isArray(profile?.personality_responses) ? profile.personality_responses.length : 0);
      } catch (apiError) {
        if (!active) {
          return;
        }
        setError(apiError.message || "Could not load your vibe yet.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const vibes = useMemo(() => mapTraitsToVibes(traits), [traits]);
  const hasVibes = vibes.length > 0;

  return (
    <main className="tara-page-shell-compact flex min-h-[100dvh] items-center px-5 py-8">
      <Card
        title="Your Vibe"
        subtitle={
          hasVibes
            ? `Based on ${responseCount} answered onboarding question${responseCount === 1 ? "" : "s"}.`
            : "Your vibe appears after you answer the personality questions in onboarding."
        }
      >
        {loading ? <Loader text="Reading your vibe..." /> : null}

        {!loading ? (
          hasVibes ? (
            <div className="space-y-3">
              {vibes.map((item, index) => (
                <article
                  className="tara-screen-panel vibe-card px-4 py-3"
                  data-testid={`vibe-card-${item.id}`}
                  key={item.id}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[color:var(--tara-text-primary)]">
                        <span className="mr-2 text-base">{item.emoji}</span>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--tara-text-secondary)]">{item.note}</p>
                    </div>
                    <div className="tara-chip tara-chip-gold px-2.5 py-1 text-[11px] font-medium">
                      {item.score.toFixed(1)}/10
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div
              className="tara-support-surface rounded-2xl border-dashed px-4 py-5 text-sm"
              data-testid="your-vibe-empty"
            >
              <p className="font-medium text-[color:var(--tara-text-primary)]">No vibe summary yet</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--tara-text-secondary)]">
                We&apos;ll show your strongest traits here once you answer the onboarding personality questions.
              </p>
            </div>
          )
        ) : null}

        {error ? (
          <p className="tara-alert tara-alert-error mt-4 text-xs">{error}</p>
        ) : null}

        <div className="mt-5">
          <Button onClick={() => navigate("/matches")}>See Matches</Button>
        </div>
      </Card>
    </main>
  );
}
