import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Sparkles, X } from "lucide-react";

function initials(name) {
  if (!name) {
    return "T";
  }
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "T";
}

function ProfileOrb({ photo, name, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.25 }}
      className="relative"
    >
      <div className="absolute inset-0 rounded-full bg-[color:var(--tara-violet)] opacity-50 blur-xl" />
      <div className="relative h-28 w-28 overflow-hidden rounded-full ring-2 ring-[color:var(--tara-gold)]/70 ring-offset-4 ring-offset-black/20">
        {photo ? (
          <img src={photo} alt={name || "match"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-400/75 to-amber-400/70 text-2xl font-semibold text-white">
            {initials(name)}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ScoreCard({ label, value, accent = "gold" }) {
  return (
    <div className="glass-strong rounded-2xl px-4 py-4 text-left">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--tara-text-faint)]">{label}</p>
      <p className={`mt-1 font-[var(--font-serif)] text-3xl ${accent === "gold" ? "text-gold-gradient" : "text-aurora"}`}>
        {value}
      </p>
    </div>
  );
}

export default function MatchPopup({ open, selfUser, matchedUser, breakdown, onClose }) {
  const compatibility = Number(breakdown?.compatibility ?? 0);
  const kundali = Number(breakdown?.kundali ?? 0);
  const personality = Number(breakdown?.personality ?? 0);
  const insight = breakdown?.insight || "Your moons align — emotional rhythms in deep harmony.";
  const matchId = breakdown?.matchId;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 px-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-cosmic opacity-95" />
          <div className="star-field pointer-events-none absolute inset-0 opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow blur-3xl" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full glass"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>

          <motion.div
            className="relative w-full max-w-sm text-center"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
          >
            <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--tara-gold)]">A cosmic match</p>
            <h1 className="mt-3 font-[var(--font-serif)] text-6xl leading-none">
              <span className="text-aurora italic">It&apos;s written</span>
            </h1>

            <div className="mt-10 flex items-center justify-center">
              <ProfileOrb photo={selfUser?.photo} name={selfUser?.name} />
              <div className="-mx-3 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-aurora shadow-glow">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <ProfileOrb photo={matchedUser?.photo} name={matchedUser?.name} delay={0.08} />
            </div>

            <p className="mt-8 font-[var(--font-serif)] text-4xl text-[color:var(--tara-text-primary)]">
              You & <span className="text-gold-gradient">{matchedUser?.name || "your match"}</span>
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <ScoreCard label="Kundali" value={`${kundali}/36`} accent="gold" />
              <ScoreCard label="Personality" value={`${personality}%`} accent="purple" />
            </div>

            <p className="mt-6 font-[var(--font-serif)] text-lg italic leading-snug text-[color:var(--tara-text-primary)]">
              &quot;{insight}&quot;
            </p>

            <div className="mt-8 space-y-3">
              <Link
                to={matchId ? `/chat/${matchId}` : "/chat"}
                onClick={onClose}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-aurora text-base font-semibold text-white shadow-glow"
              >
                <MessageCircle className="h-4 w-4" />
                Start the conversation
              </Link>
              <button
                onClick={onClose}
                className="flex h-12 w-full items-center justify-center rounded-full text-sm font-medium text-[color:var(--tara-text-secondary)]"
                type="button"
              >
                Keep swiping
              </button>
              <p className="text-xs text-[color:var(--tara-gold)]">Compatibility {compatibility}%</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
