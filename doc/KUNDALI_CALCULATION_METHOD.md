# Tara Kundali calculation method

This document records the current deterministic calculation choices so charts
can be compared using matching inputs and settings. Astrology interpretation
and compatibility scoring are traditional rule systems, not scientific
relationship or life-outcome predictions.

## Birth chart

Inputs are the local birth date and time, birthplace coordinates, and the time
zone resolved for those coordinates. Tara converts the local time to UTC, then
uses Swiss Ephemeris (`pyswisseph`) with the Lahiri sidereal mode to calculate
the Sun, Moon, planets, and mean lunar node. Ketu is placed opposite Rahu.

The ascendant is calculated for the UTC birth instant and geographic
coordinates. Tara assigns whole-sign houses, starting with the ascendant's
sign. Nakshatra and pada are calculated by dividing the 360-degree sidereal
zodiac into 27 equal Nakshatra spans and each span into four padas.

The authoritative source for the current implementation is
`backend/apps/users/services/vedic_kundali_engine.py`.
If a local time is ambiguous or never occurred because of a daylight-saving
clock change, calculation now reports an input error instead of guessing the
UTC offset.

## Matching attributes

Nakshatra name, Gana, Yoni, and Nadi now come from one shared 27-entry table in
`backend/apps/users/services/nakshatra_data.py`. Chart generation and the
Ashtakoota scorer use this same table. This replaces the earlier repeating
attribute cycles, which assigned incorrect values to many Nakshatras.

The full Kundali match uses Ashtakoota with these maxima: Varna 1, Vashya 2,
Tara 3, Yoni 4, Graha Maitri 5, Gana 6, Bhakoot 7, Nadi 8. Bhakoot checks
circular Moon-sign distance; distances of 1, 4, or 5 signs are the 2/12, 5/9,
and 6/8 relationships and score zero. Other distances receive all seven points.
The selected tables and scoring rules live in
`backend/apps/users/services/ashta_koota_service.py`. Tara returns half points
for one-sided Tara favorability. Gana is traditionally directional by partner
role; because this API does not assign groom/bride roles, it averages both
directions so swapping profiles cannot change the score.

Yoni, Vashya, and Graha Maitri still use simplified rules and are not validated
as exact matches for commercial services. Before claiming parity, we need
reference fixtures for all 36 Moon-sign pairs and all 27×27 Nakshatra pairs.

Initial suggested-match ranking also has a separate cached proxy score. It is
not the full Ashtakoota result and should not be presented as interchangeable
with the detailed match breakdown.

## Important limits to resolve

- The onboarding form currently pre-fills the birth-time field with the
  device's current local time. The chart engine treats any supplied value as
  the person's birth time. A prefilled time is not evidence of birth time and
  can produce an incorrect ascendant and house chart if the user leaves it as
  is.
- If no birth time reaches the engine, it currently calculates at noon and
  marks the chart as not accurate. That may be useful for a limited Moon-based
  reading, but should not be confused with a full timed chart.
- If Swiss Ephemeris is unavailable, `kundali_service.py` can fall back to an
  approximate Moon-only calculation. Other calculation and input errors now
  surface instead of silently producing a plausible-looking approximate chart.
- The daily transit horoscope uses a local-noon snapshot in the birth
  location's timezone and whole-sign houses from the user's Lagna. Its copy is
  rule-based astrological interpretation, not a measured forecast; it does
  not currently calculate aspects, dashas, or Panchang.
- Astrology traditions and software settings differ. Planetary results should
  be benchmarked against reference charts only when time-zone handling,
  Ayanamsa, node type, house system, and rounding rules match.
- Two published Swiss Ephemeris cases are included as regression fixtures;
  they validate those inputs only, not every historical timezone or birth.

## Public comparison references

- [Kundli web app method and validation notes](https://github.com/vasant22/kundli)
  documents Swiss Ephemeris, Lahiri, whole-sign houses, node choice, and its
  own Ashtakoota comparison cases.
- [@prisri/jyotish](https://github.com/prisriorg/jyotish) documents its
  configurable Jyotish chart, matching, Panchang, and transit modules.

These projects are comparison references, not proof that one tradition is the
single correct astrology standard. Tara has not copied their implementation.
