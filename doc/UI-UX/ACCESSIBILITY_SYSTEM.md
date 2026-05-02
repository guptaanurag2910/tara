# Phase 12: Accessibility System

## Goal
Keep Tara atmospheric without sacrificing clarity, focus visibility, motion comfort, or tap usability.

## Accessibility Rules

### 1. Contrast
- Primary text must sit on stable high-contrast surfaces in both `Day` and `Night`.
- Helper text can soften, but it should remain readable against cards, gradients, and overlays.
- Success, warning, destructive, and info states use semantic tokens instead of hardcoded per-screen colors.

### 2. Text Over Atmosphere
- Decorative atmosphere belongs behind content, never behind dense copy blocks without a surface.
- Inputs, list rows, modals, and edit panels should use card or input surfaces before decorative overlays.
- Gradient hero text can remain expressive, but interactive and informational text should use solid theme tokens.

### 3. Focus Visibility
- Keyboard focus should be obvious in both themes.
- Shared controls use:
  - `--tara-focus-ring`
  - `--tara-focus-ring-soft`
  - `--tara-focus-ring-strong`
- Focus treatment should be visible on:
  - buttons
  - chips used as actions
  - icon buttons
  - links used as actions
  - inputs
  - textareas
  - tabs, toggles, selects, switches

### 4. Input Readability
- Form fields should not rely on `focus:outline-none` alone.
- Inline fields inside cards need a quiet resting state and a stronger focus state.
- Date inputs should follow the active browser color scheme:
  - dark theme -> `color-scheme: dark`
  - light theme -> `color-scheme: light`

### 5. Reduced Motion
- Atmospheric animation should collapse safely when `prefers-reduced-motion: reduce` is enabled.
- Page reveal, card motion, button press motion, and decorative background motion should all resolve to near-instant transitions.

### 6. Touch Targets
- Primary mobile tap targets should be at least `44px`.
- This applies especially to:
  - chips used as buttons
  - icon buttons
  - inline action links
  - shared button variants
  - search and compose inputs

## Components Covered In This Phase
- shared CSS control layer in `index.css`
- auth form controls
- chat search and composer controls
- onboarding name/photo actions
- profile edit controls
- location search and location result picker
- shared Radix-based controls

## Intent
Tara should still feel poetic, but never at the cost of legibility, keyboard navigation, or mobile usability.
