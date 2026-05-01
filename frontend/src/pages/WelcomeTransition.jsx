import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { isOnboardingComplete } from "../services/onboardingStorage";

export default function WelcomeTransition() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const nextPath = isOnboardingComplete(user?.id) ? "/discover" : "/onboarding";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(nextPath, { replace: true });
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [navigate, nextPath]);

  return (
    <main className="tara-container flex min-h-[100dvh] flex-col px-6 pb-8 pt-10">
      <header className="mb-16 flex items-center gap-4">
        <button aria-label="Back" className="tara-back-btn" onClick={() => navigate(-1)} type="button">
          ←
        </button>
        <div className="tara-progress-track flex-1">
          <div className="tara-progress-fill h-full" style={{ width: "24%" }} />
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-[118px] w-[118px] items-center justify-center rounded-full border border-[#2b2f66] bg-[#080a36] shadow-[0_0_0_30px_rgba(104,84,236,0.14)]">
          <span className="text-[44px] text-[color:var(--tara-gold)]">✧</span>
        </div>

        <p className="tara-kicker mt-12">A few questions</p>
        <h1 className="tara-heading mt-3 text-[3.35rem] leading-[1.02]">
          Let&apos;s read{" "}
          <span className="bg-gradient-to-r from-[#6f63f7] via-[#5f6df6] to-[#a1a4d8] bg-clip-text text-transparent">
            your stars
          </span>
        </h1>
        <p className="tara-copy mt-5 max-w-[312px] text-[15px] leading-6">
          Takes about 2 minutes. Your answers shape every match you see.
        </p>
      </section>

      <button className="tara-primary-btn mb-2 mt-10 w-full" onClick={() => navigate(nextPath, { replace: true })} type="button">
        Begin →
      </button>
    </main>
  );
}
