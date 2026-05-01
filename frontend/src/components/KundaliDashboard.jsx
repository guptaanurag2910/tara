import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BarChart3,
  Brain,
  Compass,
  House,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { fetchDailyHoroscope, fetchKundali } from "../services/astrologyService";
import Button from "./Button";
import KundaliChart from "./KundaliChart";
import LifeDashboard from "./LifeDashboard";
import Loader from "./Loader";

const DETAIL_META = {
  today: {
    title: "Today's guidance",
    label: "Transit read",
    icon: Sparkles,
  },
  core: {
    title: "Core chart",
    label: "Lagna, moon, sun",
    icon: Compass,
  },
  themes: {
    title: "Life themes",
    label: "Personal reading",
    icon: Brain,
  },
  planets: {
    title: "Planet positions",
    label: "Graha details",
    icon: Atom,
  },
  houses: {
    title: "12 houses",
    label: "Whole-sign mapping",
    icon: House,
  },
  scores: {
    title: "Life scores",
    label: "Soft guidance",
    icon: BarChart3,
  },
};

const PLANET_ORDER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];

function readableLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sentencePreview(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }
  const firstSentence = text.match(/[^.!?]+[.!?]?/);
  const candidate = (firstSentence?.[0] || text).trim();
  if (candidate.length <= 120) {
    return candidate;
  }
  return `${candidate.slice(0, 117).trimEnd()}...`;
}

function formatDegree(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "--";
  }
  return `${parsed.toFixed(2)}deg`;
}

function normalizeHouses(kundali) {
  const raw = kundali?.chart_data?.houses || kundali?.houses || {};
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next = {};
  for (let i = 1; i <= 12; i += 1) {
    const source = raw[String(i)] || raw[i] || {};
    next[String(i)] = {
      sign: readableLabel(source.sign || source.rashi || ""),
      planets: Array.isArray(source.planets) ? source.planets.map((planet) => readableLabel(planet)) : [],
    };
  }
  return next;
}

function normalizePlanets(kundali) {
  const raw = kundali?.chart_data?.planets || kundali?.planets || {};
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const next = {};
  Object.entries(raw).forEach(([key, payload]) => {
    next[String(key).toLowerCase()] = {
      house: Number(payload?.house || 0),
      sign: readableLabel(payload?.sign || ""),
      degree: Number(payload?.degree || 0),
      degree_in_sign: Number(payload?.degree_in_sign || 0),
    };
  });
  return next;
}

function normalizeInsights(kundali) {
  const raw = kundali?.insights;
  if (!raw || typeof raw !== "object") {
    return [];
  }
  return [
    { key: "personality", title: "Personality", text: String(raw.personality || "") },
    { key: "career", title: "Career", text: String(raw.career || "") },
    { key: "emotions", title: "Emotions", text: String(raw.emotions || "") },
    { key: "relationships", title: "Relationships", text: String(raw.relationships || "") },
    { key: "wellbeing", title: "Wellbeing", text: String(raw.wellbeing || "") },
    { key: "growth", title: "Growth", text: String(raw.growth || "") },
  ].filter((item) => item.text);
}

function normalizeScores(kundali) {
  const raw = kundali?.scores;
  if (!raw || typeof raw !== "object") {
    return {};
  }
  return {
    career: Number(raw.career || 0),
    love: Number(raw.love || 0),
    finance: Number(raw.finance || 0),
  };
}

function normalizeHoroscope(horoscope) {
  const raw = horoscope && typeof horoscope === "object" ? horoscope : {};
  const detailed = raw?.detailed && typeof raw.detailed === "object" ? raw.detailed : {};
  const keyTransits = Array.isArray(raw?.key_transits) ? raw.key_transits : [];

  return {
    date: String(raw?.date || ""),
    source: String(raw?.source || ""),
    overall: String(raw?.overall || ""),
    sections: [
      {
        key: "career",
        title: "Career",
        text: String(raw?.career || ""),
        action: String(detailed?.career?.action || ""),
        opportunity: Array.isArray(detailed?.career?.opportunities) ? String(detailed.career.opportunities[0] || "") : "",
        caution: Array.isArray(detailed?.career?.cautions) ? String(detailed.career.cautions[0] || "") : "",
      },
      {
        key: "love",
        title: "Love",
        text: String(raw?.love || ""),
        action: String(detailed?.love?.action || ""),
        opportunity: Array.isArray(detailed?.love?.opportunities) ? String(detailed.love.opportunities[0] || "") : "",
        caution: Array.isArray(detailed?.love?.cautions) ? String(detailed.love.cautions[0] || "") : "",
      },
      {
        key: "finance",
        title: "Finance",
        text: String(raw?.finance || ""),
        action: String(detailed?.finance?.action || ""),
        opportunity: Array.isArray(detailed?.finance?.opportunities) ? String(detailed.finance.opportunities[0] || "") : "",
        caution: Array.isArray(detailed?.finance?.cautions) ? String(detailed.finance.cautions[0] || "") : "",
      },
      {
        key: "wellbeing",
        title: "Wellbeing",
        text: String(detailed?.wellbeing?.summary || ""),
        action: String(detailed?.wellbeing?.action || ""),
        opportunity: Array.isArray(detailed?.wellbeing?.opportunities) ? String(detailed.wellbeing.opportunities[0] || "") : "",
        caution: Array.isArray(detailed?.wellbeing?.cautions) ? String(detailed.wellbeing.cautions[0] || "") : "",
      },
    ].filter((item) => item.text || item.action || item.opportunity || item.caution),
    keyTransits: keyTransits
      .map((item) => ({
        planet: readableLabel(item?.planet || ""),
        sign: readableLabel(item?.sign || ""),
        house: Number(item?.house || 0),
        message: String(item?.message || ""),
        theme: String(item?.theme || ""),
      }))
      .filter((item) => item.planet && item.house > 0),
  };
}

function toPlanetRows(planets) {
  if (!planets || typeof planets !== "object") {
    return [];
  }

  const entries = Object.entries(planets).map(([key, payload]) => ({
    key: String(key || "").toLowerCase(),
    title: readableLabel(key),
    sign: readableLabel(payload?.sign || ""),
    house: Number(payload?.house || 0),
    degree: Number(payload?.degree || 0),
    degreeInSign: Number(payload?.degree_in_sign || 0),
  }));

  entries.sort((left, right) => {
    const leftOrder = PLANET_ORDER.indexOf(left.key);
    const rightOrder = PLANET_ORDER.indexOf(right.key);
    return (leftOrder === -1 ? 99 : leftOrder) - (rightOrder === -1 ? 99 : rightOrder);
  });
  return entries;
}

function toHouseRows(houses) {
  return Array.from({ length: 12 }, (_, index) => {
    const houseNumber = index + 1;
    const payload = houses[String(houseNumber)] || houses[houseNumber] || {};
    return {
      house: houseNumber,
      sign: readableLabel(payload?.sign || ""),
      planets: Array.isArray(payload?.planets) ? payload.planets : [],
    };
  });
}

function formatUpdatedAt(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ExploreCard({ section, active, onClick }) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-4 text-left transition ${
        active
          ? "border-[color:var(--tara-gold)] bg-white/10 shadow-lg shadow-black/20"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--tara-gold)]">{section.label}</p>
          <h3 className="text-base font-semibold text-[color:var(--tara-text-primary)]">{section.title}</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--tara-violet)]/25">
          <Icon className="h-4 w-4 text-[color:var(--tara-gold)]" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--tara-text-secondary)]">{section.preview}</p>
    </button>
  );
}

function DetailPanelHeader({ title, label, description }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--tara-gold)]">{label}</p>
      <h3 className="mt-2 text-2xl font-semibold text-[color:var(--tara-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--tara-text-secondary)]">{description}</p>
      ) : null}
    </div>
  );
}

function DailyGuidanceDetail({ horoscope }) {
  const sourceLabel =
    horoscope.source === "transit"
      ? "Based on today's transits through your houses"
      : horoscope.source === "moon-sign-fallback"
        ? "Fallback read using your moon sign"
        : "";

  return (
    <div className="space-y-4">
      {horoscope.overall ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Overall</p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--tara-text-primary)]">{horoscope.overall}</p>
          {sourceLabel ? (
            <p className="mt-2 text-[11px] text-[color:var(--tara-text-secondary)]">{sourceLabel}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {horoscope.sections.map((section) => (
          <article key={section.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">{section.title}</p>
            {section.text ? (
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--tara-text-primary)]">{section.text}</p>
            ) : null}
            {section.opportunity ? (
              <p className="mt-3 text-[12px] text-emerald-200">Opportunity: {section.opportunity}</p>
            ) : null}
            {section.caution ? (
              <p className="mt-1 text-[12px] text-amber-200">Watch for: {section.caution}</p>
            ) : null}
            {section.action ? (
              <p className="mt-1 text-[12px] text-[color:var(--tara-gold)]">Action: {section.action}</p>
            ) : null}
          </article>
        ))}
      </div>

      {horoscope.keyTransits.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Key transits used</p>
          <div className="mt-3 space-y-2">
            {horoscope.keyTransits.slice(0, 4).map((item) => (
              <div key={`${item.planet}-${item.house}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-sm font-medium text-[color:var(--tara-text-primary)]">
                  {item.planet} in House {item.house} ({item.sign || "Current sign"})
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--tara-text-secondary)]">
                  {item.message} This area highlights {item.theme}.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CoreChartDetail({ kundali, lagnaLabel, moonSignLabel, sunSignLabel, houses, planets }) {
  const ascendantDegree = Number(kundali?.chart_data?.ascendant_degree || kundali?.ascendant_degree || 0);
  const planetRows = toPlanetRows(planets);
  const signatureRows = planetRows.filter((item) => ["moon", "mercury", "venus", "saturn", "rahu"].includes(item.key)).slice(0, 4);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
      <KundaliChart houses={houses} planets={planets} />

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Lagna</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--tara-text-primary)]">{lagnaLabel || "--"}</p>
            <p className="mt-1 text-[12px] text-[color:var(--tara-text-secondary)]">Ascendant degree: {formatDegree(ascendantDegree)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Luminaries</p>
            <p className="mt-2 text-sm text-[color:var(--tara-text-primary)]">Moon in {moonSignLabel || "--"}</p>
            <p className="mt-1 text-sm text-[color:var(--tara-text-primary)]">Sun in {sunSignLabel || "--"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Relationship axis</p>
            <p className="mt-2 text-sm text-[color:var(--tara-text-primary)]">
              1st house {houses?.["1"]?.sign || "--"} · 7th house {houses?.["7"]?.sign || "--"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Work axis</p>
            <p className="mt-2 text-sm text-[color:var(--tara-text-primary)]">
              10th house {houses?.["10"]?.sign || "--"} · 11th house {houses?.["11"]?.sign || "--"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">Signature placements</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {signatureRows.map((row) => (
              <div key={row.key} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-sm font-medium text-[color:var(--tara-text-primary)]">{row.title}</p>
                <p className="mt-1 text-[12px] text-[color:var(--tara-text-secondary)]">
                  {row.sign || "--"} · House {row.house || "--"} · {formatDegree(row.degreeInSign)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LifeThemesDetail({ insights }) {
  return (
    <div className="space-y-3">
      {insights.map((item) => (
        <article key={item.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">{item.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--tara-text-primary)]">{item.text}</p>
        </article>
      ))}
    </div>
  );
}

function PlanetPositionsDetail({ planets }) {
  const planetRows = toPlanetRows(planets);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {planetRows.map((row) => (
        <article key={row.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-[color:var(--tara-text-primary)]">{row.title}</p>
          <div className="mt-2 space-y-1 text-[12px] text-[color:var(--tara-text-secondary)]">
            <p>Sign: {row.sign || "--"}</p>
            <p>House: {row.house || "--"}</p>
            <p>Degree in sign: {formatDegree(row.degreeInSign)}</p>
            <p>Absolute degree: {formatDegree(row.degree)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function HousesDetail({ houses }) {
  const houseRows = toHouseRows(houses);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {houseRows.map((row) => (
        <article key={row.house} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-[color:var(--tara-text-primary)]">
            House {row.house} · {row.sign || "--"}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--tara-text-secondary)]">
            {row.planets.length > 0 ? row.planets.join(", ") : "No major planet placed here in this chart view."}
          </p>
        </article>
      ))}
    </div>
  );
}

function LifeScoresDetail({ scores }) {
  return (
    <div className="space-y-4">
      <LifeDashboard scores={scores} />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-[color:var(--tara-text-secondary)]">
        These are soft guidance scores, not fixed destiny. They are derived from your chart's current stored reading
        so you can quickly see which life areas look naturally supported right now.
      </div>
    </div>
  );
}

function renderDetailContent({ activeSection, kundali, horoscope, houses, planets, insights, scores, lagnaLabel, moonSignLabel, sunSignLabel }) {
  switch (activeSection) {
    case "today":
      return <DailyGuidanceDetail horoscope={horoscope} />;
    case "core":
      return (
        <CoreChartDetail
          kundali={kundali}
          lagnaLabel={lagnaLabel}
          moonSignLabel={moonSignLabel}
          sunSignLabel={sunSignLabel}
          houses={houses}
          planets={planets}
        />
      );
    case "themes":
      return <LifeThemesDetail insights={insights} />;
    case "planets":
      return <PlanetPositionsDetail planets={planets} />;
    case "houses":
      return <HousesDetail houses={houses} />;
    case "scores":
      return <LifeScoresDetail scores={scores} />;
    default:
      return null;
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

export default function KundaliDashboard({ reloadSignal = 0 }) {
  const [kundali, setKundali] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("today");

  const loadDashboard = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const kundaliPayload = await fetchKundali();
      setKundali(kundaliPayload || null);

      try {
        const horoscopePayload = await fetchDailyHoroscope();
        setHoroscope(horoscopePayload || null);
      } catch (apiError) {
        setHoroscope({
          overall: apiError?.message || "Could not load today's guidance.",
          sections: [],
          keyTransits: [],
          source: "",
          date: "",
        });
      }
    } catch (apiError) {
      setKundali(null);
      setHoroscope(null);
      if (apiError?.status === 404) {
        setError("Kundali is not generated yet. Add your birth details to create the chart first.");
      } else {
        setError(apiError?.message || "Could not load kundali right now.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [reloadSignal]);

  const houses = useMemo(() => normalizeHouses(kundali), [kundali]);
  const planets = useMemo(() => normalizePlanets(kundali), [kundali]);
  const insights = useMemo(() => normalizeInsights(kundali), [kundali]);
  const scores = useMemo(() => normalizeScores(kundali), [kundali]);
  const horoscopeSummary = useMemo(() => normalizeHoroscope(horoscope), [horoscope]);

  const lagnaLabel = readableLabel(kundali?.lagna || "");
  const moonSignLabel = readableLabel(kundali?.moon_sign || "");
  const sunSignLabel = readableLabel(kundali?.sun_sign || "");
  const updatedAtLabel = formatUpdatedAt(kundali?.updated_at);

  const sections = useMemo(
    () => [
      {
        key: "today",
        ...DETAIL_META.today,
        preview: sentencePreview(
          horoscopeSummary.overall || horoscopeSummary.sections[0]?.text,
          "See today's horoscope in one focused, readable view.",
        ),
      },
      {
        key: "core",
        ...DETAIL_META.core,
        preview: `${lagnaLabel || "--"} lagna, Moon in ${moonSignLabel || "--"}, Sun in ${sunSignLabel || "--"}.`,
      },
      {
        key: "themes",
        ...DETAIL_META.themes,
        preview: sentencePreview(
          insights[0]?.text || insights[1]?.text,
          "Read the main personality, relationship, and growth themes from your chart.",
        ),
      },
      {
        key: "planets",
        ...DETAIL_META.planets,
        preview: `${toPlanetRows(planets).length} grahas with sign, house, and exact degree.`,
      },
      {
        key: "houses",
        ...DETAIL_META.houses,
        preview: `House 1 ${houses?.["1"]?.sign || "--"} · House 7 ${houses?.["7"]?.sign || "--"} · House 10 ${houses?.["10"]?.sign || "--"}.`,
      },
      {
        key: "scores",
        ...DETAIL_META.scores,
        preview: `Career ${Math.round((scores.career || 0) * 10)}% · Love ${Math.round((scores.love || 0) * 10)}% · Finance ${Math.round((scores.finance || 0) * 10)}%.`,
      },
    ],
    [horoscopeSummary, houses, insights, lagnaLabel, moonSignLabel, planets, scores, sunSignLabel],
  );

  const activeMeta = sections.find((item) => item.key === activeSection) || sections[0];

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="tara-heading text-3xl sm:text-4xl">Your reading</h2>
          <p className="text-xs text-[color:var(--tara-text-secondary)]">
            A simpler view of your chart. Tap a card to open the detail that matters.
          </p>
        </div>
        <Button type="button" fullWidth={false} loading={refreshing} onClick={() => loadDashboard({ silent: true })} variant="ghost">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </span>
        </Button>
      </header>

      {loading ? <Loader text="Reading your chart..." /> : null}
      {loading ? <DashboardSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-card-gradient p-5 shadow-card-mystic"
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--tara-gold)]">Chart at a glance</p>
            <h3 className="mt-3 text-2xl font-semibold text-[color:var(--tara-text-primary)]">
              {lagnaLabel || "Unknown"} Lagna
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--tara-text-secondary)]">
              Moon in {moonSignLabel || "--"} · Sun in {sunSignLabel || "--"}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">1st house</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--tara-text-primary)]">{houses?.["1"]?.sign || "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">7th house</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--tara-text-primary)]">{houses?.["7"]?.sign || "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">10th house</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--tara-text-primary)]">{houses?.["10"]?.sign || "--"}</p>
              </div>
            </div>
          </motion.section>

          <section className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--tara-gold)]">Explore your chart</p>
              <p className="mt-1 text-sm text-[color:var(--tara-text-secondary)]">
                Open one section at a time so the reading stays clear and easy to scan.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map((section) => (
                <ExploreCard
                  key={section.key}
                  section={section}
                  active={section.key === activeSection}
                  onClick={() => setActiveSection(section.key)}
                />
              ))}
            </div>
          </section>

          <AnimatePresence mode="wait">
            <motion.section
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-black/20"
            >
              <DetailPanelHeader
                title={activeMeta.title}
                label={activeMeta.label}
                description={activeMeta.preview}
              />

              {renderDetailContent({
                activeSection,
                kundali,
                horoscope: horoscopeSummary,
                houses,
                planets,
                insights,
                scores,
                lagnaLabel,
                moonSignLabel,
                sunSignLabel,
              })}

              {updatedAtLabel ? (
                <p className="mt-4 text-[11px] text-[color:var(--tara-text-secondary)]">Last regenerated: {updatedAtLabel}</p>
              ) : null}
            </motion.section>
          </AnimatePresence>
        </>
      ) : null}
    </section>
  );
}
