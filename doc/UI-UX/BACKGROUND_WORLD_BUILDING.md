# Tara Background World-Building

## Phase 4 Goal
Define the reusable environmental layer for Tara's day and night world.

This phase locks:
- the dark-theme scene recipe
- the light-theme scene recipe
- how animal motifs are treated
- safe-zone rules for readable content
- mobile scaling rules for atmospheric backgrounds

It is aligned with the live background utilities in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

---

## Core Rule

**The world should be felt before it is noticed.**

That means:
- the environment sits behind the product
- the atmosphere supports emotion, not novelty
- the center of the screen stays readable
- decorative motifs live on the edges, never on top of dense content

---

## Scene Structure

Every Tara background should be thought of as four stacked layers:

1. `Sky depth`
   - base gradient
   - tonal falloff
   - upper-sky and lower-horizon balance

2. `Atmosphere`
   - moon glow or sunlight bloom
   - ambient haze
   - soft corner illumination

3. `World detail`
   - stars
   - faint constellation lines
   - clouds
   - subtle horizon glow

4. `Product layer`
   - cards
   - forms
   - chat
   - navigation
   - chart content

The first three create feeling.
The fourth must remain visually dominant for task completion.

---

## Dark Theme Background

### Emotional Reading
Night should feel:
- private
- romantic
- mystical
- emotionally deep

### Visual Recipe

#### 1. Deep layered gradients
The dark scene uses:
- midnight navy as the deepest base
- indigo lift near the upper sky
- a slightly richer lower half for emotional depth

This gives the app a night world that feels dimensional instead of flat.

#### 2. Stars
Stars should be:
- small
- sparse
- varied in intensity
- concentrated more in upper and outer regions than in the center

They are there to create atmosphere, not to make the screen look busy.

#### 3. Moon glow
Moon glow should feel:
- diffused
- cool
- gentle
- slightly off-center

It should never read as a literal round moon pasted behind content.
The glow is the emotional cue; the object itself stays implied.

#### 4. Constellations
Constellation lines should be:
- faint
- occasional
- incomplete
- positioned near the periphery

They should suggest celestial intelligence, not diagrammatic clutter.

#### 5. Horizon depth
The lower edge of the screen should carry a soft luminous horizon so the world feels grounded, not like a flat star wallpaper.

---

## Light Theme Background

### Emotional Reading
Day should feel:
- open
- hopeful
- fresh
- breathable

### Visual Recipe

#### 1. Soft sky
The light scene uses:
- pale sky blue
- cream-tinted lower light
- a slight dawn-to-day transition

This keeps the theme warm and romantic instead of sterile white.

#### 2. Sunlight bloom
Sunlight should feel:
- diffuse
- early-morning soft
- warm but not yellow-heavy
- airy rather than dramatic

The glow should brighten the world, not bleach the content.

#### 3. Clouds
Clouds should be:
- feathered
- blurred
- positioned high and to the sides
- used as atmosphere, not as illustration

They should create lift and softness without competing with copy.

#### 4. Airy depth
The light theme still needs depth.
That comes from:
- soft shadow
- layered haze
- a subtle lower horizon bloom

The goal is openness with structure, not flat brightness.

---

## Owl and Bird Decision

### Final Decision
Both motifs should be treated as **silhouettes softened into the background**, not as line-art mascots.

### Night motif
Use:
- a sparse owl silhouette
- only on selective hero or empty-state surfaces
- positioned near an upper corner or distant edge

Do not use:
- detailed feathers
- face-first owl illustrations
- repeated owl artwork across many screens

### Day motif
Use:
- a sunrise bird silhouette
- only on selective hero or empty-state surfaces
- positioned lightly in the upper sky or far edge

Do not use:
- loud cartoon birds
- overly literal rooster treatment
- decorative birds on dense product screens

### Why
Silhouettes preserve mood without turning the interface into a themed poster.
They feel cinematic, not decorative-for-its-own-sake.

---

## Safe-Zone Rules

### Principle
Important content needs a quiet center.

### Safe zones
Decorative weight should bias toward:
- top corners
- upper sky
- lower horizon
- outer edges

Avoid placing strong decoration in:
- center column
- form input rows
- chart data grids
- chat transcript area
- settings lists

### Product interpretation
- `Landing` and `auth` can use stronger atmospheric framing
- `Kundali` can carry a slightly richer celestial header
- `Discover`, `matches`, and `profile` should keep the active content card visually strongest
- `Chat body` and `settings` should remain the quietest

### Live implementation rule
Safe spacing tokens are used to reserve visual breathing room:
- `--tara-world-safe-inline`
- `--tara-world-safe-top`
- `--tara-world-safe-bottom`

Reusable utilities:
- `.tara-scene-safe`
- `.tara-scene-safe-top`
- `.tara-scene-safe-bottom`
- `.tara-scene-safe-center`

---

## Mobile Scaling Rules

### Priority
Mobile readability is more important than full decorative richness.

### Mobile behavior
On smaller screens:
- safe margins tighten slightly, but remain present
- star density softens
- cloud and glow layers stay visible but less dominant
- hero sections shorten to avoid pushing content below the fold

### Composition rule
If a decorative element and a mobile task compete, the decoration loses.

### Practical result
On phone screens:
- center content remains readable
- bottom nav stays clear
- headers still feel atmospheric
- the scene still feels intentional, not stripped bare

---

## Reusable Utilities

### App-wide shell
- `.bg-app`
- `.bg-cosmic`

These provide:
- global world depth
- stars and constellation wash
- atmosphere and horizon glow
- theme-aware scaling

### Local scene wrappers
- `.tara-scene-shell`
- `.tara-scene-hero`
- `.tara-scene-header`
- `.tara-scene-motif`

These are for:
- hero blocks
- empty states
- selective themed headers
- screen-level world-building without polluting content lists

---

## Do / Don't

### Do
- use layered gradients
- keep stars subtle
- keep clouds soft
- keep motifs sparse and edge-based
- protect the content center
- let atmosphere change with theme

### Don't
- place decorative animals in every screen
- use literal moon or sun stickers
- fill the center with stars or clouds
- put constellations behind dense text
- make the background louder than the card or form

---

## Phase 4 Exit Criteria

Phase 4 is complete when:
1. dark mode reads as a layered starlit world
2. light mode reads as a warm, airy sky world
3. owl and bird treatment is locked to sparse silhouettes
4. safe zones are explicit in both rules and utilities
5. the background system remains mobile-safe and reusable
