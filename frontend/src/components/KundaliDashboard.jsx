import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Compass, Download, Moon, RefreshCw, Sparkles } from "lucide-react";

import { fetchDailyHoroscope, fetchKundali } from "../services/astrologyService";
import KundaliChart from "./KundaliChart";
import LifeDashboard from "./LifeDashboard";

const TABS = [
  { id: "overview", label: "Basic", icon: Sparkles },
  { id: "chart", label: "Kundli", icon: Compass },
  { id: "charts", label: "Charts", icon: Compass },
  { id: "insights", label: "Free report", icon: BookOpen },
  { id: "today", label: "Today", icon: Moon },
];

const PLANET_ORDER = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
const ZODIAC = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const SIGN_LORDS = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const NAKSHATRA_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
const INSIGHT_SECTIONS = [
  ["personality", "Personality"], ["career", "Career"], ["emotions", "Emotions"],
  ["wellbeing", "Wellbeing"], ["growth", "Growth"],
];

function readable(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function degree(value) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? "--" : `${number.toFixed(2)}°`;
}

function enrichPlanet(name, position) {
  const longitude = Number(position?.degree);
  if (!Number.isFinite(longitude)) return { name, position };
  const nakshatraIndex = Math.floor((((longitude % 360) + 360) % 360) / (360 / 27));
  const withinNakshatra = (((longitude % 360) + 360) % 360) % (360 / 27);
  return {
    name,
    position,
    signLord: SIGN_LORDS[ZODIAC.indexOf(readable(position?.sign))] || "--",
    nakshatra: NAKSHATRAS[nakshatraIndex],
    nakshatraLord: NAKSHATRA_LORDS[nakshatraIndex % 9],
    pada: Math.floor(withinNakshatra / (360 / 108)) + 1,
  };
}

function printable() {
  if (typeof window.print !== "function") return;
  // Keep the user gesture synchronous so browsers don't treat print as a popup.
  window.print();
}

function PrintReport({ kundali, planetRows }) {
  const context = kundali?.birth_context || {};
  const settings = kundali?.calculation_settings || {};
  const houses = Object.entries(kundali?.chart_data?.houses || {}).sort(([a], [b]) => Number(a) - Number(b));
  return <article className="kundali-print-report">
    <header><span className="kundali-brand">tara<span>.</span></span><p>KUNDALI REPORT</p><h1>{context.place ? `Birth chart · ${context.place}` : "Your birth chart"}</h1></header>
    <section><h2>Birth details</h2><dl className="kundali-print-facts">
      <div><dt>Date</dt><dd>{context.date || "--"}</dd></div><div><dt>Time</dt><dd>{context.time || "12:00 assumed"}</dd></div>
      <div><dt>Place</dt><dd>{context.place || "--"}</dd></div><div><dt>Timezone</dt><dd>{context.timezone || "--"}</dd></div>
      <div><dt>Ascendant</dt><dd>{context.time_known === false ? "Uncertain" : readable(kundali?.lagna) || "--"}</dd></div>
      <div><dt>Moon sign</dt><dd>{readable(kundali?.moon_sign) || "--"}</dd></div><div><dt>Nakshatra</dt><dd>{kundali?.nakshatra || "--"}{kundali?.nakshatra_pada ? ` · Pada ${kundali.nakshatra_pada}` : ""}</dd></div>
      <div><dt>Sun sign</dt><dd>{readable(kundali?.sun_sign) || "--"}</dd></div>
    </dl></section>
    {kundali?.chart_data?.houses ? <section><h2>Birth chart · North Indian layout</h2><KundaliChart className="kundali-print-chart" houses={kundali.chart_data.houses} planets={kundali.chart_data.planets || {}} timeKnown={context.time_known} /></section> : null}
    <section><h2>Planetary positions</h2><div className="kundali-print-table-wrap"><table><thead><tr><th>Planet</th><th>Sign</th><th>Sign lord</th><th>Degree</th><th>Nakshatra</th><th>Nakshatra lord</th><th>House</th></tr></thead>
      <tbody>{planetRows.map(({ name, position, signLord, nakshatra, nakshatraLord }) => <tr key={name}><td>{readable(name)}</td><td>{readable(position?.sign) || "--"}</td><td>{signLord}</td><td>{degree(position?.degree_in_sign)}</td><td>{nakshatra}</td><td>{nakshatraLord}</td><td>{position?.house || "--"}</td></tr>)}</tbody></table></div></section>
    {houses.length ? <section><h2>Lagna chart · Whole-sign houses</h2><div className="kundali-print-table-wrap"><table><thead><tr><th>House</th><th>Sign</th><th>Planets</th></tr></thead><tbody>{houses.map(([house, data]) => <tr key={house}><td>{house}</td><td>{readable(data?.sign) || "--"}</td><td>{(data?.planets || []).map(readable).join(", ") || "—"}</td></tr>)}</tbody></table></div></section> : null}
    {kundali?.insights && Object.values(kundali.insights).some(Boolean) ? <section><h2>Interpretations</h2>{Object.entries(kundali.insights).filter(([, text]) => text).map(([key, text]) => <div className="kundali-print-insight" key={key}><h3>{readable(key)}</h3><p>{text}</p></div>)}</section> : null}
    <section><h2>Calculation settings</h2><dl className="kundali-print-facts">{Object.entries(settings).map(([key, value]) => <div key={key}><dt>{readable(key)}</dt><dd>{value}</dd></div>)}</dl></section>
    <footer>Astrology is a traditional interpretive practice; this report is for personal reflection. KP, Ashtakavarga, divisional charts, and dasha periods are not included because Tara does not calculate them yet.</footer>
  </article>;
}

function AccuracyNotice({ context, onEditBirthDetails }) {
  if (context?.time_known !== false && !context?.location_is_default) return null;
  return (
    <div className="kundali-accuracy-notice" role="note">
      <strong>About this chart</strong>
      {context?.time_known === false ? <p>Birth time is missing. The chart uses 12:00 local time, so Lagna, houses, and timing may change when you add the correct time.</p> : null}
      {context?.location_is_default ? <p>A default birth location is in use. Confirm the place for a more reliable chart.</p> : null}
      {onEditBirthDetails ? <button onClick={onEditBirthDetails} type="button">Update birth details</button> : null}
    </div>
  );
}

function Overview({ kundali, onEditBirthDetails, onOpenChart }) {
  const context = kundali?.birth_context || {};
  const uncertain = context.time_known === false;
  const settings = kundali?.calculation_settings || {};
  const methodItems = [
    ["Zodiac", settings.zodiac], ["Ayanamsha", settings.ayanamsha],
    ["House system", settings.houses], ["Ephemeris", settings.ephemeris],
  ].filter(([, value]) => value);

  return (
    <div className="kundali-tab-content">
      <AccuracyNotice context={context} onEditBirthDetails={onEditBirthDetails} />
      <section className="kundali-overview-hero">
        <p className="kundali-kicker">YOUR CHART AT A GLANCE</p>
        <h2>{uncertain ? "Your Moon-led overview" : "Your birth-chart signature"}</h2>
        <p>Start with the essentials, then explore the chart at your own pace.</p>
        <div className="kundali-essential-grid">
          <div><span>Moon sign{uncertain ? " · estimate" : ""}</span><strong>{readable(kundali?.moon_sign) || "Not available"}</strong></div>
          <div><span>Nakshatra{uncertain ? " · estimate" : ""}</span><strong>{kundali?.nakshatra || "Not available"}</strong>{kundali?.nakshatra_pada ? <small>Pada {kundali.nakshatra_pada}</small> : null}</div>
          <div><span>Lagna</span><strong>{uncertain ? "Time needed" : readable(kundali?.lagna) || "Not available"}</strong></div>
          <div><span>Sun sign</span><strong>{readable(kundali?.sun_sign) || "Not available"}</strong></div>
        </div>
        <button className="kundali-primary-action" onClick={onOpenChart} type="button">View birth chart <Compass size={16} /></button>
      </section>

      <section className="kundali-basis-card">
        <div><p className="kundali-kicker">CHART BASIS</p><h3>Birth information used</h3></div>
        <dl>
          <div><dt>Date</dt><dd>{context.date || "Not available"}</dd></div>
          <div><dt>Time</dt><dd>{context.time || (uncertain ? "12:00 assumed" : "Not available")}</dd></div>
          <div><dt>Place</dt><dd>{context.place || "Not available"}</dd></div>
          <div><dt>Timezone</dt><dd>{context.timezone || "Not available"}</dd></div>
        </dl>
      </section>

      <details className="kundali-disclosure kundali-methodology">
        <summary>How this chart is calculated</summary>
        <p>Tara uses the birth details above to calculate a sidereal chart. These readings are traditional interpretations, not certainties or professional advice.</p>
        {methodItems.length ? <dl>{methodItems.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p>Calculation settings are not available for this chart.</p>}
      </details>
    </div>
  );
}

function BirthChart({ kundali, onEditBirthDetails }) {
  const chart = kundali?.chart_data || {};
  const planets = chart.planets || {};
  const planetRows = Object.entries(planets).map(([name, position]) => enrichPlanet(name, position)).sort((left, right) => PLANET_ORDER.indexOf(left.name) - PLANET_ORDER.indexOf(right.name));

  return (
    <div className="kundali-tab-content">
      <AccuracyNotice context={kundali?.birth_context} onEditBirthDetails={onEditBirthDetails} />
      <div className="kundali-panel-heading"><p className="kundali-kicker">YOUR PLACEMENTS</p><h2>Birth chart</h2><p>Explore the sign and planets in each whole-sign house.</p></div>
      <div className="kundali-chart-facts">
        <span>Lagna <strong>{kundali?.birth_context?.time_known === false ? "Uncertain" : readable(kundali?.lagna) || "--"}</strong></span>
        <span>Ascendant <strong>{kundali?.birth_context?.time_known === false ? "Uncertain" : degree(chart.ascendant_degree)}</strong></span>
      </div>
      <details className="kundali-disclosure"><summary>Planet placements <span>{planetRows.length}</span></summary>
        {planetRows.length ? <div className="kundali-position-list">
          <p>Sidereal positions. Nakshatra and pada are derived from each planet’s sidereal longitude; house numbers use the Lagna whole-sign chart.</p>
          <div className="kundali-positions-table-wrap"><table className="kundali-positions-table"><thead><tr><th>Planet</th><th>Sign</th><th>Sign lord</th><th>Degree</th><th>Nakshatra · Pada</th><th>Nakshatra lord</th><th>House</th></tr></thead>
            <tbody>{planetRows.map(({ name, position, signLord, nakshatra, pada, nakshatraLord }) => <tr key={name}><th scope="row"><span className="kundali-position-mark">{name.slice(0, 2).toUpperCase()}</span>{readable(name)}</th><td>{readable(position?.sign) || "--"}</td><td>{signLord}</td><td>{degree(position?.degree_in_sign)}</td><td>{nakshatra} · {pada}</td><td>{nakshatraLord}</td><td>{position?.house || "--"}</td></tr>)}</tbody>
          </table></div>
        </div> : <p>No planet positions are available yet.</p>}
      </details>
    </div>
  );
}

function Charts({ kundali, onEditBirthDetails }) {
  const chart = kundali?.chart_data || {};
  return <div className="kundali-tab-content">
    <AccuracyNotice context={kundali?.birth_context} onEditBirthDetails={onEditBirthDetails} />
    <div className="kundali-panel-heading"><p className="kundali-kicker">BIRTH CHARTS</p><h2>Explore your chart</h2><p>Switch between North and South Indian layouts, and view placements from the Lagna, Moon, or Sun perspective.</p></div>
    <KundaliChart houses={chart.houses || {}} planets={chart.planets || {}} timeKnown={kundali?.birth_context?.time_known} />
    <p className="kundali-scope-note">Moon and Sun views re-center the same birth-chart placements. They are not Navamsa or other divisional charts.</p>
  </div>;
}

function Insights({ kundali }) {
  const insights = kundali?.insights || {};
  const scores = kundali?.scores || {};
  const hasScores = ["career", "love", "finance"].some((key) => scores[key] !== undefined && scores[key] !== null);

  return (
    <div className="kundali-tab-content">
      <div className="kundali-panel-heading"><p className="kundali-kicker">INTERPRETATION</p><h2>Life themes</h2><p>Read one theme at a time. These are interpretive prompts, not predictions.</p></div>
      {insights.relationships ? <article className="kundali-featured-insight"><span>RELATIONSHIPS</span><p>{insights.relationships}</p></article> : null}
      {INSIGHT_SECTIONS.map(([key, label]) => insights[key] ? <details className="kundali-disclosure" key={key}><summary>{label}</summary><p>{insights[key]}</p></details> : null)}
      {!Object.values(insights).some(Boolean) ? <p className="kundali-empty-copy">No personal interpretations are available yet.</p> : null}
      {hasScores ? <details className="kundali-disclosure"><summary>Life-area scores</summary><p>These are soft chart-derived indicators, not measures of future outcomes.</p><LifeDashboard scores={scores} /></details> : null}
      <p className="kundali-scope-note">Dasha periods, yogas, and doshas are not calculated in this report. Tara does not infer them from a score alone.</p>
    </div>
  );
}

function Today({ horoscope, error }) {
  if (error) return <div className="kundali-error" role="alert">{error}</div>;
  if (!horoscope) return <p className="kundali-empty-copy">Today's reading is not available yet.</p>;

  const detailed = horoscope.detailed || {};
  const sections = [
    ["love", "Love"], ["career", "Career"], ["finance", "Finance"], ["wellbeing", "Wellbeing"],
  ].map(([key, label]) => ({
    key, label, text: horoscope[key] || detailed[key]?.summary || "", action: detailed[key]?.action || "",
    opportunity: detailed[key]?.opportunities?.[0] || "", caution: detailed[key]?.cautions?.[0] || "",
  })).filter((section) => section.text || section.action || section.opportunity || section.caution);
  const transits = Array.isArray(horoscope.key_transits) ? horoscope.key_transits : [];
  const source = horoscope.source === "transit" ? "Based on current transits through your chart" : horoscope.source === "moon-sign-fallback" ? "Moon-sign reading; birth-chart transits unavailable" : "";

  return (
    <div className="kundali-tab-content">
      <div className="kundali-panel-heading"><p className="kundali-kicker">DAILY READING {horoscope.date ? `· ${horoscope.date}` : ""}</p><h2>Today</h2><p>{source || "Your daily horoscope, separate from your birth chart."}</p></div>
      {horoscope.overall ? <article className="kundali-today-overall"><span>THE BIG PICTURE</span><p>{horoscope.overall}</p></article> : null}
      {sections.map((section) => <details className="kundali-disclosure" key={section.key}><summary>{section.label}</summary>
        {section.text ? <p>{section.text}</p> : null}
        {section.opportunity ? <p><strong>Opportunity:</strong> {section.opportunity}</p> : null}
        {section.caution ? <p><strong>Watch for:</strong> {section.caution}</p> : null}
        {section.action ? <p><strong>Try:</strong> {section.action}</p> : null}
      </details>)}
      {transits.length ? <details className="kundali-disclosure"><summary>Transits used <span>{transits.length}</span></summary>
        <div className="kundali-data-list">{transits.map((item, index) => <div key={`${item.planet}-${index}`}><strong>{readable(item.planet)} · House {item.house || "--"}</strong><span>{item.message || item.theme || readable(item.sign)}</span></div>)}</div>
      </details> : null}
      {!horoscope.overall && !sections.length ? <p className="kundali-empty-copy">There is no daily guidance to show right now.</p> : null}
    </div>
  );
}

export default function KundaliDashboard({ onEditBirthDetails, reloadSignal = 0 }) {
  const [kundali, setKundali] = useState(null);
  const [horoscope, setHoroscope] = useState(null);
  const [horoscopeError, setHoroscopeError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const loadDashboard = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const chart = await fetchKundali();
      setKundali(chart || null);
      try {
        setHoroscope(await fetchDailyHoroscope());
        setHoroscopeError("");
      } catch (apiError) {
        setHoroscope(null);
        setHoroscopeError(apiError?.message || "Could not load today's reading.");
      }
    } catch (apiError) {
      setKundali(null);
      setHoroscope(null);
      setError(apiError?.status === 404 ? "Kundali is not generated yet. Save your birth details to generate your chart." : apiError?.message || "Could not load kundali right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [reloadSignal]);

  const onTabKeyDown = (event, index) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setActiveSection(TABS[next].id);
    document.getElementById(`kundali-tab-${TABS[next].id}`)?.focus();
  };

  return (
    <section className="kundali-dashboard">
      <div className="kundali-dashboard-tools">
        <span>{kundali?.updated_at ? `Chart updated ${new Date(kundali.updated_at).toLocaleDateString()}` : "Your chart, explained simply"}</span>
        <div><button aria-label="Download Kundali report as PDF" disabled={loading || !kundali} onClick={printable} type="button"><Download size={16} /> Download PDF</button><button aria-label="Refresh Kundali" disabled={loading || refreshing} onClick={() => loadDashboard({ silent: true })} type="button"><RefreshCw className={refreshing ? "animate-spin" : ""} size={16} /> Refresh</button></div>
      </div>
      {loading ? <div className="kundali-skeleton"><div className="h-32 animate-pulse rounded-2xl" /><div className="h-12 animate-pulse rounded-xl" /><div className="h-40 animate-pulse rounded-2xl" /></div> : null}
      {!loading && error ? <div className="kundali-error" role="alert">{error}</div> : null}
      {!loading && !error && kundali ? (
        <>
          {createPortal(<div className="kundali-print-root"><PrintReport kundali={kundali} planetRows={Object.entries(kundali?.chart_data?.planets || {}).map(([name, position]) => enrichPlanet(name, position)).sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name))} /></div>, document.body)}
          <nav aria-label="Kundali sections" className="kundali-primary-tabs" role="tablist">
            {TABS.map(({ id, label, icon: Icon }, index) => <button aria-controls="kundali-active-panel" aria-selected={activeSection === id} className={activeSection === id ? "is-active" : ""} id={`kundali-tab-${id}`} key={id} onClick={() => setActiveSection(id)} onKeyDown={(event) => onTabKeyDown(event, index)} role="tab" tabIndex={activeSection === id ? 0 : -1} type="button"><Icon size={18} /><span>{label}</span></button>)}
          </nav>
          <div aria-labelledby={`kundali-tab-${activeSection}`} className="kundali-active-panel" id="kundali-active-panel" role="tabpanel">
            {activeSection === "overview" ? <Overview kundali={kundali} onEditBirthDetails={onEditBirthDetails} onOpenChart={() => setActiveSection("chart")} /> : null}
            {activeSection === "chart" ? <BirthChart kundali={kundali} onEditBirthDetails={onEditBirthDetails} /> : null}
            {activeSection === "charts" ? <Charts kundali={kundali} onEditBirthDetails={onEditBirthDetails} /> : null}
            {activeSection === "insights" ? <Insights kundali={kundali} /> : null}
            {activeSection === "today" ? <Today error={horoscopeError} horoscope={horoscope} /> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
