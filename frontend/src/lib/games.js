export const GAMES = {
  tot: {
    id: "tot",
    label: "This or That",
    emoji: "⚖️",
    tagline: "Three quick choices. No overthinking.",
    rounds: [
      { q: "Mountains or ocean?", a: "Mountains", b: "Ocean", partnerPick: 0 },
      { q: "Sunrise or sunset?", a: "Sunrise", b: "Sunset", partnerPick: 1 },
      { q: "Books or films?", a: "Books", b: "Films", partnerPick: 0 },
    ],
  },
  predict: {
    id: "predict",
    label: "Predict Me",
    emoji: "🔮",
    tagline: "Guess what they'd say. The stars are watching.",
    rounds: [
      { q: "Their love language is…", a: "Words", b: "Touch", partnerPick: 1 },
      { q: "On a free Sunday they'd…", a: "Stay in", b: "Wander out", partnerPick: 0 },
      { q: "They cry more at…", a: "Songs", b: "Movies", partnerPick: 1 },
    ],
  },
  deal: {
    id: "deal",
    label: "Deal Breaker",
    emoji: "💔",
    tagline: "Be honest. The chart already knows.",
    rounds: [
      { q: "A real deal breaker is…", a: "Bad listener", b: "Always late", partnerPick: 0 },
      { q: "Worse on a first date…", a: "Phone out", b: "Talks only about ex", partnerPick: 1 },
      { q: "Hardest to forgive…", a: "Dishonesty", b: "Disrespect", partnerPick: 0 },
    ],
  },
};

export function buildVerdict(score, total, gameId) {
  const pct = Number(total) > 0 ? Number(score) / Number(total) : 0;
  if (gameId === "deal") {
    if (pct === 1) return "Same red flags. Suspiciously aligned.";
    if (pct >= 0.66) return "You'd walk away from the same things.";
    if (pct >= 0.33) return "Different limits — worth a real talk.";
    return "Opposite deal breakers. Could be friction, could be growth.";
  }
  if (pct === 1) return "Cosmic sync. Perfect score.";
  if (pct >= 0.66) return "Mostly aligned — a soft kind of match.";
  if (pct >= 0.33) return "Half and half. Interesting tension.";
  return "Total opposites. The chart loves contrast.";
}
