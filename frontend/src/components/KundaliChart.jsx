import { motion } from "framer-motion";

const HOUSE_POSITIONS = {
  1: { x: 170, y: 268 },
  2: { x: 242, y: 242 },
  3: { x: 285, y: 170 },
  4: { x: 242, y: 98 },
  5: { x: 170, y: 58 },
  6: { x: 98, y: 98 },
  7: { x: 55, y: 170 },
  8: { x: 98, y: 242 },
  9: { x: 132, y: 170 },
  10: { x: 170, y: 132 },
  11: { x: 208, y: 170 },
  12: { x: 170, y: 208 },
};

const PLANET_META = {
  sun: { short: "Su", color: "#f5c36b" },
  moon: { short: "Mo", color: "#a5f3fc" },
  mars: { short: "Ma", color: "#fb7185" },
  mercury: { short: "Me", color: "#60a5fa" },
  jupiter: { short: "Ju", color: "#a3e635" },
  venus: { short: "Ve", color: "#f0abfc" },
  saturn: { short: "Sa", color: "#cbd5e1" },
  rahu: { short: "Ra", color: "#facc15" },
  ketu: { short: "Ke", color: "#67e8f9" },
};

function normalizeHouses(houses) {
  if (!houses || typeof houses !== "object") {
    return {};
  }
  const next = {};
  for (let i = 1; i <= 12; i += 1) {
    const key = String(i);
    const entry = houses[key] || houses[i] || {};
    next[i] = {
      sign: String(entry.sign || ""),
      planets: Array.isArray(entry.planets) ? entry.planets : [],
    };
  }
  return next;
}

function normalizePlanets(planets, housesBySign) {
  if (!planets || typeof planets !== "object") return [];
  return Object.entries(planets)
    .map(([name, payload]) => {
      const houseFromPayload = Number(payload?.house || 0);
      const sign = String(payload?.sign || "");
      const house = houseFromPayload >= 1 && houseFromPayload <= 12 ? houseFromPayload : Number(housesBySign[sign] || 0);
      return {
        name: String(name || ""),
        key: String(name || "").toLowerCase(),
        house,
      };
    })
    .filter((item) => item.house >= 1 && item.house <= 12);
}

export default function KundaliChart({ houses = {}, planets = {}, className = "" }) {
  const houseData = normalizeHouses(houses);
  const housesBySign = Object.entries(houseData).reduce((acc, [houseNo, payload]) => {
    if (payload?.sign) {
      acc[payload.sign] = houseNo;
    }
    return acc;
  }, {});

  const groupedPlanets = normalizePlanets(planets, housesBySign).reduce((acc, planet) => {
    const list = acc[planet.house] || [];
    list.push(planet);
    acc[planet.house] = list;
    return acc;
  }, {});

  const planetPoints = Object.entries(groupedPlanets).flatMap(([houseNo, list]) => {
    const house = Number(houseNo);
    const center = HOUSE_POSITIONS[house];
    return list.map((planet, indexInHouse) => {
      const angle = (indexInHouse / Math.max(list.length, 1)) * Math.PI * 2;
      const radius = list.length > 1 ? 12 : 0;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius + 13;
      const meta = PLANET_META[planet.key] || { short: planet.name.slice(0, 2).toUpperCase(), color: "#c4b5fd" };
      return {
        ...planet,
        x,
        y,
        short: meta.short,
        color: meta.color,
      };
    });
  });

  return (
    <motion.section
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`mx-auto w-full max-w-[360px] ${className}`}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.35 }}
    >
      <div className="relative rounded-3xl border border-[rgba(246,194,107,0.35)] bg-[radial-gradient(circle_at_center,rgba(53,35,103,0.6)_0%,rgba(16,10,44,0.95)_72%)] p-4 shadow-xl shadow-black/30">
        <svg className="h-[340px] w-full" viewBox="0 0 340 340">
          <defs>
            <linearGradient id="northChartStroke" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(246,194,107,0.9)" />
              <stop offset="100%" stopColor="rgba(153,116,255,0.72)" />
            </linearGradient>
          </defs>

          <polygon
            fill="rgba(14,9,45,0.88)"
            points="170,10 330,170 170,330 10,170"
            stroke="url(#northChartStroke)"
            strokeWidth="2"
          />

          <line x1="170" x2="170" y1="10" y2="330" stroke="rgba(246,194,107,0.45)" strokeWidth="1" />
          <line x1="10" x2="330" y1="170" y2="170" stroke="rgba(246,194,107,0.45)" strokeWidth="1" />
          <line x1="90" x2="250" y1="90" y2="250" stroke="rgba(246,194,107,0.38)" strokeWidth="1" />
          <line x1="250" x2="90" y1="90" y2="250" stroke="rgba(246,194,107,0.38)" strokeWidth="1" />
          <line x1="170" x2="250" y1="10" y2="90" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="330" x2="250" y1="170" y2="90" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="330" x2="250" y1="170" y2="250" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="170" x2="250" y1="330" y2="250" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="170" x2="90" y1="330" y2="250" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="10" x2="90" y1="170" y2="250" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="10" x2="90" y1="170" y2="90" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />
          <line x1="170" x2="90" y1="10" y2="90" stroke="rgba(246,194,107,0.30)" strokeWidth="1" />

          {Array.from({ length: 12 }).map((_, index) => {
            const houseNo = index + 1;
            const house = houseData[houseNo] || { sign: "", planets: [] };
            const pos = HOUSE_POSITIONS[houseNo];
            const signLabel = house.sign ? String(house.sign).slice(0, 3).toUpperCase() : "";
            return (
              <g key={`house-${houseNo}`}>
                <text
                  x={pos.x}
                  y={pos.y - 8}
                  textAnchor="middle"
                  fill="rgba(255,241,214,0.95)"
                  fontFamily="Inter, sans-serif"
                  fontSize="9"
                  fontWeight="700"
                >
                  H{houseNo}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 7}
                  textAnchor="middle"
                  fill="rgba(246,194,107,0.95)"
                  fontFamily="Inter, sans-serif"
                  fontSize="10"
                  fontWeight="600"
                >
                  {signLabel}
                </text>
              </g>
            );
          })}
        </svg>

          {planetPoints.map((point, index) => (
            <motion.span
              animate={{ opacity: 1, scale: 1 }}
              className="absolute z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-white/40 px-1 text-[9px] font-bold text-slate-900"
              initial={{ opacity: 0, scale: 0.4 }}
              key={`${point.name}-${index}`}
              style={{
                left: `calc(${(point.x / 340) * 100}% - 12px)`,
                top: `calc(${(point.y / 340) * 100}% - 12px)`,
                background: point.color,
                boxShadow: `0 0 14px ${point.color}`,
              }}
              title={`${point.name} • House ${point.house}`}
              transition={{ delay: 0.08 * index, duration: 0.22 }}
            >
              {point.short}
            </motion.span>
        ))}
      </div>
    </motion.section>
  );
}
