# Tara Color System

## Phase 2 Goal
Define the core color tokens for Tara's two-theme world:
- `Night` = starlit, intimate, mystical
- `Day` = sunlit, airy, hopeful

This document locks:
- theme token roles
- dark and light palette values
- semantic colors
- core gradients
- nav and card states

It is aligned with the live CSS variable system in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

---

## System Principles

### 1. Background carries the story
The mood should come from:
- scene gradients
- ambient glow
- sky depth
- subtle atmosphere

### 2. Surfaces carry the product
Cards, forms, nav, and data surfaces must remain readable and stable.

### 3. Accent is precious
Gold and glow are not default fill colors.
They are used to:
- signal importance
- highlight active state
- create a premium emotional accent

### 4. Day and night are siblings
They should feel like the same product in different light, not two unrelated skins.

---

## Token Naming Model

### Core color tokens
- `--tara-color-bg`
- `--tara-color-surface`
- `--tara-color-card`
- `--tara-color-border`
- `--tara-color-text`
- `--tara-color-text-muted`
- `--tara-color-text-faint`
- `--tara-color-accent-glow`
- `--tara-color-gold`

### Supporting environment tokens
- `--tara-color-sky`
- `--tara-color-cloud`
- `--tara-color-cream`
- `--tara-color-soft-blue`
- `--tara-shadow-warm`

### Semantic tokens
- `--tara-color-success`
- `--tara-color-success-soft`
- `--tara-color-warning`
- `--tara-color-warning-soft`
- `--tara-color-destructive`
- `--tara-color-destructive-soft`
- `--tara-color-info`
- `--tara-color-info-soft`

### Gradient tokens
- `--tara-gradient-night-sky`
- `--tara-gradient-moon-glow`
- `--tara-gradient-dawn`
- `--tara-gradient-sunlight`

### State tokens
- `--tara-nav-icon`
- `--tara-nav-icon-active`
- `--tara-nav-label`
- `--tara-nav-label-active`
- `--tara-card-hover-border`
- `--tara-card-hover-glow`
- `--tara-card-active-border`
- `--tara-card-active-glow`

---

## Night Theme Tokens

### Emotional Goal
Night should feel:
- intimate
- celestial
- soft-glowing
- private
- emotionally deep

### Core Palette

| Role | Token | Value | Meaning |
|---|---|---:|---|
| Background | `--tara-color-bg` | `#070432` | Deep midnight base |
| Surface | `--tara-color-surface` | `rgba(11, 7, 49, 0.84)` | Main atmospheric layer |
| Card | `--tara-color-card` | `rgba(13, 11, 54, 0.92)` | Elevated content surface |
| Border | `--tara-color-border` | `rgba(70, 78, 136, 0.34)` | Soft celestial edge |
| Primary text | `--tara-color-text` | `#f3f0ea` | Moonlit readable text |
| Muted text | `--tara-color-text-muted` | `#8f91af` | Secondary copy |
| Faint text | `--tara-color-text-faint` | `#74769a` | Labels and helper text |
| Accent glow | `--tara-color-accent-glow` | `#6f63f7` | Indigo-violet active energy |
| Gold highlight | `--tara-color-gold` | `#e2b54f` | Ritual / premium accent |

### Supporting Environment

| Role | Token | Value | Meaning |
|---|---|---:|---|
| Night sky | `--tara-color-sky` | `#120846` | Upper-sky tint |
| Cloud haze | `--tara-color-cloud` | `rgba(242, 240, 255, 0.12)` | Ambient mist / atmospheric fog |
| Moon cream | `--tara-color-cream` | `#f3f0ea` | Soft luminous neutral |
| Soft blue | `--tara-color-soft-blue` | `#9eaef8` | Star / moon edge lighting |
| Shadow | `--tara-shadow-warm` | `0 18px 55px rgba(0, 0, 0, 0.34)` | Depth for floating surfaces |

---

## Day Theme Tokens

### Emotional Goal
Day should feel:
- bright
- calm
- warm
- breathable
- fresh

### Core Palette

| Role | Token | Value | Meaning |
|---|---|---:|---|
| Background | `--tara-color-bg` | `#edf4ff` | Soft open-sky base |
| Surface | `--tara-color-surface` | `rgba(255, 250, 244, 0.92)` | Sunlit app layer |
| Card | `--tara-color-card` | `rgba(255, 255, 255, 0.94)` | Bright content surface |
| Border | `--tara-color-border` | `rgba(124, 131, 189, 0.26)` | Cool warm-balanced edge |
| Primary text | `--tara-color-text` | `#212850` | High-contrast readable navy |
| Muted text | `--tara-color-text-muted` | `#4a5180` | Secondary copy |
| Faint text | `--tara-color-text-faint` | `#69709e` | Labels and helper text |
| Accent glow | `--tara-color-accent-glow` | `#6f5be8` | Warm-violet brand continuity |
| Gold highlight | `--tara-color-gold` | `#c69232` | Sun-touched premium accent |

### Supporting Environment

| Role | Token | Value | Meaning |
|---|---|---:|---|
| Day sky | `--tara-color-sky` | `#e7efff` | Main atmospheric sky |
| Cloud white | `--tara-color-cloud` | `rgba(255, 255, 255, 0.86)` | Cloud and highlight surface |
| Cream | `--tara-color-cream` | `#fff8ef` | Warm paper-like softness |
| Soft blue | `--tara-color-soft-blue` | `#d9e7ff` | Airy UI highlight |
| Warm shadow | `--tara-shadow-warm` | `0 12px 34px rgba(59, 66, 122, 0.16)` | Gentle daytime depth |

---

## Semantic Colors

These should stay emotionally consistent across both themes.

### Success
- use for saved state, positive completion, green guidance
- dark: `#63d9a6`
- light: `#1f9d63`

### Warning
- use for caution, temporary blockers, subtle astrological watch-outs
- dark: `#f1c463`
- light: `#c98b24`

### Destructive
- use for delete, auth failure, severe validation, blocked actions
- dark: `#fb7185`
- light: `#d84d67`

### Info
- use for hints, status guidance, neutral technical feedback
- dark: `#74b9ff`
- light: `#3d7ee8`

### Soft semantic backgrounds
Use the `-soft` versions for:
- pill backgrounds
- toast surfaces
- inline alerts
- status banners

Never use raw semantic colors as large full-screen backgrounds.

---

## Gradient Definitions

### Night Sky Gradient
Token:
- `--tara-gradient-night-sky`

Role:
- main dark-mode app world
- landing, auth, kundali, and main shell background

Feeling:
- celestial depth
- vertical atmosphere
- emotional gravity

### Moon Glow Gradient
Token:
- `--tara-gradient-moon-glow`

Role:
- hero halo
- decorative layer behind major cards
- selective dark-mode spotlight effect

Feeling:
- luminous, soft, private

### Dawn Gradient
Token:
- `--tara-gradient-dawn`

Role:
- main light-mode world
- page background for light mode

Feeling:
- sunrise, openness, emotional freshness

### Sunlight Gradient
Token:
- `--tara-gradient-sunlight`

Role:
- hero halo
- light-mode decorative emphasis
- onboarding/landing/auth polish

Feeling:
- warm, uplifting, soft sunlight

---

## Nav States

### Shared rule
The nav should feel like a grounded floating control bar, not a bright toolbar.

### Night Nav
- shell: translucent dark glass
- active pill: aurora gradient or indigo-to-gold glow
- active icon: white
- inactive icon: faint muted indigo-gray
- active label: primary text
- inactive label: faint text

### Day Nav
- shell: cloud-white glass
- active pill: soft violet-gold aura
- active icon: white
- inactive icon: soft muted blue
- active label: readable navy
- inactive label: faint blue-gray

### Tokens used
- `--tara-nav-bg`
- `--tara-nav-pill`
- `--tara-nav-icon`
- `--tara-nav-icon-active`
- `--tara-nav-label`
- `--tara-nav-label-active`

---

## Card States

### Base card
Should feel:
- elevated
- readable
- touch-friendly
- themed but calm

### Hover / focus card
Should add:
- slightly stronger border
- subtle glow
- no harsh brightness jump

### Active / selected card
Should add:
- gold-touched emphasis
- stronger border presence
- refined glow, not neon

### Tokens used
- `--tara-card-bg`
- `--tara-card-bg-strong`
- `--tara-card-border`
- `--tara-card-hover-border`
- `--tara-card-hover-glow`
- `--tara-card-active-border`
- `--tara-card-active-glow`

---

## Usage Rules

### Gold usage
Use gold for:
- active important highlights
- section kickers
- premium emphasis
- progress and guidance accents

Do not use gold for:
- large paragraphs
- default buttons everywhere
- every border and every icon simultaneously

### Violet usage
Use violet for:
- brand energy
- active states
- glows
- theme continuity between day and night

### Cream usage
Use cream for:
- soft text accents
- warm daytime supporting tones
- elevated light-mode emotional softness

### Sky and cloud usage
Use them in:
- backgrounds
- empty states
- hero atmospherics
- very light supporting surfaces

Do not let them reduce text contrast.

---

## Live Implementation Mapping

Already added to the app token layer in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

This means future phases can implement:
- backgrounds
- nav polish
- cards
- illustrations
- themed loaders
- empty states

without redefining token semantics.

---

## Phase 2 Exit Criteria

Phase 2 is complete when:
1. both themes have locked token roles
2. semantic states are defined
3. gradients are approved
4. nav and card state behavior is defined
5. the CSS token layer can support future visual rollout without renaming

---

## Recommended Next Phase

Proceed to:
- `Phase 3: Typography System`
- `Phase 4: Background World-Building`
- `Phase 5: Motion System`

