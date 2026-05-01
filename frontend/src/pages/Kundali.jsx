import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PencilLine } from "lucide-react";

import BirthDetailsForm from "../components/BirthDetailsForm";
import Button from "../components/Button";
import KundaliDashboard from "../components/KundaliDashboard";

export default function KundaliPage() {
  const [reloadSignal, setReloadSignal] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const handleSaved = () => {
    setSaveMessage("Birth details saved. Regenerating kundali now.");
    setReloadSignal((value) => value + 1);
    setShowEditor(false);
  };

  return (
    <main className="tara-container px-5 pb-28 pt-8">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--tara-gold)]">Astrology module</p>
        <h1 className="tara-heading mt-2 text-5xl sm:text-6xl">
          Your <span className="text-aurora italic">Kundali</span>
        </h1>
        <p className="mt-2 text-sm text-[color:var(--tara-text-secondary)]">
          A calmer reading view with your chart, daily guidance, and all the deeper details one tap away.
        </p>
      </motion.header>

      <section className="mt-5 space-y-3">
        <div className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--tara-gold)]">Birth details</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Keep this tucked away until you need to edit it</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Your date, time, and place of birth are still here. We have simply moved the form behind one action so
                the tab feels like a reading screen first.
              </p>
            </div>
            <Button type="button" fullWidth={false} variant="ghost" onClick={() => setShowEditor((value) => !value)}>
              <span className="inline-flex items-center gap-1.5">
                <PencilLine className="h-3.5 w-3.5" />
                {showEditor ? "Hide editor" : "Edit details"}
              </span>
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showEditor ? (
            <motion.div
              key="birth-editor"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <BirthDetailsForm onSaved={handleSaved} />
            </motion.div>
          ) : null}
        </AnimatePresence>

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
