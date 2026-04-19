import { useState } from "react";
import { motion } from "framer-motion";

import BirthDetailsForm from "../components/BirthDetailsForm";
import KundaliDashboard from "../components/KundaliDashboard";

export default function KundaliPage() {
  const [reloadSignal, setReloadSignal] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");

  const handleSaved = () => {
    setSaveMessage("Birth details saved. Regenerating kundali now.");
    setReloadSignal((value) => value + 1);
  };

  return (
    <main className="tara-container px-5 pb-28 pt-8">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Astrology module</p>
        <h1 className="tara-heading mt-2 text-6xl">
          Your <span className="text-aurora italic">Kundali</span>
        </h1>
        <p className="mt-2 text-sm text-[color:var(--tara-text-secondary)]">
          Enter your birth details once, then track chart insights and daily transits in one place.
        </p>
      </motion.header>

      <section className="mt-5">
        <BirthDetailsForm onSaved={handleSaved} />
        {saveMessage ? (
          <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {saveMessage}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <KundaliDashboard reloadSignal={reloadSignal} />
      </section>
    </main>
  );
}

