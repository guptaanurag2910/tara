import { useMemo, useRef, useState } from "react";

function parseTimeValue(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return {
      hour12: 12,
      minute: 0,
      period: "AM",
      isSet: false,
    };
  }

  const hour24 = Math.max(0, Math.min(23, Number(match[1])));
  const minute = Math.max(0, Math.min(59, Number(match[2])));
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return {
    hour12,
    minute,
    period,
    isSet: true,
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function to24h(hour12, minute, period) {
  const hour = Number(hour12) % 12;
  const hour24 = period === "PM" ? hour + 12 : hour;
  return `${pad(hour24)}:${pad(minute)}`;
}

function markerPosition(angle, radius, center) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  };
}

export default function BirthTimeClock({
  label = "Time of Birth",
  value = "",
  onChange,
  showManualInput = true,
  manualInputId = "birth-time-manual",
}) {
  const [mode, setMode] = useState("hour");
  const dialRef = useRef(null);
  const draggingRef = useRef(false);

  const parsed = useMemo(() => parseTimeValue(value), [value]);
  const hour12 = parsed.hour12;
  const minute = parsed.minute;
  const period = parsed.period;

  const handAngle = mode === "hour" ? (hour12 % 12) * 30 : minute * 6;
  const handLength = mode === "hour" ? 62 : 84;

  const setTime = (partial) => {
    const nextHour12 = partial.hour12 ?? hour12;
    const nextMinute = partial.minute ?? minute;
    const nextPeriod = partial.period ?? period;
    const next = to24h(nextHour12, nextMinute, nextPeriod);
    onChange?.(next);
  };

  const readFromPointer = (clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const normalized = (angle + 90 + 360) % 360;

    if (mode === "hour") {
      const hourIndex = Math.round(normalized / 30) % 12;
      const nextHour = hourIndex === 0 ? 12 : hourIndex;
      setTime({ hour12: nextHour });
    } else {
      const nextMinute = Math.round(normalized / 6) % 60;
      setTime({ minute: nextMinute });
    }
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    readFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event) => {
    if (!draggingRef.current) return;
    readFromPointer(event.clientX, event.clientY);
  };

  const onPointerUp = (event) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const markers = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const angle = index * 30;
        const labelValue = mode === "hour" ? String(index === 0 ? 12 : index) : pad(index * 5);
        const markerValue = mode === "hour" ? (index === 0 ? 12 : index) : index * 5;
        const active = mode === "hour" ? markerValue === hour12 : Math.round(minute / 5) * 5 % 60 === markerValue;
        return {
          index,
          angle,
          label: labelValue,
          value: markerValue,
          active,
        };
      }),
    [hour12, minute, mode],
  );

  return (
    <div className="rounded-3xl border border-[color:var(--tara-card-border)] bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium tara-copy">{label}</span>
        <button
          type="button"
          onClick={() => onChange?.("")}
          className="rounded-full border border-[color:var(--tara-card-border)] px-3 py-1 text-[11px] text-[color:var(--tara-text-secondary)]"
        >
          Clear
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("hour")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "hour" ? "bg-aurora text-white" : "border border-[color:var(--tara-card-border)] text-[color:var(--tara-text-secondary)]"}`}
        >
          Hour
        </button>
        <button
          type="button"
          onClick={() => setMode("minute")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "minute" ? "bg-aurora text-white" : "border border-[color:var(--tara-card-border)] text-[color:var(--tara-text-secondary)]"}`}
        >
          Minute
        </button>
        <div className="ml-auto flex items-center rounded-full border border-[color:var(--tara-card-border)] p-0.5">
          <button
            type="button"
            onClick={() => setTime({ period: "AM" })}
            className={`rounded-full px-2.5 py-1 text-[11px] ${period === "AM" ? "bg-aurora text-white" : "text-[color:var(--tara-text-secondary)]"}`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => setTime({ period: "PM" })}
            className={`rounded-full px-2.5 py-1 text-[11px] ${period === "PM" ? "bg-aurora text-white" : "text-[color:var(--tara-text-secondary)]"}`}
          >
            PM
          </button>
        </div>
      </div>

      <div
        ref={dialRef}
        className="relative mx-auto h-[232px] w-[232px] touch-none select-none rounded-full border border-[color:var(--tara-card-border)] bg-[color:var(--tara-input-bg)]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="absolute inset-[18px] rounded-full border border-white/10" />
        {markers.map((marker) => {
          const pos = markerPosition(marker.angle, 92, 116);
          return (
            <button
              key={marker.index}
              type="button"
              onClick={() => {
                if (mode === "hour") {
                  setTime({ hour12: marker.value });
                } else {
                  setTime({ minute: marker.value });
                }
              }}
              className={`absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full text-xs font-medium ${
                marker.active
                  ? "bg-aurora text-white shadow-glow"
                  : "bg-transparent text-[color:var(--tara-text-secondary)]"
              }`}
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
              {marker.label}
            </button>
          );
        })}

        <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute left-1/2 top-1/2 w-[2px] -translate-x-1/2 rounded-full bg-[color:var(--tara-gold)]"
            style={{
              height: `${handLength}px`,
              transform: `translate(-50%, -${handLength}px) rotate(${handAngle}deg)`,
              transformOrigin: "50% 100%",
            }}
          />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-[color:var(--tara-gold)]" />
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="font-serif text-3xl text-[color:var(--tara-text-primary)]">
          {parsed.isSet ? `${pad(hour12)}:${pad(minute)} ${period}` : "--:--"}
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--tara-text-secondary)]">
          {parsed.isSet ? `24h: ${value}` : "Time not set yet"}
        </p>
      </div>

      {showManualInput ? (
        <div className="mt-3">
          <label htmlFor={manualInputId} className="mb-1.5 block text-xs font-medium text-[color:var(--tara-text-secondary)]">
            Fine tune manually
          </label>
          <input
            id={manualInputId}
            type="time"
            className="tara-input"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
