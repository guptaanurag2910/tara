import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { fetchDailyHoroscope, fetchKundali } from "../services/astrologyService";
import Button from "./Button";
import ChartDataPanel from "./ChartDataPanel";
import HoroscopePanel from "./HoroscopePanel";
import InsightsPanel from "./InsightsPanel";
import KundaliChart from "./KundaliChart";
import LifeDashboard from "./LifeDashboard";
import Loader from "./Loader";

function readableLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      planets: Array.isArray(source.planets) ? source.planets : [],
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
    next[String(key)] = {
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
    return {};
  }
  return {
    personality: String(raw.personality || ""),
    career: String(raw.career || ""),
    emotions: String(raw.emotions || ""),
    relationships: String(raw.relationships || ""),
    wellbeing: String(raw.wellbeing || ""),
    growth: String(raw.growth || ""),
  };
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

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[380px] animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
        <div className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
      <div className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
    </div>
  );
}

export default function KundaliDashboard({ reloadSignal = 0 }) {
  const [kundali, setKundali] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [horoscopeError, setHoroscopeError] = useState("");
  const [horoscopeLoading, setHoroscopeLoading] = useState(false);

  const loadDashboard = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    setHoroscopeError("");
    try {
      const kundaliPayload = await fetchKundali();
      setKundali(kundaliPayload || null);

      setHoroscopeLoading(true);
      try {
        const horoscopePayload = await fetchDailyHoroscope();
        setHoroscope(horoscopePayload || null);
      } catch (apiError) {
        setHoroscope(null);
        setHoroscopeError(apiError?.message || "Could not load daily horoscope.");
      } finally {
        setHoroscopeLoading(false);
      }
    } catch (apiError) {
      setKundali(null);
      setHoroscope(null);
      if (apiError?.status === 404) {
        setError("Kundali is not generated yet. Save your birth details to generate your chart.");
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
  const lagnaLabel = readableLabel(kundali?.lagna || "");
  const moonSignLabel = readableLabel(kundali?.moon_sign || "");
  const sunSignLabel = readableLabel(kundali?.sun_sign || "");

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="tara-heading text-4xl">Kundali Dashboard</h2>
          <p className="text-xs text-[color:var(--tara-text-secondary)]">
            Personalized chart, life insights, and daily transit guidance
          </p>
        </div>
        <Button
          type="button"
          fullWidth={false}
          loading={refreshing}
          onClick={() => loadDashboard({ silent: true })}
          variant="ghost"
        >
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </span>
        </Button>
      </header>

      {loading ? <Loader text="Generating your cosmic dashboard..." /> : null}
      {loading ? <DashboardSkeleton /> : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-100">{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <HoroscopePanel
            horoscope={horoscope}
            loading={horoscopeLoading}
            error={horoscopeError}
            moonSign={moonSignLabel}
          />

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-3xl bg-card-gradient p-5 shadow-card-mystic"
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-[color:var(--tara-text-secondary)]">
                Lagna: <span className="text-[color:var(--tara-text-primary)]">{lagnaLabel || "—"}</span>
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-[color:var(--tara-text-secondary)]">
                Moon: <span className="text-[color:var(--tara-text-primary)]">{moonSignLabel || "—"}</span>
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-[color:var(--tara-text-secondary)]">
                Sun: <span className="text-[color:var(--tara-text-primary)]">{sunSignLabel || "—"}</span>
              </span>
            </div>
            <KundaliChart houses={houses} planets={planets} />
          </motion.section>

          <ChartDataPanel houses={houses} planets={planets} />

          <div className="grid gap-4 sm:grid-cols-2">
            <InsightsPanel insights={insights} />
            <LifeDashboard scores={scores} />
          </div>
        </>
      ) : null}
    </section>
  );
}
