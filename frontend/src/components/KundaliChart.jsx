import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

const ZODIAC = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const PLANET_ORDER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
const PLANET_SHORT = { sun: "Su", moon: "Mo", mars: "Ma", mercury: "Me", jupiter: "Ju", venus: "Ve", saturn: "Sa", rahu: "Ra", ketu: "Ke" };
const REGIONS = [
  { number: 1, points: "160,160 80,80 160,0 240,80", x: 160, y: 78 },
  { number: 2, points: "0,0 160,0 80,80", x: 80, y: 34 },
  { number: 3, points: "0,0 80,80 0,160", x: 36, y: 80 },
  { number: 4, points: "160,160 80,240 0,160 80,80", x: 80, y: 160 },
  { number: 5, points: "0,160 80,240 0,320", x: 36, y: 240 },
  { number: 6, points: "0,320 80,240 160,320", x: 80, y: 286 },
  { number: 7, points: "160,160 240,240 160,320 80,240", x: 160, y: 242 },
  { number: 8, points: "160,320 240,240 320,320", x: 240, y: 286 },
  { number: 9, points: "320,320 240,240 320,160", x: 284, y: 240 },
  { number: 10, points: "160,160 240,80 320,160 240,240", x: 240, y: 160 },
  { number: 11, points: "320,160 240,80 320,0", x: 284, y: 80 },
  { number: 12, points: "320,0 160,0 240,80", x: 240, y: 34 },
];

function readable(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function positionText(position) {
  const degree = Number(position?.degree_in_sign);
  return Number.isFinite(degree) && position?.degree_in_sign != null
    ? `${degree.toFixed(2)}° in ${readable(position.sign)}`
    : readable(position?.sign) || "Position unavailable";
}

function chartHouses(view, baseSign, houses, planets) {
  const start = ZODIAC.indexOf(baseSign);
  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const original = houses[String(number)] || houses[number] || {};
    const sign = view === "lagna" ? readable(original.sign) : start < 0 ? "" : ZODIAC[(start + index) % 12];
    const names = view === "lagna"
      ? (Array.isArray(original.planets) ? original.planets : [])
      : Object.entries(planets).filter(([, position]) => readable(position?.sign) === sign).map(([name]) => name);
    return { number, sign, names };
  });
}

function ChartDiagram({ houseList, selectedHouse, onSelect, label }) {
  return (
    <div className="kundali-diagram-wrap">
      <svg aria-label={`${label} chart, North Indian layout`} className="kundali-diagram" role="group" viewBox="0 0 320 320">
        {REGIONS.map(({ number, points, x, y }) => {
          const house = houseList[number - 1];
          const abbreviations = house.names.map((name) => PLANET_SHORT[String(name).toLowerCase()] || String(name).slice(0, 2));
          const lines = [abbreviations.slice(0, 2).join("  "), abbreviations.slice(2, 4).join("  ")];
          if (abbreviations.length > 4) lines[1] = `${lines[1]} +${abbreviations.length - 4}`;
          return (
            <g
              aria-label={`House ${number}, ${house.sign || "sign unavailable"}, ${house.names.length} planets`}
              aria-pressed={selectedHouse === number}
              className={`kundali-diagram-region ${selectedHouse === number ? "is-selected" : ""}`}
              key={number}
              onClick={() => onSelect(number)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(number);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <polygon points={points} />
              <text className="kundali-diagram-sign" textAnchor="middle" x={x} y={y - 7}>{ZODIAC.indexOf(house.sign) + 1 || "–"}</text>
              {lines.map((line, lineIndex) => line ? <text className="kundali-diagram-planets" key={lineIndex} textAnchor="middle" x={x} y={y + 9 + lineIndex * 12}>{line}</text> : null)}
            </g>
          );
        })}
      </svg>
      <p>Numbers show zodiac signs. Tap any area to see its house and planet details.</p>
    </div>
  );
}

const SOUTH_SLOTS = [0, 1, 2, 3, 11, null, null, 4, 10, null, null, 5, 9, 8, 7, 6];

function SouthIndianChart({ houseList, selectedHouse, onSelect, label }) {
  const signHouses = new Map(houseList.map((house) => [ZODIAC.indexOf(house.sign), house]));
  return (
    <div aria-label={`${label} chart, South Indian layout`} className="kundali-south-chart">
      {SOUTH_SLOTS.map((signIndex, slot) => {
        if (signIndex === null) return <div aria-hidden="true" className="kundali-south-center" key={`center-${slot}`} />;
        const house = signHouses.get(signIndex);
        const sign = ZODIAC[signIndex];
        const names = house?.names || [];
        return <button aria-label={`${sign}, house ${house?.number || "unavailable"}, ${names.length} planets`} aria-pressed={selectedHouse === house?.number} className={`kundali-south-cell ${selectedHouse === house?.number ? "is-selected" : ""}`} key={sign} onClick={() => house && onSelect(house.number)} type="button">
          <span>{signIndex + 1} · H{house?.number || "–"}</span><strong>{sign}</strong><small>{names.map((name) => PLANET_SHORT[String(name).toLowerCase()] || String(name).slice(0, 2)).join(" · ") || "—"}</small>
        </button>;
      })}
      <div className="kundali-south-center-content"><strong>{label}</strong><span>Rāśi chart</span></div>
    </div>
  );
}

export default function KundaliChart({ houses = {}, planets = {}, timeKnown = true, className = "" }) {
  const [selectedHouse, setSelectedHouse] = useState(1);
  const [view, setView] = useState("lagna");
  const [layout, setLayout] = useState("north");
  const [focusOpen, setFocusOpen] = useState(false);
  const expandRef = useRef(null);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!focusOpen) return undefined;
    const pageScroller = document.querySelector(".overflow-y-auto.overscroll-contain");
    const bottomNav = document.querySelector(".tara-fixed-nav");
    const previousOverflow = pageScroller?.style.overflowY;
    const previousPageInert = pageScroller?.inert;
    const previousNavInert = bottomNav?.inert;
    if (pageScroller) pageScroller.style.overflowY = "hidden";
    if (pageScroller) pageScroller.inert = true;
    if (bottomNav) bottomNav.inert = true;
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFocusOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), summary, [href], [tabindex="0"]') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (pageScroller) pageScroller.style.overflowY = previousOverflow;
      if (pageScroller) pageScroller.inert = previousPageInert;
      if (bottomNav) bottomNav.inert = previousNavInert;
      expandRef.current?.focus();
    };
  }, [focusOpen]);
  const views = [
    { id: "lagna", label: "Lagna", sign: readable(houses["1"]?.sign || houses[1]?.sign) },
    { id: "moon", label: "Moon", sign: readable(planets.moon?.sign) },
    { id: "sun", label: "Sun", sign: readable(planets.sun?.sign) },
  ].filter((item) => item.sign);
  const activeView = views.find((item) => item.id === view) || views[0] || { id: "lagna", label: "Lagna", sign: "" };
  const houseList = chartHouses(activeView.id, activeView.sign, houses, planets);
  const selected = houseList[selectedHouse - 1];
  const selectedPlanets = selected.names
    .map((name) => ({ name: readable(name), key: String(name).toLowerCase(), position: planets[String(name).toLowerCase()] }))
    .sort((left, right) => PLANET_ORDER.indexOf(left.key) - PLANET_ORDER.indexOf(right.key));

  const layoutControls = (
    <div aria-label="Chart layout" className="kundali-layout-toggle">
      <button aria-pressed={layout === "north"} onClick={() => setLayout("north")} type="button">North Indian</button>
      <button aria-pressed={layout === "south"} onClick={() => setLayout("south")} type="button">South Indian</button>
      <button aria-pressed={layout === "houses"} onClick={() => setLayout("houses")} type="button">Houses</button>
    </div>
  );
  const perspectiveControls = (
    <div aria-label="Chart perspective" className="kundali-view-tabs">
      {views.map((item) => <button aria-pressed={activeView.id === item.id} key={item.id} onClick={() => { setView(item.id); setSelectedHouse(1); }} type="button">{item.label}</button>)}
    </div>
  );
  const chartVisual = layout === "north" ? <ChartDiagram houseList={houseList} label={activeView.label} onSelect={setSelectedHouse} selectedHouse={selectedHouse} /> : layout === "south" ? <SouthIndianChart houseList={houseList} label={activeView.label} onSelect={setSelectedHouse} selectedHouse={selectedHouse} /> : (
    <div className="kundali-house-grid">
      {houseList.map((house) => (
        <button
          aria-label={`House ${house.number}, ${house.sign || "sign unavailable"}, ${house.names.length} planets`}
          aria-pressed={selectedHouse === house.number}
          className={`kundali-house-tile ${selectedHouse === house.number ? "is-selected" : ""}`}
          key={house.number}
          onClick={() => setSelectedHouse(house.number)}
          type="button"
        >
          <span className="kundali-house-number">{String(house.number).padStart(2, "0")}</span>
          <strong>{house.sign || "Unknown"}</strong>
          <span className="kundali-house-count">{house.names.length ? `${house.names.length} planet${house.names.length === 1 ? "" : "s"}` : "No planets"}</span>
        </button>
      ))}
    </div>
  );
  const selectedDetail = (
    <div aria-live="polite" className="kundali-house-detail">
      <div className="kundali-house-detail-heading"><span>HOUSE {String(selected.number).padStart(2, "0")}</span><strong>{selected.sign || "Sign unavailable"}</strong></div>
      {selectedPlanets.length ? (
        <div className="kundali-house-planets">
          {selectedPlanets.map((planet) => <div key={planet.key}><strong>{planet.name}</strong><span>{positionText(planet.position)}</span></div>)}
        </div>
      ) : <p className="kundali-house-empty">No planets in this house. Its sign is still part of the chart.</p>}
    </div>
  );
  const chartNotes = (
    <>
      <details className="kundali-chart-legend">
        <summary>How to read this chart</summary>
        <p>Numbers are zodiac signs (1 Aries to 12 Pisces). Planet abbreviations such as Su and Mo stand for Sun and Moon. Tap a region to see full names and positions.</p>
      </details>
      {activeView.id !== "lagna" ? <p className="kundali-chart-view-note">This view re-centers the same sign placements on your {activeView.label.toLowerCase()} sign. It is not a separately calculated divisional chart.</p> : null}
    </>
  );

  return (
    <section aria-hidden={focusOpen || undefined} aria-label="Twelve-house birth chart" className={`kundali-house-map ${className}`}>
      <div className="kundali-house-map-intro">
        <div><p className="kundali-kicker">EXPLORE THE CHART</p><h3>{activeView.label} chart</h3></div>
        {!focusOpen ? layoutControls : null}
      </div>
      <div className="kundali-chart-actions">
        {timeKnown === false ? <span className="kundali-chart-assumption">Birth time assumed</span> : <span className="kundali-chart-action-hint">Explore each house</span>}
        <button onClick={() => setFocusOpen(true)} ref={expandRef} type="button"><Maximize2 size={15} /> Expand chart</button>
      </div>
      {!focusOpen ? <>{perspectiveControls}{chartVisual}{selectedDetail}{chartNotes}</> : null}
      {focusOpen ? createPortal(
        <div className="kundali-focus-backdrop">
          <div aria-labelledby="kundali-focus-title" aria-modal="true" className="kundali-focus-dialog" ref={dialogRef} role="dialog">
            <div className="kundali-focus-header">
              <div><p className="kundali-kicker">CHART FOCUS</p><h2 id="kundali-focus-title">{activeView.label} chart</h2></div>
              <button aria-label="Close expanded chart" onClick={() => setFocusOpen(false)} ref={closeRef} type="button"><X size={20} /></button>
            </div>
            <div className="kundali-focus-controls">
              {timeKnown === false ? <span className="kundali-chart-assumption">Birth time assumed</span> : null}
              {layoutControls}
              {perspectiveControls}
            </div>
            <div className="kundali-focus-scroll">{chartVisual}{chartNotes}</div>
            <div className="kundali-focus-detail">{selectedDetail}</div>
          </div>
        </div>, document.body
      ) : null}
    </section>
  );
}
