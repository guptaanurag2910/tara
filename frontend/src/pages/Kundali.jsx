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
    <main className="tara-page-shell tara-scene-shell px-5 pb-28 pt-8">
      <motion.header
        className="tara-scene-hero tara-screen-intro tara-scene-motif"
        data-scene="night"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="tara-scene-safe-center">
        <p className="tara-kicker">Astrology module</p>
        <h1 className="tara-type-hero mt-2">
          Your <span className="text-aurora italic">Kundali</span>
        </h1>
        <p className="tara-copy mt-3 text-sm">
          A calmer reading view with your chart, daily guidance, and all the deeper details one tap away.
        </p>
        </div>
      </motion.header>

      <section className="mt-5 space-y-3">
        <div className="tara-screen-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="tara-kicker">Birth details</p>
              <h2 className="mt-2 text-lg font-semibold text-[color:var(--tara-text-primary)]">Keep this tucked away until you need to edit it</h2>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--tara-text-secondary)]">
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
          <p className="tara-alert tara-alert-success mt-3">
            {saveMessage}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <KundaliDashboard
          reloadSignal={reloadSignal}
          onOpenBirthEditor={() => setShowEditor(true)}
        />
      </section>
    </main>
  );
}
