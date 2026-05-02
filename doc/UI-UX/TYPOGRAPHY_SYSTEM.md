# Tara Typography System

## Phase 3 Goal
Lock the font roles, type scale, spacing rhythm, and readability rules for Tara.

This document finalizes:
- display serif for romantic and emotional headings
- UI sans for app structure and utility text
- hero / page / section / card / body / helper sizes
- line-height and spacing rules
- contrast and readability guardrails for both day and night themes

It is aligned with the live token layer in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

---

## Font Role Lock

### Display Serif
**Primary**
- `Cormorant Garamond`

**Fallbacks**
- `Playfair Display`
- `Georgia`
- `serif`

**Why**
- romantic without feeling old-fashioned
- elegant and editorial
- works well for emotional product moments
- already fits Tara's current visual language

**Use for**
- landing hero
- auth hero
- page titles
- large match names
- kundali headings
- emotionally resonant high-emphasis text

**Do not use for**
- forms
- navigation
- long paragraphs
- helper text
- data-heavy UI

### UI Sans
**Primary**
- `Inter`

**Fallbacks**
- `Avenir Next`
- `Segoe UI`
- `sans-serif`

**Why**
- highly readable on mobile
- clean and modern
- good for compact UI labels and dense screens
- balances the romantic display serif with clarity

**Use for**
- forms
- cards
- navigation
- buttons
- body text
- helper text
- alerts
- status text
- settings and technical content

---

## Live Font Tokens

Defined in the app:
- `--font-display`
- `--font-sans`
- `--font-serif` aliasing display for backward compatibility

Supporting utility classes added:
- `.tara-type-hero`
- `.tara-type-page`
- `.tara-type-section`
- `.tara-type-card`
- `.tara-type-body`
- `.tara-type-helper`

---

## Type Scale

### Hero Title
**Token**
- `--tara-type-hero-size`

**Live value**
- `clamp(3.25rem, 8vw, 4.9rem)`

**Use for**
- landing headline
- auth step headline
- special emotional transition screens

**Style**
- display serif
- line-height: `0.98`
- slightly tight tracking

### Page Title
**Token**
- `--tara-type-page-size`

**Live value**
- `clamp(2.5rem, 6.4vw, 3.9rem)`

**Use for**
- top-level pages:
  - Discover
  - Matches
  - Chat
  - Kundali
  - Profile

**Style**
- display serif
- line-height: `1.02`

### Section Title
**Token**
- `--tara-type-section-size`

**Live value**
- `clamp(1.65rem, 4.4vw, 2.35rem)`

**Use for**
- section headings inside pages
- cards with strong narrative focus
- modals with thematic emphasis

**Style**
- display serif
- line-height: `1.08`

### Card Title
**Token**
- `--tara-type-card-size`

**Live value**
- `clamp(1.05rem, 3.2vw, 1.3rem)`

**Use for**
- card headers
- feature tile titles
- actionable content titles
- match item names in compact views

**Style**
- UI sans
- semibold
- line-height: `1.2`

### Body Text
**Token**
- `--tara-type-body-size`

**Live value**
- `0.95rem`

**Use for**
- descriptions
- card body text
- empty states
- profile content
- kundali interpretation paragraphs

**Style**
- UI sans
- line-height: `1.62`

### Helper Text
**Token**
- `--tara-type-helper-size`

**Live value**
- `0.75rem`

**Use for**
- labels
- metadata
- timestamps
- subtle guidance
- technical small print

**Style**
- UI sans
- line-height: `1.45`

### Kicker / Label Text
**Token**
- `--tara-type-kicker-size`

**Live value**
- `0.68rem`

**Use for**
- uppercase section intro labels
- celestial micro-labels
- emphasis tags above headings

**Style**
- high tracking
- sparse use only

---

## Line-Height Rules

### Display Typography
- Hero: `0.98`
- Page title: `1.02`
- Section title: `1.08`

Display text should feel:
- elegant
- tight
- editorial

But it should not become:
- crowded
- clipped
- hard to scan on mobile

### UI Typography
- Card title: `1.2`
- Body: `1.62`
- Helper: `1.45`

UI text should feel:
- calm
- breathable
- fast to read

---

## Tracking Rules

### Display text
- slightly tight
- avoid exaggerated spacing

### Kicker text
- wide uppercase tracking
- reserved for section markers and emotional framing

### Body text
- normal tracking
- prioritize reading comfort

---

## Spacing Rules

### Heading to subcopy
Use:
- `--tara-space-heading-block: 0.65rem`

Meaning:
- hero or page title should breathe before the supporting copy

### Copy block rhythm
Use:
- `--tara-space-copy-block: 0.45rem`

Meaning:
- keep paragraph and helper rhythm consistent and soft

### Paragraph width
Long text should stay visually narrow on mobile.

Best rule:
- body text should rarely span full-width without margin breathing
- interpretation copy should be chunked into short readable paragraphs

---

## Readability Rules

### Dark Theme
Requirements:
- primary text must stay high contrast against indigo surfaces
- muted text must remain readable without going gray and dead
- gold text should be accent-only, not paragraph text

### Light Theme
Requirements:
- navy text should remain strong against cream and sky backgrounds
- faint text should still read clearly on white and soft gradients
- avoid pale gray helper text that disappears into daytime surfaces

### Shared Rule
Never place:
- long body copy
- dense labels
- technical chart values

directly on decorative gradients without a stable surface.

Text should sit on:
- cards
- panels
- controlled overlays

not on raw atmospheric backgrounds.

---

## Accessibility / Contrast Guidance

### Primary text
Must always be readable on:
- card surfaces
- nav surfaces
- modal surfaces
- auth and onboarding panels

### Muted text
Can be softer, but should still be clearly legible for:
- secondary explanations
- paragraph support copy
- metadata

### Faint text
Use only for:
- small labels
- timestamps
- non-critical metadata

Do not use faint text for:
- primary actions
- important warnings
- instructional copy

### Decorative text styles
Gradient text and gold-highlight text are for:
- hero emphasis
- metrics
- small moments of delight

They should not become the default readable text layer.

---

## Screen-Level Type Guidance

### Landing
- strongest use of hero serif
- body copy should stay short and warm

### Auth
- large serif emotional prompt
- form labels and inputs stay clean sans

### Onboarding
- serif for each major question title
- sans for helper guidance and option text

### Discover
- profile name can be large and expressive
- insight copy should stay compact and readable

### Matches
- serif for match names and major score moments
- sans for previews and metadata

### Chat
- keep conversation body mostly sans
- use serif very sparingly in headers or special result cards

### Kundali
- serif for major reading sections
- sans for planetary data, house data, and interpretation details

### Profile
- serif for name and major headings
- sans for bio, attributes, and stats

### Settings
- mostly sans
- clarity over romance

---

## What Should Feel Emotional vs Functional

### Emotional layer
Use display serif for:
- attraction
- identity
- romance
- interpretation
- special moments

### Functional layer
Use UI sans for:
- input
- navigation
- scanning
- dense reading
- settings
- status

This split is important.
It keeps Tara expressive without sacrificing usability.

---

## Live Implementation Mapping

Typography tokens and classes now exist in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

This allows future screens to migrate toward:
- reusable hero/page/section/card/body/helper scale
- consistent rhythm
- stronger readability in both day and night themes

---

## Phase 3 Exit Criteria

Phase 3 is complete when:
1. display and UI font roles are locked
2. the type scale is defined
3. line-height rules are defined
4. readability and contrast guidance is clear
5. the CSS token layer can support screen-by-screen rollout

---

## Recommended Next Phase

Proceed to:
- `Phase 4: Background World-Building`
- `Phase 5: Motion System`
- then apply typography screen by screen during implementation

