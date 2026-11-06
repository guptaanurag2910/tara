const SIGNS = [
  "ARIES", "TAURUS", "GEMINI", "CANCER", "LEO", "VIRGO",
  "LIBRA", "SCORPIO", "SAGITTARIUS", "CAPRICORN", "AQUARIUS", "PISCES",
];

const ELEMENT_COLORS = ["#ef8f78", "#d4a861", "#8bbfd1", "#a999d4"];

function polar(radius, angle) {
  return {
    x: 150 + Math.cos(angle) * radius,
    y: 150 + Math.sin(angle) * radius,
  };
}

export default function ZodiacLandingWheel() {
  return (
    <div className="landing-logo-scene" aria-hidden="true">
      <svg className="landing-zodiac-wheel" viewBox="0 0 300 300" focusable="false">
        <defs>
          <radialGradient id="landing-wheel-fill">
            <stop stopColor="#fff" />
            <stop offset=".72" stopColor="#fff8fa" />
            <stop offset="1" stopColor="#fff3f7" />
          </radialGradient>
        </defs>
        <circle cx="150" cy="150" r="145" fill="url(#landing-wheel-fill)" stroke="#e8bdcc" strokeWidth="1.5" />
        <circle cx="150" cy="150" r="136" fill="none" stroke="#efccda" strokeWidth=".8" />
        <circle cx="150" cy="150" r="83" fill="none" stroke="#e9c2d2" strokeWidth="1.1" />
        <g className="landing-zodiac-inner-orbit">
          <circle cx="150" cy="150" r="71" fill="none" stroke="#f1dce4" strokeWidth=".9" strokeDasharray="1.5 5" />
          <circle cx="150" cy="79" r="2.5" fill="#e9a1ba" />
        </g>
        {Array.from({ length: 72 }, (_, index) => {
          const angle = -Math.PI / 2 + index * Math.PI / 36;
          const inner = polar(index % 6 === 0 ? 136 : 140, angle);
          const outer = polar(145, angle);
          return (
            <line
              key={`tick-${index}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#e9bfd0"
              strokeWidth={index % 6 === 0 ? 1.1 : .55}
            />
          );
        })}
        {SIGNS.map((name, index) => {
          const center = -Math.PI / 2 + index * Math.PI / 6;
          const edge = center - Math.PI / 12;
          const dividerStart = polar(83, edge);
          const dividerEnd = polar(136, edge);
          const glyph = polar(102, center);
          const sideLabel = index === 3 || index === 9;
          const label = polar(sideLabel ? 116 : 124, center);
          const marker = polar(86, center);
          return (
            <g key={name}>
              <line x1={dividerStart.x} y1={dividerStart.y} x2={dividerEnd.x} y2={dividerEnd.y} stroke="#edd2dc" strokeWidth=".8" />
              <circle cx={marker.x} cy={marker.y} r="2.5" fill={ELEMENT_COLORS[index % 4]} />
              <text className="landing-zodiac-glyph" x={glyph.x} y={glyph.y}>{String.fromCharCode(0x2648 + index, 0xfe0e)}</text>
              <text className="landing-zodiac-name" x={label.x} y={label.y + (sideLabel ? 18 : 0)}>{name}</text>
            </g>
          );
        })}
      </svg>
      <div className="landing-star-halo" />
      <svg className="landing-symbol" viewBox="0 0 152 152" focusable="false">
        <defs>
          <linearGradient id="landing-star-gradient" x1="31" y1="26" x2="121" y2="130" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff9e52" />
            <stop offset=".5" stopColor="#ef3975" />
            <stop offset="1" stopColor="#b6348f" />
          </linearGradient>
        </defs>
        <path d="M76 12C83 50 93 67 140 76C93 85 83 102 76 140C69 102 59 85 12 76C59 67 69 50 76 12Z" fill="url(#landing-star-gradient)" />
        <circle cx="76" cy="76" r="10" fill="#fff" />
        <circle cx="76" cy="76" r="4.5" fill="#e1306c" />
      </svg>
    </div>
  );
}
