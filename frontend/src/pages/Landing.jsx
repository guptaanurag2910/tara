import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import ZodiacLandingWheel from "../components/ZodiacLandingWheel";

export default function Landing() {
  return (
    <main className="tara-container tara-onboarding tara-entry tara-landing">
      <section className="landing-hero animate-fade-up" aria-labelledby="landing-title">
        <ZodiacLandingWheel />
        <span className="landing-wordmark">tara<span>.</span></span>
        <h1 id="landing-title" className="landing-tagline">Some connections feel written in the stars.</h1>
        <span className="landing-accent" aria-hidden="true" />
      </section>

      <div className="entry-actions landing-actions">
        <Link className="entry-primary" to="/auth?mode=signup">Create an account <ArrowRight size={19} aria-hidden="true" /></Link>
        <p className="entry-switch">Already have an account? <Link to="/auth?mode=login">Log in</Link></p>
      </div>
    </main>
  );
}
