# Tara Theme Toggle And Persistence

## Phase 6 Goal
Define how Tara chooses, applies, stores, and preserves theme preference across the app lifecycle.

This phase locks:
- theme choice priority
- app-level theme state ownership
- storage strategy
- transition behavior
- refresh and auth persistence behavior

It is aligned with the live implementation in:
- [frontend/src/services/settingsService.js](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/services/settingsService.js)
- [frontend/src/context/ThemeContext.jsx](/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/mm/tara/frontend/src/context/ThemeContext.jsx)

---

## Decision: How Theme Is Chosen

Tara uses this priority order:

1. `Saved user preference`
   - if a logged-in user has already chosen `Day`, `Night`, or `System`, that preference wins

2. `Last explicit local preference`
   - if no user-specific preference exists yet, the app uses the last locally saved appearance mode on this device

3. `System default`
   - if nothing has been chosen yet, Tara follows the device appearance

This gives the app a predictable hierarchy without losing the warmth of a remembered choice.

---

## Preference Modes

### Day
- forces the light theme
- emotionally reads as sunlit and hopeful

### Night
- forces the dark theme
- emotionally reads as starlit and intimate

### System
- follows the device
- automatically updates if the device changes between light and dark

---

## State Ownership

Theme is not page-local.
It is managed at the application level through a dedicated theme provider.

That provider is responsible for:
- reading the correct preference on boot
- resolving `system` into `light` or `dark`
- updating the document theme state
- syncing changes when auth state changes
- keeping settings UI in sync with the actual active mode

This avoids split-brain behavior between:
- local storage
- page state
- auth transitions
- document theme attributes

---

## Storage Strategy

### Global local preference
Stored in:
- `tara_appearance_mode_v1`

Purpose:
- lets the app boot in the correct mood before the full UI mounts
- lets logged-out users keep their last chosen mode

### User settings preference
Stored inside:
- `tara_user_settings_v1:<userId>`

Purpose:
- remembers the user’s chosen appearance mode on this device
- allows different users on the same device to keep their own saved appearance mode

---

## Document Theme Application

When a theme mode is applied, Tara updates:
- `data-appearance` on the root element for the chosen mode
- `data-theme` on the root element for the resolved visual theme
- `color-scheme` for native control styling
- the browser `theme-color` meta tag

This keeps:
- CSS variables
- browser UI tint
- native inputs
- system-mode handling

all aligned.

---

## Clean Day/Night Transition

Theme switching should feel like a mood shift, not a flash.

### Transition rule
The app animates:
- background layers
- glass and card surfaces
- borders and shadows
- atmospheric opacity
- foreground color changes

### Transition character
- soft
- brief
- cinematic
- not theatrical

### Important note
The transition should suggest sky and light changing around the product, not content physically moving.

---

## Refresh Behavior

On refresh:
- the saved appearance mode is applied before React mounts
- the shell keeps the correct day/night state
- there is no return to a default theme flash

This is important because Tara’s theme is part of the emotional identity, not an afterthought.

---

## Login / Logout Behavior

### On login
- if the user has a saved appearance mode, it is applied
- if they do not, the app keeps the current local mode until they choose otherwise

### On logout
- the current mode remains visible
- the app falls back to the last locally saved preference for logged-out state

This means users do not get jolted back to an unrelated theme just because auth changed.

---

## Cross-Tab / Cross-Window Sync

Theme changes should propagate across tabs by listening to storage and theme-change events.

That keeps:
- settings page
- app shell
- multiple open sessions

consistent on the same device.

---

## Reduced Motion

Theme switching must respect reduced-motion users.

For those users:
- the final theme still changes correctly
- the transition becomes near-instant
- no atmospheric animation is required to understand the change

---

## UI Interpretation

### Settings screen
The theme controls should show:
- `Day`
- `Night`
- `System`

And the screen should also communicate the currently resolved mode, so users understand what they are seeing right now.

### App shell
The rest of the app should simply inherit the active theme.
No individual page should manage theme separately.

---

## Guardrails

### Do
- keep theme selection centralized
- let saved user preference win when present
- keep logout visually stable
- animate theme shifts softly
- use system mode as the true default

### Don't
- store theme only in a page component
- let login unexpectedly reset theme
- let refresh flash the wrong theme first
- make day/night transitions noisy or slow

---

## Phase 6 Exit Criteria

Phase 6 is complete when:
1. users can choose `Day`, `Night`, or `System`
2. the app resolves and applies the correct visual theme globally
3. theme survives refresh
4. theme remains coherent through login and logout
5. the transition feels intentional and reduced-motion safe
