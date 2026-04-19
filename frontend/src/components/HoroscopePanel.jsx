import { motion } from "framer-motion";
import { Coins, Heart, Sparkles, BriefcaseBusiness, Activity } from "lucide-react";

import Loader from "./Loader";

const SECTION_META = [
  { key: "career", label: "Career", icon: BriefcaseBusiness },
  { key: "love", label: "Love", icon: Heart },
  { key: "finance", label: "Finance", icon: Coins },
  { key: "wellbeing", label: "Wellbeing", icon: Activity },
  { key: "overall", label: "Overall", icon: Sparkles },
];

function normalizeSummary(horoscope) {
  const data = horoscope && typeof horoscope === "object" ? horoscope : {};
  return SECTION_META.map((entry) => ({
    ...entry,
    text: String(data[entry.key] || ""),
  })).filter((entry) => entry.text.length > 0);
}

function normalizeDetailed(horoscope) {
  const raw = horoscope?.detailed && typeof horoscope.detailed === "object" ? horoscope.detailed : {};
  return ["career", "love", "finance", "wellbeing"]
    .map((key) => {
      const item = raw[key];
      return {
        key,
        summary: String(item?.summary || ""),
        opportunities: Array.isArray(item?.opportunities) ? item.opportunities : [],
        cautions: Array.isArray(item?.cautions) ? item.cautions : [],
        action: String(item?.action || ""),
      };
    })
    .filter((entry) => entry.summary || entry.action || entry.opportunities.length > 0 || entry.cautions.length > 0);
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeKeyTransits(horoscope) {
  const raw = Array.isArray(horoscope?.key_transits) ? horoscope.key_transits : [];
  return raw
    .map((item) => ({
      planet: String(item?.planet || ""),
      sign: String(item?.sign || ""),
      house: Number(item?.house || 0),
      theme: String(item?.theme || ""),
      message: String(item?.message || ""),
    }))
    .filter((item) => item.planet && item.house > 0);
}

export default function HoroscopePanel({ horoscope, loading = false, error = "", moonSign = "" }) {
  const cards = normalizeSummary(horoscope);
  const detailed = normalizeDetailed(horoscope);
  const keyTransits = normalizeKeyTransits(horoscope);

  return (
    <section className="rounded-3xl glass p-5">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Daily horoscope</p>
        {moonSign ? (
          <p className="mt-1 text-[11px] text-[color:var(--tara-text-secondary)]">Based on your current chart and moon sign: {moonSign}</p>
        ) : null}
      </div>

      {loading ? <Loader text="Reading today's transits..." /> : null}

      {!loading && error ? (
        <p className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card, index) => {
              const Icon = card.icon;
              return (
                <motion.article
                  key={card.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.24 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--tara-violet)]/20">
                      <Icon className="h-4 w-4 text-[color:var(--tara-gold)]" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">{card.label}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-[color:var(--tara-text-primary)]">{card.text}</p>
                </motion.article>
              );
            })}
          </div>

          {detailed.length > 0 ? (
            <div className="space-y-3">
              {detailed.map((item, index) => (
                <motion.article
                  key={item.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.05, duration: 0.24 }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">
                    {titleCase(item.key)}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--tara-text-primary)]">{item.summary}</p>
                  {item.opportunities.length > 0 ? (
                    <p className="mt-2 text-[11px] text-emerald-200">
                      Opportunity: {item.opportunities[0]}
                    </p>
                  ) : null}
                  {item.cautions.length > 0 ? (
                    <p className="mt-1 text-[11px] text-amber-200">
                      Watch for: {item.cautions[0]}
                    </p>
                  ) : null}
                  {item.action ? (
                    <p className="mt-1 text-[11px] text-[color:var(--tara-gold)]">Action: {item.action}</p>
                  ) : null}
                </motion.article>
              ))}
            </div>
          ) : null}

          {keyTransits.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">
                Key transits used
              </p>
              <div className="space-y-2">
                {keyTransits.map((item) => (
                  <div key={`${item.planet}-${item.house}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <p className="text-xs font-semibold text-[color:var(--tara-text-primary)]">
                      {item.planet} in House {item.house} ({item.sign})
                    </p>
                    <p className="text-[11px] text-[color:var(--tara-text-secondary)]">
                      {item.message} This area rules {item.theme}.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {cards.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-[color:var(--tara-text-secondary)]">
              Save birth details to generate your daily horoscope.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
