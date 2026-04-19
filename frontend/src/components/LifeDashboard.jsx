import { motion } from "framer-motion";

const SCORE_META = [
  { key: "career", label: "Career", color: "from-cyan-400 to-indigo-500" },
  { key: "love", label: "Love", color: "from-pink-400 to-rose-500" },
  { key: "finance", label: "Finance", color: "from-amber-400 to-orange-500" },
];

function clamp(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
}

function normalizeScores(rawScores) {
  const raw = rawScores && typeof rawScores === "object" ? rawScores : {};
  return SCORE_META.map((item) => {
    const source = Number(raw[item.key]);
    const normalized = source > 10 ? clamp(source) : clamp(source * 10);
    return {
      ...item,
      value: normalized,
    };
  });
}

export default function LifeDashboard({ scores }) {
  const bars = normalizeScores(scores);

  return (
    <section className="rounded-3xl glass p-5">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Life dashboard</p>
      </div>
      <div className="space-y-4">
        {bars.map((item, index) => (
          <div key={item.key}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-[color:var(--tara-text-primary)]">{item.label}</span>
              <span className="text-[color:var(--tara-text-secondary)]">{Math.round(item.value)}%</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.value}%` }}
                transition={{ duration: 0.55, delay: index * 0.08, ease: "easeOut" }}
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${item.color}`}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

