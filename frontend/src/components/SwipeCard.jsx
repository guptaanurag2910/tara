import { forwardRef, useImperativeHandle, useMemo } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";

const SWIPE_THRESHOLD = 110;

function normalizeInsight(text) {
  if (!text) {
    return "Your moons align - emotional rhythms in deep harmony.";
  }
  const sentence = text.split(/[.!?]/)[0]?.trim();
  const preview = sentence || text;
  return preview.length > 68 ? `${preview.slice(0, 65)}...` : preview;
}

function label(value) {
  return String(value || "Scorpio")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SwipeCard({ profile, onSwiped, disabled = false }, ref) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-16, 0, 16]);

  const insight = useMemo(() => normalizeInsight(profile?.insight), [profile?.insight]);
  const zodiac = useMemo(
    () => label(profile?.moon_sign || profile?.kundali?.moon_sign || "Scorpio"),
    [profile?.kundali?.moon_sign, profile?.moon_sign],
  );

  const settle = async () => {
    await controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      transition: { type: "spring", stiffness: 320, damping: 28 },
    });
  };

  const flyAway = async (direction) => {
    const width = typeof window !== "undefined" ? window.innerWidth : 420;
    const targetX = direction === "right" ? width + 180 : -(width + 180);
    await controls.start({
      x: targetX,
      rotate: direction === "right" ? 24 : -24,
      opacity: 0,
      transition: { duration: 0.22, ease: "easeOut" },
    });
    onSwiped?.(direction);
  };

  useImperativeHandle(ref, () => ({
    swipeLeft: () => flyAway("left"),
    swipeRight: () => flyAway("right"),
  }));

  return (
    <motion.article
      animate={controls}
      className="relative h-[68vh] max-h-[640px] w-full overflow-hidden rounded-[2.05rem] border border-[color:var(--tara-card-border)] bg-[color:var(--tara-card-bg-strong)] shadow-[0_26px_80px_rgba(0,0,0,0.5)]"
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={async (_, info) => {
        if (disabled) {
          return;
        }
        if (info.offset.x > SWIPE_THRESHOLD) {
          await flyAway("right");
          return;
        }
        if (info.offset.x < -SWIPE_THRESHOLD) {
          await flyAway("left");
          return;
        }
        await settle();
      }}
      style={{ x, rotate }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="absolute inset-0">
        {profile?.user?.photo ? (
          <img alt={profile.user.name} className="h-full w-full object-cover" src={profile.user.photo} />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--tara-color-warning)_80%,transparent)_0%,color-mix(in_srgb,var(--tara-color-destructive)_72%,transparent)_35%,color-mix(in_srgb,var(--tara-violet)_76%,transparent)_100%)]" />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--tara-bg-surface)] via-transparent to-transparent" />

      <motion.div className="absolute left-4 top-4 flex items-center rounded-full border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg-strong)_90%,transparent)] px-3 py-2 backdrop-blur-md">
        <span className="mr-2 inline-flex h-8 w-8 rounded-full bg-[conic-gradient(from_210deg,#9a86ff_0deg_250deg,#e5bf72_250deg_360deg)] p-[3px]">
          <span className="h-full w-full rounded-full bg-[color:var(--tara-bg-surface)]" />
        </span>
        <span className="text-left text-[10px] uppercase tracking-[0.16em] text-[color:var(--tara-text-secondary)]">
          Match
          <span className="block text-[11px] normal-case tracking-normal text-[color:var(--tara-gold)]">{profile?.compatibility_score ?? 0}%</span>
        </span>
      </motion.div>
      <motion.span className="absolute right-4 top-4 rounded-full border border-[color:var(--tara-card-border)] bg-[color:color-mix(in_srgb,var(--tara-card-bg-strong)_88%,transparent)] px-4 py-2 text-[13px] font-medium text-[color:var(--tara-text-primary)] backdrop-blur-md">
        ✧ {zodiac}
      </motion.span>

      <div className="absolute inset-x-0 bottom-0 p-6 pb-7">
        <h2 className="tara-heading text-[2.5rem] font-semibold tracking-tight text-white">
          {profile?.user?.name ?? "Unknown"}
          <span className="ml-2 text-[2.1rem] font-medium text-white/80">{profile?.age ?? "--"}</span>
        </h2>
        <div className="mt-4 rounded-[1.75rem] border border-white/12 bg-[color:color-mix(in_srgb,var(--tara-card-bg-strong)_76%,transparent)] px-5 py-4 backdrop-blur-md">
          <p className="tara-heading text-[13px] italic font-normal leading-relaxed text-white/90">✧ "{insight}"</p>
        </div>
      </div>
    </motion.article>
  );
}

export default forwardRef(SwipeCard);
