import { Link } from "react-router-dom";
import { Heart, Moon, Sparkles } from "lucide-react";

import Logo from "../components/tara/Logo";

export default function Landing() {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-cosmic">
      <div className="star-field pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-glow blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 pb-10 pt-12">
        <div className="flex justify-center animate-fade-in">
          <Logo size={44} />
        </div>

        <div className="mt-16 flex flex-1 flex-col items-center text-center">
          <div className="relative mb-10">
            <div className="absolute inset-0 rounded-full bg-[color:var(--tara-violet)] opacity-40 blur-3xl" />
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full glass-strong">
              <div className="absolute inset-3 rounded-full border border-[color:var(--tara-gold)]/30" />
              <div className="absolute inset-6 rounded-full border border-[color:var(--tara-violet)]/30 animate-pulse" />
              <Sparkles className="h-12 w-12 text-[color:var(--tara-gold)]" strokeWidth={1.4} />
            </div>
          </div>

          <h1 className="tara-heading text-6xl leading-[1.02] tracking-tight">
            Love written
            <br />
            <span className="text-aurora italic">in the stars</span>
          </h1>
          <p className="mt-5 max-w-xs text-base leading-relaxed text-[color:var(--tara-text-secondary)]">
            Match through kundali, personality, and the kind of conversation that lingers.
          </p>

          <div className="mt-10 grid w-full grid-cols-3 gap-3">
            {[
              { Icon: Moon, label: "Kundali" },
              { Icon: Sparkles, label: "Vibe" },
              { Icon: Heart, label: "Chemistry" },
            ].map(({ Icon, label }) => (
              <div key={label} className="glass flex flex-col items-center gap-2 rounded-2xl px-3 py-4">
                <Icon className="h-5 w-5 text-[color:var(--tara-gold)]" strokeWidth={1.7} />
                <span className="text-xs font-medium text-[color:var(--tara-text-secondary)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Link
            to="/auth?mode=signup"
            className="flex h-14 w-full items-center justify-center rounded-full bg-aurora text-base font-semibold text-white shadow-glow transition-transform active:scale-[0.98]"
          >
            Begin your journey
          </Link>
          <Link
            to="/auth?mode=login"
            className="flex h-14 w-full items-center justify-center rounded-full glass text-base font-medium text-[color:var(--tara-text-primary)] transition-transform active:scale-[0.98]"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </div>
  );
}
