import { motion } from "framer-motion";
import { Atom, Compass } from "lucide-react";

const PLANET_ORDER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toPlanetRows(planets) {
  if (!planets || typeof planets !== "object") {
    return [];
  }
  const entries = Object.entries(planets).map(([name, payload]) => ({
    key: String(name || "").toLowerCase(),
    name: titleCase(name),
    sign: titleCase(payload?.sign || ""),
    house: Number(payload?.house || 0),
    degree_in_sign: Number(payload?.degree_in_sign || 0),
    degree: Number(payload?.degree || 0),
  }));

  entries.sort((a, b) => {
    const ai = PLANET_ORDER.indexOf(a.key);
    const bi = PLANET_ORDER.indexOf(b.key);
    const ao = ai === -1 ? 99 : ai;
    const bo = bi === -1 ? 99 : bi;
    return ao - bo;
  });
  return entries;
}

function toHouseRows(houses) {
  if (!houses || typeof houses !== "object") {
    return [];
  }
  return Array.from({ length: 12 }, (_, idx) => {
    const houseNo = idx + 1;
    const source = houses[String(houseNo)] || houses[houseNo] || {};
    return {
      house: houseNo,
      sign: titleCase(source?.sign || ""),
      planets: Array.isArray(source?.planets) ? source.planets.map((planet) => titleCase(planet)).join(", ") : "",
    };
  });
}

export default function ChartDataPanel({ planets, houses }) {
  const planetRows = toPlanetRows(planets);
  const houseRows = toHouseRows(houses);

  return (
    <section className="rounded-3xl glass p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Chart basis</p>
        <p className="mt-1 text-xs text-[color:var(--tara-text-secondary)]">
          These are the actual sidereal placements used to generate your readings.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--tara-violet)]/20">
              <Atom className="h-4 w-4 text-[color:var(--tara-gold)]" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">
              Planetary positions
            </p>
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {planetRows.map((row) => (
              <div key={row.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-semibold text-[color:var(--tara-text-primary)]">
                  {row.name} • House {row.house || "—"}
                </p>
                <p className="text-[11px] text-[color:var(--tara-text-secondary)]">
                  {row.sign || "—"} • {row.degree_in_sign.toFixed(2)}° ({row.degree.toFixed(2)}° absolute)
                </p>
              </div>
            ))}
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:var(--tara-violet)]/20">
              <Compass className="h-4 w-4 text-[color:var(--tara-gold)]" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">
              House mapping
            </p>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
            {houseRows.map((row) => (
              <div key={row.house} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs font-semibold text-[color:var(--tara-text-primary)]">
                  House {row.house} • {row.sign || "—"}
                </p>
                <p className="text-[11px] text-[color:var(--tara-text-secondary)]">
                  {row.planets || "No major planet placement"}
                </p>
              </div>
            ))}
          </div>
        </motion.article>
      </div>
    </section>
  );
}

