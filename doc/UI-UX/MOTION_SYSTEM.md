# Tara Motion System

## Phase 5 Goal
Define the shared motion language for Tara so the product feels alive without becoming noisy.

This phase locks:
- atmospheric motion
- UI motion
- interaction motion
- duration and easing tokens
- reduced-motion behavior

It is aligned with the live motion utilities in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)

---

## Motion Principles

### 1. Atmosphere moves slowly
Environmental motion should feel like weather:
- drifting
- shimmering
- pulsing
- breathing

It should never feel busy or attention-seeking.

### 2. Content moves briefly
Cards, panels, modals, and tabs should animate just enough to help orientation.

### 3. Interaction feels responsive
Press, toggle, and expand states should confirm touch without bouncing or snapping harshly.

### 4. Motion respects task density
Dense utility screens should move less than hero or storytelling screens.

### 5. Accessibility is part of the system
Reduced-motion users should still get hierarchy and clarity without ambient movement.

---

## Atmospheric Motion

### Star twinkle
Purpose:
- keep the night scene alive
- add emotional depth without becoming sparkly noise

Behavior:
- subtle opacity variation only
- no flashing
- no fast blinking

### Cloud drift
Purpose:
- give both themes a sense of air and depth
- soften the background without distracting from content

Behavior:
- very slow horizontal drift
- tiny positional movement only

### Moon glow pulse
Purpose:
- make dark mode feel intimate and luminous

Behavior:
- soft opacity breathing
- slight emphasis change, not a spotlight effect

### Sunlight shimmer
Purpose:
- make light mode feel warm and alive

Behavior:
- soft rise/fall in brightness
- no sharp gleam or lens-flare effect

---

## UI Motion

### Card fade-in
Used for:
- dashboard cards
- content sections
- empty-state blocks
- result cards

Behavior:
- fade + small upward settle
- quick enough to feel responsive

### Modal slide-up
Used for:
- bottom sheets
- popups
- in-chat game modal

Behavior:
- fade + vertical rise + slight scale settle
- should feel gentle, not springy

### Tab transition
Used for:
- segmented content changes
- panel swaps
- small view transitions

Behavior:
- short fade + micro vertical shift
- should help orientation without delaying the interface

### Active nav glow
Used for:
- bottom nav active state

Behavior:
- short pulse on activation
- settles into a stable glow
- should feel like a touch of energy, not an ongoing beacon

---

## Interaction Motion

### Button press
Used for:
- primary buttons
- secondary buttons
- icon buttons
- in-chat option buttons

Behavior:
- tiny scale-down and slight downward settle
- returns immediately on release

### Toggle transition
Used for:
- settings switches
- theme toggles

Behavior:
- smooth thumb slide
- smooth background color change
- no abrupt jumps

### Card expand/collapse
Used for:
- detail reveals
- accordion-like content
- insight expansion

Behavior:
- smooth height reveal
- opacity increase on open
- no snapping open/closed

---

## Duration Tokens

### Atmospheric
- `--tara-motion-atmosphere-twinkle: 18s`
- `--tara-motion-atmosphere-drift: 36s`
- `--tara-motion-atmosphere-pulse: 16s`
- `--tara-motion-atmosphere-shimmer: 20s`

These should remain slow and calm.

### UI
- `--tara-motion-ui-fast: 180ms`
- `--tara-motion-ui-medium: 260ms`
- `--tara-motion-ui-slow: 420ms`

Use:
- fast for tabs and tight content
- medium for cards
- slow for modals or emotionally significant panels

### Interaction
- `--tara-motion-interaction-fast: 120ms`
- `--tara-motion-interaction-medium: 180ms`
- `--tara-motion-interaction-slow: 240ms`

Use:
- fast for press feedback
- medium for toggles and hover/active state
- slow for color/background settling

---

## Easing Tokens

### Standard
- `--tara-ease-standard: cubic-bezier(0.22, 1, 0.36, 1)`

Used for:
- card and modal entry
- polished content movement

### Soft
- `--tara-ease-soft: cubic-bezier(0.33, 1, 0.68, 1)`

Used for:
- opacity shifts
- glow changes
- ambient state changes

### Press
- `--tara-ease-press: cubic-bezier(0.2, 0.8, 0.2, 1)`

Used for:
- tap response
- tactile button feedback

### Tab
- `--tara-ease-tab: cubic-bezier(0.16, 1, 0.3, 1)`

Used for:
- tab and panel swaps
- small directional UI changes

---

## Reusable Motion Utilities

### Atmospheric shell motion
The app shell and hero wrappers inherit theme-aware atmosphere:
- star twinkle
- cloud drift
- moon pulse or sunlight shimmer

### UI classes
- `.tara-motion-card-enter`
- `.tara-motion-modal-enter`
- `.tara-motion-tab-enter`
- `.tara-motion-nav-active`

### Interaction classes
- `.tara-motion-pressable`
- `.tara-motion-toggle`
- `.tara-motion-toggle-thumb`
- `.tara-motion-expand`

These are the default building blocks for future screens.

---

## Reduced Motion

### Rule
Reduced motion should remove ambience and shorten transitions without breaking structure.

### What changes
- atmospheric animations stop
- enter animations stop
- interaction transitions collapse to near-instant
- press effects stop scaling

### What remains
- readable hierarchy
- stable active states
- visual clarity
- content order and focus behavior

The app should still feel polished, just calmer and more static.

---

## Where Motion Should Be Strongest

- landing
- auth
- kundali
- empty states
- themed headers

## Where Motion Should Stay Minimal

- chat transcript
- dense forms
- settings
- long lists
- edit flows

---

## Guardrails

### Do
- use slow atmospheric motion
- use quick, clean content entry
- use tactile press feedback
- let motion reinforce hierarchy

### Don't
- bounce large surfaces
- run fast looping decorations
- animate dense text blocks unnecessarily
- create motion that competes with reading

---

## Phase 5 Exit Criteria

Phase 5 is complete when:
1. day and night both have a distinct atmospheric motion layer
2. cards, modals, tabs, and nav have shared motion rules
3. presses, toggles, and expansion states feel consistent
4. durations and easing are tokenized
5. reduced-motion fallback is built into the system
