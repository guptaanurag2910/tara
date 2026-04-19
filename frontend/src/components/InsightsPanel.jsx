import { motion } from "framer-motion";
import { Brain, BriefcaseBusiness, HeartHandshake, Heart, Activity, TrendingUp } from "lucide-react";

const INSIGHT_META = {
  personality: {
    title: "Personality",
    icon: Brain,
    fallback: "Your chart suggests a reflective, intuitive nature with a strong inner compass.",
  },
  career: {
    title: "Career",
    icon: BriefcaseBusiness,
    fallback: "Steady focus and long-term consistency can unlock your strongest career growth.",
  },
  emotions: {
    title: "Emotions",
    icon: HeartHandshake,
    fallback: "Emotional clarity deepens when you balance intuition with honest communication.",
  },
  relationships: {
    title: "Relationships",
    icon: Heart,
    fallback: "Your bonds deepen when emotional honesty and consistency move together.",
  },
  wellbeing: {
    title: "Wellbeing",
    icon: Activity,
    fallback: "Protecting your routine keeps your mind clear and your energy stable.",
  },
  growth: {
    title: "Growth",
    icon: TrendingUp,
    fallback: "Your chart favors steady progress over sudden intensity.",
  },
};

function normalizeInsights(insights) {
  const raw = insights && typeof insights === "object" ? insights : {};
  return ["personality", "career", "emotions", "relationships", "wellbeing", "growth"].map((key) => ({
    key,
    title: INSIGHT_META[key].title,
    icon: INSIGHT_META[key].icon,
    text: String(raw[key] || INSIGHT_META[key].fallback),
  }));
}

export default function InsightsPanel({ insights }) {
  const cards = normalizeInsights(insights);

  return (
    <section className="rounded-3xl glass p-5">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Top insights</p>
      </div>
      <div className="space-y-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.24 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--tara-violet)]/25">
                  <Icon className="h-4 w-4 text-[color:var(--tara-gold)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--tara-text-primary)]">{card.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--tara-text-secondary)]">{card.text}</p>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
