# Tara Shared UI Components

## Phase 7 Goal
Make the shared component layer feel intentional in both day and night themes.

This phase aligns:
- app shell
- page containers
- cards and surfaces
- buttons
- inputs
- modals
- bottom navigation
- badges and chips
- skeleton loaders
- empty states

It is grounded in:
- [frontend/src/styles/index.css](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/styles/index.css)
- [frontend/src/routes/__root.jsx](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/routes/__root.jsx)

---

## Core Principle

Shared components should not feel like theme-colored placeholders.
They should feel like they belong to the same product world in both moods.

That means:
- surfaces inherit the theme atmosphere
- spacing stays calm and readable
- controls feel tactile
- utility screens remain clean

---

## App Shell

### Shared responsibility
The app shell provides:
- atmospheric background
- scroll container behavior
- bottom-safe padding
- top-level text color

### Shared classes
- `.tara-app-shell`
- `.tara-app-scroll`

These should be used instead of repeating raw viewport/overflow layout strings on the root.

---

## Page Containers

### Shared classes
- `.tara-page-shell`
- `.tara-page-shell-compact`
- `.tara-page-stack`

### Usage
- standard app tabs and immersive screens use `.tara-page-shell`
- edit and settings flows use `.tara-page-shell-compact`

The goal is to keep content width and screen rhythm consistent across features.

---

## Cards And Surfaces

### Shared surfaces
- `.tara-card`
- `.tara-card-strong`
- `.tara-skeleton-surface`
- `.tara-modal-surface`

### Rules
- normal cards use soft elevation
- stronger panels use a slightly denser surface
- modals and floating panels use the strongest shared surface layer

These surfaces should feel related across:
- profile
- kundali
- settings
- chat overlays
- notification drawers

---

## Buttons

### Shared behavior
Buttons should:
- use consistent press feedback
- feel tactile
- remain legible in both themes

### Shared patterns
- `tara-primary-btn`
- `tara-secondary-btn`
- `.tara-motion-pressable`

### Rule
Primary buttons carry the aurora gradient.
Secondary buttons stay surface-based and calm.

---

## Inputs

### Rule
Inputs should not disappear into the background in light mode or become flat outlines in dark mode.

They should use:
- the shared input surface
- shared border color
- shared focus ring
- readable placeholder contrast

---

## Modals

### Shared behavior
All modal-like surfaces should use:
- `.tara-overlay-surface`
- `.tara-modal-surface`
- shared modal-entry motion

### Outcome
Dialogs, sheets, and custom popups should feel part of the same layered world instead of each using their own backdrop recipe.

---

## Bottom Navigation

### Shared behavior
The bottom nav should feel:
- grounded
- glassy
- premium
- consistent with both themes

It should not feel detached from the rest of the surface system.

### Active state
The active tab should use:
- shared glow language
- stable contrast
- subtle motion

---

## Badges And Chips

### Shared classes
- `.tara-chip`
- `.tara-chip-accent`
- `.tara-chip-gold`

### Rule
Chips should:
- feel like mini surfaces
- keep rounded warmth
- use accent sparingly

They should be usable for:
- filters
- tags
- icebreakers
- status pills
- badge-style metadata

---

## Skeleton Loaders

### Shared classes
- `.tara-skeleton-block`
- `.tara-skeleton-surface`

### Rule
Skeletons should:
- mimic final layout shape
- shimmer softly
- inherit theme tone
- never look like unrelated gray placeholders

In dark mode, they should glow subtly.
In light mode, they should feel sunlit and gentle.

---

## Empty States

### Shared classes
- `.tara-empty-state`
- `.tara-empty-title`
- `.tara-empty-copy`

### Rule
Empty states should feel supportive, not dead.

They should always provide:
- a clear state
- a calm explanation
- one obvious next step

And they should sit on a real themed surface, not a generic alert box.

---

## Intentional Cross-Theme Behavior

### Night
Shared components should feel:
- luminous
- intimate
- softly layered

### Day
Shared components should feel:
- airy
- polished
- lightly sunlit

The structure stays the same.
Only the mood of the surfaces changes.

---

## Guardrails

### Do
- use shared surface classes
- use chip classes for pill-like actions
- use theme-aware skeleton and empty-state surfaces
- keep utility UI readable first

### Don't
- hardcode `slate-900/60` style values for reusable components
- let one component invent its own modal surface if a shared one exists
- use generic gray skeletons against themed pages
- make light mode feel unfinished compared to dark mode

---

## Phase 7 Exit Criteria

Phase 7 is complete when:
1. app shell and page wrappers are shared and consistent
2. buttons, inputs, and modals use the shared theme language
3. chips and badges feel intentional in both themes
4. skeletons and empty states inherit the same world as the rest of the app
5. shared components no longer rely on random hardcoded dark-only utility colors
