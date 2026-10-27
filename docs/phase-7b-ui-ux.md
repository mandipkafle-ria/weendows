# Phase 7B — Widget Studio and interface refresh

Status: planned before implementation. Phase 8 must not start until this phase is complete.

## Goal

Replace the functional but generic settings UI with a focused desktop control center, and make widget choice visual. Users should be able to browse widgets by category, see a real live preview, choose a design variant, and add it without guessing what it will look like. The same pass fixes transparency artifacts at rounded corners and adds app-local cursor and accent choices.

## Principles

- Desktop-first: dense but calm, 880 x 620 target, usable at 720 x 520.
- Real previews: render the same builtin HTML used on the desktop, not screenshots or mock cards.
- One job per screen: the widgets arena is browse -> preview -> choose -> add.
- Quiet chrome: neutral surfaces, one accent, strong typography, restrained motion.
- Accessibility: keyboard reachable, visible focus, 4.5:1 text contrast, reduced-motion support.
- No web fonts or remote assets: keep the app offline and CSP-safe.

## Phases

### 7B.1 Design foundation and app shell

- Introduce design tokens for surfaces, text, borders, radii, spacing, shadows, accent colors, and motion.
- Replace the top tab strip with a fixed sidebar: brand, grouped navigation, appearance hint, version/footer.
- Build shared primitives: buttons, icon buttons, chips, segmented control, toggle, select, field, empty state, toast.
- Restyle all settings panels with the same hierarchy and spacing.
- Add a mobile/short-window fallback that keeps navigation usable.
- Acceptance: every existing control remains reachable and functional; focus states are visible; light and dark themes both hold up.

### 7B.2 Widget catalog and variant model

- Add `category` and `variants` to every builtin definition, including dimensions, labels, and descriptions.
- Add optional `variant` to widget manifests with default fallback for existing widgets.
- Add variant selection when adding a widget and when changing an installed widget.
- Validate variant IDs in main-process IPC and widget service; reject unknown values.
- Apply variant dimensions on first add; preserve user size when switching variants, clamped to new minimums.
- Acceptance: existing layouts still load; variants persist across restart; unknown variants fall back safely.

### 7B.3 Live widget gallery

- Serve builtin HTML from a reserved `widget://_builtins/` host rooted at `resources/builtin-widgets`.
- Add `frame-src widget:` to the settings CSP.
- Build a preview bridge that answers the widget SDK handshake (`hl-init`) with MessageChannel.
- Supply realistic demo data: system stats from the main sampler, demo battery, sample notes, weather, and app-grid data. Keep preview storage isolated and in-memory.
- Rebuild the widgets screen as a studio:
  - category rail/chips and search;
  - responsive gallery of live previews;
  - selected-widget detail with design variants;
  - add action and desktop widget manager (enable/disable, opacity, remove, design).
- Show live previews for installed and saved AI widgets where safe; use a locked placeholder for AI widgets that cannot preview.
- Acceptance: previews animate, resize from their viewBox, never navigate, and do not leak desktop widget state.

### 7B.4 Builtin widget redesigns

- Give each family multiple intentional designs sharing accessible structure:
  - Clock: Classic, Minimal, Neon, Analog, Terminal.
  - Date: Classic, Editorial, Minimal.
  - Calendar: Grid, Compact, Paper.
  - System: Dots, Bars, Rings, Terminal.
  - Battery: Ring, Bar, Minimal.
  - Notes: Warm, Paper, Slate.
  - Weather: Classic, Compact, Station.
  - App grid: Classic.
- Use system font stacks and the bundled DotGothic16 where appropriate.
- Keep each widget self-contained and CSP-safe.
- Acceptance: all variants render at their advertised sizes, update their data correctly, and remain legible.

### 7B.5 Corners and opacity

- Remove native window opacity; apply opacity to the widget frame in CSS so transparent window corners stay transparent.
- Replace outer borders and outer glow fringes with inset rings and `background-clip: padding-box`.
- Ensure widget HTML itself never paints an opaque rectangle outside its card.
- Acceptance: corners are fully transparent, no light seam appears, opacity changes do not square off corners.

### 7B.6 Accent and cursor packs

- Add persisted accent choice: Ember, Violet, Teal, Rose.
- Add persisted app cursor packs: System, Dot, Neon, Pixel. Apply inside settings and widget edit chrome only by default.
- Add an explicit Windows-only opt-in to apply the normal pointer across the desktop; keep text, hand, and resize cursors native and restore the Windows scheme on disable or quit.
- Respect reduced motion and keep native text cursors for editable fields.
- Acceptance: choices apply immediately across open windows and survive restart; the system-wide option restores the previous Windows pointer when disabled or when HomeLayer exits.

### 7B.7 Verification and documentation

- Add unit tests for variant validation, builtin host path safety, and manifest persistence.
- Update decisions and add manual verification notes.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Acceptance: all checks green; Phase 8 not started.

## Technical notes

- Preview iframes use `sandbox="allow-scripts"` and the same protocol as widgets.
- The settings renderer owns the preview bridge; main owns data and mutation.
- A preview is read-only: storage operations are local to the preview bridge and never touch disk.
- The preview iframe URL is `widget://_builtins/<type>/index.html?variant=<id>&preview=1`; installed widgets use `widget://<id>/index.html?variant=<id>&preview=1`.
- Variant IDs are stable lowercase slugs. Display names are translated in the renderer.
- Do not introduce remote fonts, images, analytics, or new runtime dependencies.
