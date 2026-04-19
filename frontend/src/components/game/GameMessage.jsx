import { useEffect, useState } from "react";

function formatTime(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GameMessage({ gameName = "This or That", timestamp }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex justify-center px-3 py-1">
      <div
        className={`w-full max-w-[92%] rounded-2xl border border-amber-300/35 bg-amber-500/15 p-3 text-center shadow-md shadow-black/20 transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">Game Started</p>
        <p className="mt-1 text-sm font-semibold text-amber-50">{`Started ${gameName} 🎮`}</p>
        {timestamp ? <p className="mt-1 text-[10px] text-amber-100/80">{formatTime(timestamp)}</p> : null}
      </div>
    </div>
  );
}
