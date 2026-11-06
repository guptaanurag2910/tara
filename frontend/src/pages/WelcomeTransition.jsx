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
    <main className="tara-container tara-onboarding onboarding-welcome">
      <header className="onboarding-header">
        <div className="onboarding-header-row">
          <button aria-label="Back" className="tara-back-btn" onClick={() => navigate(-1)} type="button">
            ←
          </button>
          <span className="onboarding-brand">tara<span className="onboarding-brand-dot">.</span></span>
        </div>
        <div className="tara-progress-track">
          <div className="tara-progress-fill h-full" style={{ width: "24%" }} />
        </div>
      </header>

      <section className="onboarding-welcome-content onboarding-step-enter">
        <div className="onboarding-welcome-mark">
          <span>✧</span>
        </div>

        <p className="tara-kicker mt-8">A few questions</p>
        <h1 className="tara-heading mt-3 text-[3.35rem] leading-[1.02]">
          Let&apos;s read{" "}
          <span className="onboarding-accent-text">
            your stars
          </span>
        </h1>
        <p className="tara-copy mt-3 max-w-[312px] text-[15px] leading-6">
          Takes about 2 minutes. Your answers shape every match you see.
        </p>
      </section>

      <div className="onboarding-actions">
        <button className="tara-primary-btn w-full" onClick={() => navigate(nextPath, { replace: true })} type="button">
          Begin →
        </button>
      </div>
    </main>
  );
}
