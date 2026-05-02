import { Link } from "react-router-dom";
import { Heart, Moon, Sparkles } from "lucide-react";

import Logo from "../components/tara/Logo";

export default function Landing() {
  return (
    <main className="tara-scene-shell tara-scene-safe tara-scene-safe-top tara-scene-safe-bottom relative mx-auto min-h-[100dvh] w-full max-w-[390px] overflow-hidden bg-cosmic">
      <div className="star-field pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-glow blur-3xl" />

      <div className="relative z-10 flex min-h-[100dvh] flex-col pb-10 pt-6">
        <div className="flex justify-center animate-fade-in">
          <Logo size={44} />
        </div>

        <div className="mt-10 flex flex-1 flex-col text-center">
          <section className="tara-scene-hero tara-screen-intro tara-scene-motif animate-fade-up flex flex-col justify-between" data-scene="night">
            <div className="tara-scene-safe-center">
              <span className="tara-chip tara-chip-gold mx-auto">Night sky connections</span>
              <div className="relative mx-auto mt-8 mb-8">
                <div className="absolute inset-0 rounded-full bg-[color:var(--tara-violet)] opacity-40 blur-3xl" />
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full glass-strong">
                  <div className="absolute inset-3 rounded-full border border-[color:var(--tara-gold)]/30" />
                  <div className="absolute inset-6 rounded-full border border-[color:var(--tara-violet)]/30 animate-pulse" />
                  <Sparkles className="h-10 w-10 text-[color:var(--tara-gold)]" strokeWidth={1.4} />
                </div>
              </div>

              <h1 className="tara-type-hero leading-[0.98]">
                Love written
                <br />
                <span className="text-aurora italic">in the stars</span>
              </h1>
              <p className="tara-copy mx-auto mt-4 max-w-[17.5rem] text-[0.98rem]">
                Match through kundali, personality, and the kind of conversation that lingers after midnight.
              </p>
            </div>
          </section>

          <div className="mt-5 grid w-full grid-cols-3 gap-3">
            {[
              { Icon: Moon, label: "Kundali" },
              { Icon: Sparkles, label: "Vibe" },
              { Icon: Heart, label: "Chemistry" },
            ].map(({ Icon, label }) => (
              <div key={label} className="tara-card flex flex-col items-center gap-2 rounded-[1.4rem] px-3 py-4">
                <Icon className="h-5 w-5 text-[color:var(--tara-gold)]" strokeWidth={1.7} />
                <span className="text-xs font-medium text-[color:var(--tara-text-secondary)]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Link
            to="/auth?mode=signup"
            className="tara-primary-btn flex h-14 w-full items-center justify-center text-base text-white"
          >
            Begin your journey
          </Link>
          <Link
            to="/auth?mode=login"
            className="tara-secondary-btn flex h-14 w-full items-center justify-center text-base font-medium"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
