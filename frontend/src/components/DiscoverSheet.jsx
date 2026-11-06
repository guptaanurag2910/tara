import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function DiscoverSheet({ title, label, closeLabel, onClose, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const focusable = [...panelRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="discover-sheet-backdrop" onClick={onClose}>
      <section aria-label={label || title} aria-modal="true" className="discover-sheet" onClick={(event) => event.stopPropagation()} ref={panelRef} role="dialog">
        <div className="discover-sheet-handle" aria-hidden="true" />
        <header className="discover-sheet-header"><h2>{title}</h2><button aria-label={closeLabel || `Close ${label || title}`} onClick={onClose} ref={closeRef} type="button"><X size={19} /></button></header>
        <div className="discover-sheet-content">{children}</div>
      </section>
    </div>
  );
}
