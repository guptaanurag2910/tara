import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../components/Button";
import Card from "../components/Card";
import Loader from "../components/Loader";
import { fetchProfileSummary } from "../services/onboardingService";

const DEFAULT_VIBES = [
  { id: "vibe-1", emoji: "✨", text: "Calm overthinker" },
  { id: "vibe-2", emoji: "🌙", text: "Emotionally deep" },
  { id: "vibe-3", emoji: "💘", text: "Values real connection" },
];

const TRAIT_TEXT_MAP = {
  overthinking: { emoji: "✨", text: "Calm overthinker" },
  emotional_depth: { emoji: "🌙", text: "Emotionally deep" },
  communication: { emoji: "💘", text: "Values real connection" },
};

function toReadableLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function mapTraitsToVibes(traits) {
  const entries = Object.entries(traits || {})
    .filter(([, value]) => typeof value === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (entries.length === 0) {
    return DEFAULT_VIBES;
  }

  return entries.map(([key]) => {
    const mapped = TRAIT_TEXT_MAP[key];
    if (mapped) {
      return {
        id: key,
        emoji: mapped.emoji,
        text: mapped.text,
      };
    }

    return {
      id: key,
      emoji: "✨",
      text: `Leans into ${toReadableLabel(key)}`,
    };
  });
}

export default function YourVibe() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traits, setTraits] = useState({});

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-5 py-8">
      <Card title="Your Vibe" subtitle="Here is how Tara sees your energy right now.">
        {loading ? <Loader text="Reading your vibe..." /> : null}

        {!loading ? (
          <div className="space-y-3">
            {vibes.map((item, index) => (
              <article
                className="vibe-card rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 text-sm text-slate-100"
                key={item.id}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <span className="text-base">{item.emoji}</span>
                <span className="ml-2">{item.text}</span>
              </article>
            ))}
          </div>
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
