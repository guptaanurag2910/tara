import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PencilLine, Sparkles } from "lucide-react";

import BirthDetailsForm from "../components/BirthDetailsForm";
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

  const openBirthEditor = () => {
    setShowEditor(true);
    requestAnimationFrame(() => document.getElementById("kundali-birth-details")?.scrollIntoView({ block: "start" }));
  };

  return (
    <main className="tara-kundali tara-container">
      <motion.header className="kundali-page-header" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="kundali-brand">tara<span>.</span></div>
        <p className="kundali-eyebrow">YOUR COSMIC PROFILE</p>
        <h1>Your Kundali</h1>
        <p>Your chart, one layer at a time.</p>
      </motion.header>

      <section className="kundali-reading-section">
        <KundaliDashboard onEditBirthDetails={openBirthEditor} reloadSignal={reloadSignal} />
      </section>

      <section className="kundali-birth-section" id="kundali-birth-details">
        <div className="kundali-birth-card">
          <span className="kundali-birth-icon"><Sparkles size={20} /></span>
          <div className="kundali-birth-copy">
            <h2>Birth Details</h2>
            <p>Keep your chart accurate.</p>
          </div>
          <button aria-expanded={showEditor} onClick={() => setShowEditor((value) => !value)} type="button">
            <PencilLine size={15} /> {showEditor ? "Close" : "Edit details"}
          </button>
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
          <p className="kundali-save-message" role="status">
            {saveMessage}
          </p>
        ) : null}
      </section>

    </main>
  );
}
