import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
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
      className="match-popup-avatar"
    >
      {photo ? <img src={photo} alt={name || "Match"} /> : <span>{initials(name)}</span>}
    </motion.div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className="match-popup-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MatchPopup({ open, selfUser, matchedUser, breakdown, onClose }) {
  const compatibility = breakdown?.compatibility;
  const kundali = breakdown?.kundali;
  const personality = breakdown?.personality;
  const insight = String(breakdown?.insight || "").trim();
  const matchId = breakdown?.matchId;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="match-popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            aria-labelledby="match-popup-title"
            aria-modal="true"
            className="match-popup-panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <button aria-label="Close match popup" className="match-popup-close" onClick={onClose} type="button"><X size={19} /></button>
            <p className="match-popup-eyebrow">A NEW CONNECTION</p>
            <h2 id="match-popup-title">It&apos;s a match!</h2>
            <p className="match-popup-subtitle">You both liked each other.</p>

            <div className="match-popup-avatars">
              <ProfileOrb photo={selfUser?.photo} name={selfUser?.name} />
              <div className="match-popup-connection">
                <Sparkles size={21} />
              </div>
              <ProfileOrb photo={matchedUser?.photo} name={matchedUser?.name} delay={0.08} />
            </div>

            <p className="match-popup-name">You and {matchedUser?.name || "your match"}</p>
            {compatibility !== null && compatibility !== undefined ? <p className="match-popup-compatibility">{compatibility}% compatible</p> : null}

            {kundali !== null && kundali !== undefined || personality !== null && personality !== undefined ? <div className="match-popup-stats">
              {kundali !== null && kundali !== undefined ? <ScoreCard label="Kundali" value={`${kundali}/36`} /> : null}
              {personality !== null && personality !== undefined ? <ScoreCard label="Personality" value={`${personality}%`} /> : null}
            </div> : null}

            {insight ? <p className="match-popup-insight">{insight}</p> : null}

            <div className="match-popup-actions">
              <Link
                to={matchId ? `/chat/${matchId}` : "/chat"}
                onClick={onClose}
                className="match-popup-chat"
              >
                <MessageCircle size={18} />
                Start the conversation
              </Link>
              <button
                onClick={onClose}
                className="match-popup-dismiss"
                type="button"
              >
                Keep swiping
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
