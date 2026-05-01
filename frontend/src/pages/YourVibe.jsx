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
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md items-center px-5 py-8">
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
                  className="vibe-card rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-slate-100"
                  data-testid={`vibe-card-${item.id}`}
                  key={item.id}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        <span className="mr-2 text-base">{item.emoji}</span>
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{item.note}</p>
                    </div>
                    <div className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-medium text-cyan-100">
                      {item.score.toFixed(1)}/10
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl border border-dashed border-white/15 bg-white/[0.05] px-4 py-5 text-sm text-slate-200"
              data-testid="your-vibe-empty"
            >
              <p className="font-medium text-white">No vibe summary yet</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                We&apos;ll show your strongest traits here once you answer the onboarding personality questions.
              </p>
            </div>
          )
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5">
          <Button onClick={() => navigate("/matches")}>See Matches</Button>
        </div>
      </Card>
    </main>
  );
}
