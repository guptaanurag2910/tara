import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Moon, Sparkles, Sun } from "lucide-react";

import Loader from "../components/Loader";
import { fetchMatchDetail } from "../services/matchingService";

function label(value, fallback = "") {
  const normalized = String(value || fallback || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function insightPreview(text) {
  const preview = String(text || "").split(/[.!?]/)[0]?.trim();
  return preview || "Your stars suggest an emotionally aligned connection.";
}

function traitsFromInsight(insight) {
  const words = insightPreview(insight).split(/\s+/).filter(Boolean);
  const base = ["Intuitive", "Grounded", "Warm", "Curious"];
  if (words.length < 4) {
    return base;
  }
  return [words[0], words[1], words[2], words[3]].map((word) => label(word.replace(/[^a-z]/gi, "")) || "Aligned");
}

function Stat({ icon, label: statLabel, value, note }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center gap-1.5 text-[color:var(--tara-gold)]">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--tara-text-faint)]">{statLabel}</span>
      </div>
      <p className="mt-1 font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-primary)]">{value}</p>
      <p className="text-[11px] text-[color:var(--tara-text-secondary)]">{note}</p>
    </div>
  );
}

function Attribute({ label: attributeLabel, value, icon }) {
  return (
    <div className="flex items-center justify-between rounded-2xl glass px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--tara-violet)]/20">{icon}</div>
        <span className="text-sm text-[color:var(--tara-text-secondary)]">{attributeLabel}</span>
      </div>
      <span className="font-[var(--font-serif)] text-xl text-[color:var(--tara-text-primary)]">{value}</span>
    </div>
  );
}

export default function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchMatchDetail(matchId);
        setDetail(data || null);
      } catch (apiError) {
        setError(apiError?.message || "Could not load this match.");
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [matchId]);

  const name = detail?.user?.name || "Match";
  const age = detail?.user?.age ? `, ${detail.user.age}` : "";
  const compatibility = Number(detail?.compatibility_score ?? 0);
  const kundaliScore = Number(detail?.kundali_score ?? 0);
  const personalityScore = Number(detail?.personality_score ?? 0);
  const insight = detail?.insight || "Your stars suggest an emotionally aligned connection.";

  const moonSign = useMemo(() => {
    const source = detail?.user?.moon_sign || detail?.moon_sign || "Pisces";
    return label(source, "Pisces");
  }, [detail?.moon_sign, detail?.user?.moon_sign]);

  const sunSign = useMemo(() => {
    const source = detail?.user?.sun_sign || detail?.sun_sign || "Scorpio";
    return label(source, "Scorpio");
  }, [detail?.sun_sign, detail?.user?.sun_sign]);

  const nakshatra = useMemo(() => {
    const source = detail?.user?.nakshatra || detail?.nakshatra || "Revati";
    return label(source, "Revati");
  }, [detail?.nakshatra, detail?.user?.nakshatra]);

  const traits = useMemo(() => traitsFromInsight(insight), [insight]);

  return (
    <main className="tara-container pb-28">
      <div className="relative h-80 w-full overflow-hidden">
        {detail?.user?.photo ? (
          <img src={detail.user.photo} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#9f9fff_0%,#4f46e5_45%,#090338_100%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#090338]" />
        <button
          onClick={() => navigate("/matches")}
          className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full glass-strong"
          type="button"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h1 className="tara-heading text-5xl text-[color:var(--tara-text-primary)]">
            {name}
            <span className="text-[color:var(--tara-text-secondary)]">{age}</span>
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full glass-strong px-3 py-1 text-xs font-medium">{sunSign} sun</span>
            <span className="rounded-full glass-strong px-3 py-1 text-xs font-medium">{moonSign} moon</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {loading ? <Loader text="Loading compatibility..." /> : null}
        {!loading && error ? (
          <p className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">{error}</p>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="rounded-3xl bg-card-gradient p-6 shadow-card-mystic">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Cosmic compatibility</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-[var(--font-serif)] text-7xl text-aurora">{compatibility}</span>
                <span className="pb-2 font-[var(--font-serif)] text-3xl text-[color:var(--tara-text-secondary)]">%</span>
              </div>
              <p className="mt-3 font-[var(--font-serif)] text-lg italic leading-snug text-[color:var(--tara-text-primary)]">
                &quot;{insightPreview(insight)}&quot;
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat icon={<Moon className="h-4 w-4" />} label="Kundali" value={`${kundaliScore}/36`} note="Strong guna match" />
              <Stat icon={<Sparkles className="h-4 w-4" />} label="Personality" value={`${personalityScore}%`} note="Compatible vibes" />
            </div>

            <section className="mt-6">
              <h2 className="mb-3 text-xs uppercase tracking-widest text-[color:var(--tara-text-faint)]">Kundali attributes</h2>
              <div className="space-y-2">
                <Attribute label="Sun sign" value={sunSign} icon={<Sun className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
                <Attribute label="Moon sign" value={moonSign} icon={<Moon className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
                <Attribute label="Nakshatra" value={nakshatra} icon={<Sparkles className="h-4 w-4 text-[color:var(--tara-gold)]" />} />
              </div>
            </section>

            <section className="mt-6">
              <h2 className="mb-3 text-xs uppercase tracking-widest text-[color:var(--tara-text-faint)]">Their vibe</h2>
              <div className="flex flex-wrap gap-2">
                {traits.map((trait) => (
                  <span key={trait} className="rounded-full glass px-4 py-2 text-xs font-medium text-[color:var(--tara-text-primary)]">
                    {trait}
                  </span>
                ))}
              </div>
            </section>

            <div className="mt-8 flex gap-3">
              <button className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full glass-strong" type="button">
                <Heart className="h-5 w-5 text-[color:var(--tara-gold)]" fill="currentColor" />
              </button>
              <Link
                to={`/chat/${matchId}`}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-aurora text-base font-semibold text-white shadow-glow"
              >
                <MessageCircle className="h-4 w-4" />
                Start chatting
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
