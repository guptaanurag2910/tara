# Phase 13: Performance System

## Goal
Keep Tara atmospheric and expressive without turning the app shell into a heavy first load or making mobile repaint work harder than it needs to.

## Performance Rules

### 1. Keep Background Effects Lightweight
- Decorative atmosphere should live in CSS background layers and pseudo-elements, not extra animated DOM trees.
- Reuse a small number of layered gradients, stars, and motif surfaces.
- Use `prefers-reduced-data` and mobile-specific tuning to soften or disable the most expensive decorative treatments.

### 2. Avoid Too Many Animated DOM Nodes
- Prefer a few shell-level animated layers over many independently animated cards or icons.
- Repeated UI such as chips and icon buttons should avoid expensive blur stacks on smaller screens.
- Loading states should mimic layout with a modest number of skeleton blocks rather than large shimmer grids.

### 3. Prefer CSS Transforms / Opacity
- Motion should primarily animate:
  - `opacity`
  - `transform`
  - `background-position`
- Avoid layout-triggering animation for atmospheric motion.
- Mark long-running decorative layers with `will-change` only where they actually animate.

### 4. Lazy-Load Heavier Screens
- Large screens should not ship in the initial route bundle.
- Route modules can stay eager, but page implementations should load through `React.lazy` with a route-appropriate fallback.
- Use themed skeleton or pending states so code splitting does not feel like a blank flash.

### 5. Split Vendor Cost Intentionally
- Keep the router/core app shell stable.
- Split heavy dependencies into separate cacheable chunks where it reduces first-load pressure.
- Avoid shipping infrequently visited screen code on landing/auth routes.

### 6. Mobile Performance
- Reduce decorative blur intensity on smaller screens.
- Keep bottom navigation and composer layers stable while the page content scrolls.
- Validate performance-sensitive layouts through mobile viewport regression, even when physical device testing is not available.

## What This Phase Added
- route-level lazy loading for heavier screens
- themed route fallbacks for lazy-loaded pages
- deferred notification panel loading
- manual vendor chunking in Vite
- reduced-data handling for atmospheric layers
- lighter repeated-control blur treatment on smaller screens

## Success Criteria
- no oversized single application bundle
- core routes still feel responsive
- atmospheric visuals remain present without dominating paint cost
- mobile layout regression remains green
