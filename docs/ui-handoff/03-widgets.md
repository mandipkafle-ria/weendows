# 03 — Widgets

**Sources:** `WidgetsPanel.tsx`, `WidgetCatalog.tsx`, `WidgetCategoryPage.tsx`,
`WidgetCustomizeSheet.tsx`, `WidgetPreview.tsx`, `src/shared/builtins.ts`,
`src/shared/appearance.ts`
**Styles:** `main.css` — `.studio*`, `.view-tabs`, `.catalog-*`, `.category-*`,
`.widget-preview*`, `.customize-*`, `.variant-*`, `.desktop-*`, `.saved-*`,
`.permission-*`, `.runtime-badge`, `.empty-state`

## 1. Purpose

The Widgets tab is the product's core. It has three jobs:

1. **Discover** built-in widget designs (Browse + category pages).
2. **Configure** a design before or after adding it (live preview + customize sheet).
3. **Manage** what is on the desktop (show/hide, lock, theme, opacity, permissions,
   duplicate, reload, remove) and revisit saved AI-generated widgets.

## 2. Current information architecture

```
Widgets
Browse live designs, then manage what is on your desktop.      ● Running  v1.4.2
──────────────────────────────────────────────────────────────────────────────
[ Browse ] [ On desktop 3 ] [ Saved 1 ]        Ctrl+Alt+E for edit layout  [Edit layout]
──────────────────────────────────────────────────────────────────────────────
BROWSE (default)
  [ Search by name or style…                          ] [Create with AI]
  TIME (3)                                                         See all 3 →
   ┌ card ┐ ┌ card ┐ ┌ card ┐
   │ live │ │ live │ │ live │   ← horizontal row, up to 4; only first variant each
   │Classic│ │Classic│ │ Grid │
   │Clock  │ │Date   │ │Calendar│
   │ Customize   Add │ …
  SYSTEM (2) …
  FOCUS (1) …
  AMBIENT (1) …
  APPS (1) …

CATEGORY PAGE (after "See all")
  ← Back to widgets
  Time                                                      [ search… ]
  30 designs
  [All] [Digital] [Clean] [Analog] [Neon] [Terminal] [Monospace] …
   ┌ variant card ┐ ┌ variant card ┐ ┌ variant card ┐ ┌ variant card ┐
   │ live preview │ │              │ │              │ │              │
   │ Classic      │ │ Minimal      │ │ Neon         │ │ Analog       │
   │ Clock · 240×140            Customize  Add      │
   …
   ┌ AI card: + Create with AI ┐

ON DESKTOP
  On the desktop                          [Sort by RAM] [+ Add widget]
  Control visibility, placement and permissions…
  ┌ 144px thumb ┬ Clock  ● running (CPU/RAM) ────────────────────────────┐
  │              │ Built-in · 240×140 · Hidden?        [CPU 0.4% · 12 MB]│
  │  live preview│ Design [Classic v] Theme [Auto v] Opacity [100% v]   │
  │              │ [Show/Hide] [Lock]                                 │
  │              │ ▸ 2 permissions                                    │
  │              │ [Customize] [Duplicate] [Reload] [Edit with AI] [Remove]
  └──────────────┴──────────────────────────────────────────────────────┘

SAVED (AI generated)
  1 saved
  ┌ live preview ┐ ┌ live preview ┐
  │ Name         │ │ Name         │
  │ 320×220 · date                                   [Add copy] [Delete]
  │ prompt…      │
```

## 3. Shared view chrome

| Element | Copy | Behaviour |
|---|---|---|
| View tabs | **Browse**, **On desktop {n}**, **Saved {n}** | Local view state; no routing |
| Shortcut pill | `{hotkey}` + **for edit layout** | Display only |
| Edit layout button | **Edit layout** / **Finish editing** | Global `setEditMode`; toast on/off |
| Counts | On desktop = placements; Saved = saved AI manifests | |

Edit-mode copy elsewhere: **Edit mode adds a dashed border and resize handle to every
widget. Drag to move; hold Alt while dragging to bypass edge magnetism. Locked widgets
cannot be moved.** Toasts: **Edit mode is on. Drag or resize any widget.** /
**Edit mode is off.**

## 4. Catalog (Browse)

### Data and grouping

`BUILTIN_WIDGETS` has **8 types / 30 variants**:

| Type | Category | Variants (default dimensions) | Permissions |
|---|---|---|---|
| Clock | time | classic 240×140, minimal 300×120, neon 300×160, analog 240×240, terminal 300×160 | — |
| Date | time | classic 240×140, editorial 320×200, minimal 240×120 | — |
| Calendar | time | grid 280×300, compact 280×210, paper 300×320 | — |
| System | system | dots 240×160, bars 280×180, rings 260×190, terminal 300×180 | `system.stats` |
| Battery | system | ring 240×160, bar 280×120, minimal 240×100 | `system.battery` |
| Notes | focus | warm 280×220, paper 300×240, slate 280×200 | `storage` |
| Weather | ambient | classic 300×220, compact 280×140, station 320×240 | `network`, `storage`; hosts Open-Meteo |
| Apps | apps | classic 384×280, monochrome, glass, cyberpunk 396×288, minimal 360×240, retro | `launch`; edit passthrough |

Categories are ordered `time, system, focus, ambient, apps` (`WIDGET_CATEGORIES`), and
empty categories are hidden. Each section shows only the **first variant** of up to 4
types, with a horizontal, scrollable row. Cards show:
- preview (interactive disabled; pointer events off),
- count badge `{n} on desktop` if any placement of that type exists,
- title as `{variant name} {catalog name}` (e.g. "Classic Clock"),
- meta `{width} × {height} · {category}`,
- one-line description from `widgets.catalog.{type}.body`,
- actions **Customize** (quiet) and **Add** (primary); clicking the preview also opens
  Customize.

Global search filters built-in **types** by catalog name, description, or type id; it
does not search variant names or tags. Section "See all {count}" counts types, while
the category page counts variants ("30 designs" for Time), which reads inconsistent.

Empty search result: **Nothing matches that search** / **Try a different name or choose
another category.**

Safe mode: the **Add** button is disabled with tooltip **Start normally before showing
hidden widgets or adding new ones.** Customize remains enabled.

## 5. Category page

- Header: **← Back to widgets**, category title, `{n} designs`, search field, and tag
  chips derived from every variant's tags in that category (sorted alphabetically),
  starting with **All**. Tag labels come from `widgets.tags.*`.
- Grid of variant-level cards (4 columns at full width). Each card:
  - preview,
  - `{count} on desktop` badge (count is per type, not per variant — a known
    inconsistency),
  - heading = variant name only,
  - meta = catalog name · width × height,
  - **Customize** / **Add**.
- An "AI card" is always appended to the grid: large `+`, **Create with AI**, and
  **Describe a widget and let the studio design it.**
- Search here includes type name, variant name, and description; no clear button and
  no search icon. Tag and search filters combine.
- No-results state is shown in the grid, but the AI card remains.
- The page is not routed; switching top-level views or tabs discards category, filters,
  and search.

## 6. Live preview (`WidgetPreview`)

A scaled, sandboxed iframe of the real built-in or AI widget:

- `widget://_builtins/{type}/index.html?variant=…&preview=1`
  or `widget://{id}/index.html?…`.
- `sandbox="allow-scripts"`, `loading="lazy"`, `title`.
- Outer box keeps the widget aspect ratio; inner stage is the exact pixel size and is
  translated/scaled with `ResizeObserver`.
- A MessageChannel bridge answers widget API calls with demo data:
  - `system.getStats` — real preview stats when available, otherwise demo (24% CPU,
    16 GB, 58%, uptime); cached 2 s.
  - battery 82% charging; storage in-memory; weather returns Lisbon, 21 °C, partly
    cloudy; apps list of 6 demo apps; app-grid state with one "Utilities" bundle.
  - launch/openLink are no-ops; anything else is rejected as unavailable in preview.
- Optional appearance token created by main (`createWidgetPreview`) and released on
  cleanup; the iframe stays `about:blank` until the token exists.
- `interactive` enables pointer events and tab focus; used only in the customize sheet.
- Preview is presentation only. It does not save or mutate anything.

## 7. Customize sheet

A right-side sheet over the catalog (keeps context visible behind a blurred
backdrop). Width ~920 px / 94vw; split into a **340 px preview pane** and a scrollable
control column; footer with Cancel / primary.

Header: eyebrow **New widget** or **Edit widget**, title = widget name or
`{Variant} {Widget}`, close `×`.

Preview pane: current variant tag + dimensions; live interactive preview on a dark
stage with the appearance applied; footer dot + **Live preview. Changes apply when you
save.**

Controls, in order:
1. **Design** — text pills for every variant (no thumbnails, no dimensions).
2. **Widget theme** — Auto / Dark / Light.
3. **Background** — Solid / Blur / None; Colour picker (clear = Auto); Opacity
   0–100%; Blur 0–20 px (only in Blur mode; moving it forces Blur).
4. **Background image** — Add image (native picker → data URL), Clear image, fit
   Cover / Contain / Tile (disabled without image or when background is None). Adding
   an image forces `bgStyle: 'solid'`.
5. **Shape** — Corners 0–64 px; Border opacity 0–100%; Border colour picker
   (clear = default); Content opacity 0–100%.
6. **Window** — only when editing an existing widget: overall window opacity 20–100%.

Save:
- New: `addWidget(type, variant, appearance)` then toast **{design} {name} added to
  your desktop.**
- Existing: `setWidgetAppearance`, `setWidgetOpacity`, and `setWidgetVariant` if
  changed; toast **{name} updated.**
- Escape, backdrop click, and `×` all close immediately with no dirty check. No reset
  or undo. Add image is blocked while loading.

The colour picker is the shared `ColorPicker`: swatch + hex + native colour wheel +
eyedropper + Auto + five filter tabs + 56 swatches. It is rendered twice in the sheet
and takes a large vertical block each time. Its internal labels are hardcoded English.

## 8. On desktop manager

`orderedWidgets` is the placement list, optionally sorted by RAM (live runtime every
2 s). Empty state: **No widgets yet. Add one from the gallery above.** / **Browse the
gallery to add a live widget design.** / **Browse widgets**.

Each `.desktop-card`:
- 144 px preview thumb with a green/gray state dot; preview uses the effective theme,
  appearance, cursor, and asset widget id.
- Name, `Built-in`/`AI`, dimensions, `· Hidden` when disabled.
- Runtime badge: `CPU {x}% · RAM {y} MB` or **Not running**; if disabled, appends
  `Disabled: {reason}` and uses the red variant.
- Controls: **Design** select (built-ins with >1 variant), **Widget theme** (Auto /
  Dark / Light), **Opacity** (100/80/60%, plus current), then **Show/Hide** and
  **Lock/Unlock**.
- Collapsible permissions: `{n} permissions` or **No permissions requested**; each
  permission is a live checkbox (`setWidgetPermission`) with label from
  `permissions.*`; approved hosts are read-only text **Approved hosts: {hosts}**.
- Actions: **Customize** (built-ins), **Duplicate**, **Reload**, **Edit with AI**
  (AI widgets), **Remove** (danger).
- Remove opens a blocking native confirmation dialog; the result drives
  **Widget removed. It is saved under AI generated.** / **Widget removed from the
  desktop.** / **Removal cancelled.**
- Safe mode: Show/Hide cannot enable, Duplicate is disabled, no explanation beyond a
  toast/disabled state.

No reordering here. Placement is done by entering edit mode and dragging on the actual
desktop (see `09-desktop-layer.md`). There is no multi-select, grouping, snapping
control, or per-widget "center" action in settings.

## 9. Saved AI widgets

Header **AI generated** / **Saved widgets stay here after you remove them from the
desktop. Adding one creates a copy, so the saved version remains available.** Count
`{n} saved`.

Empty state: **No saved AI widgets yet. Generate one in the AI tab.** /
**Generated widgets you remove from the desktop are kept here.** / **Open AI studio**.

Cards: live preview, name, `{w} × {h} · Generated {date}`, prompt (single line,
truncated, full text in `title`), **Add copy** (disabled in safe mode), **Delete**
(danger; may confirm in main). No search, sorting, rename, regenerate, or edit with AI
from this list.

## 10. Data and IPC contract

| Action | API |
|---|---|
| Load list | `getWidgets`, `getSavedAiWidgets`, `getBuiltins`, `getWidgetRuntime` |
| Add built-in | `addWidget(type, variant, appearance?)` |
| Save appearance | `setWidgetAppearance(id, patch)`; `setWidgetOpacity(id, n)` |
| Change variant | `setWidgetVariant(id, variant)` |
| Enable/disable | `setWidgetEnabled(id, bool)` |
| Lock | `setWidgetLocked(id, bool)` |
| Duplicate / reload / remove | `duplicateWidget`, `reloadWidget`, `removeWidget` |
| Permissions | `setWidgetPermission(id, permission, granted)` |
| Edit mode | `getEditMode`, `setEditMode(bool)` |
| Saved AI | `addAiWidgetCopy(id)`, `deleteAiWidget(id)` |
| Preview appearance | `createWidgetPreview(appearance, theme, assetId)`, `releaseWidgetPreview(token)` |
| Custom background | `pickWidgetBackground()`, `getWidgetBackground(id)` |

`WidgetManifest`: id, name, kind (`builtin`/`ai`), builtinType, variant, width/height,
permissions, grantedPermissions, allowedHosts, prompt, createdAt.
`WidgetSummary`: `manifest` + `placement` (`widgetId`, x/y, width/height, enabled,
locked, opacity, themeOverride, appearance fields).
`WidgetRuntimeInfo`: widgetId, running, cpuPercent, memoryMB, disabledReason.

## 11. Current styling notes

- Studio switcher is a 42 px bar: view tabs are underline-style (accent underline on
  active), counts are 9 px pills; right side has a keycap pill and a secondary button.
- Browse toolbar: search field flexes, AI button sits right; 34 px tall.
- Catalog sections have a category mark (8 px colored square, per-category hue),
  15 px heading, count, and quiet "See all".
- Catalog cards: panel background, 13 px radius, preview stage 16:9-ish with padding;
  body shows title 12 px, meta 9 px mono-ish, description 10.5 px over 2 lines, actions
  10 px.
- Category grid: 4 columns, 12 px gap; cards are vertical with preview on top, details
  and actions below; AI card uses dashed accent border and centered plus.
- Customize sheet: 920 px max, `--shadow-lg`, 16 px radius on the left edge only,
  slides in from right; preview pane has a dark radial stage; controls are grouped by
  1 px separators; labels 10 px uppercase-ish, values 10 px; sliders full width; color
  picker grid is 8 columns.
- Desktop cards: 2-column layout (thumb 144 px + content), 14 px radius, 12 px gap;
  controls wrap; action row uses compact 24 px buttons; permissions `<details>` is
  10.5 px.
- Saved grid: `minmax(260px, 1fr)` cards; 16:9 preview; body 12 px; actions at the
  bottom.

## 12. UX observations

1. **Double path to the same action**: preview click, Customize, and the customize
   sheet all overlap; Add bypasses configuration and silently uses the first variant.
2. **Discovery hides the actual catalog**: the landing page shows only one variant per
   type and up to 4 types per category, so 30 designs are mostly invisible until
   drilling in. Category "See all {n}" counts types but the destination counts
   variants.
3. **Horizontal scrolling rows** hide items without an obvious affordance, and the
   rows are uneven (some categories have one card).
4. **No breadcrumb**; the category page is a local state, so back behavior is a custom
   link and switching views loses filters.
5. **Search is inconsistent**: landing searches types only; category searches
   types+variant+body; neither searches tags globally.
6. **Add is destructive-ish**: it places a widget immediately with no preview/undo;
   the success toast is the only confirmation. In safe mode, Add is disabled but
   Customize is not, so the sheet's primary action can also fail.
7. **Customize sheet is a long form**: six sections, two giant color pickers, three
   kinds of opacity (background, content, window), variant pills with no images.
   Users cannot compare variants visually before switching.
8. **Terminology collision**: "Widget theme" (widget chrome), "Settings theme"
   (General), "Appearance" (sheet), "Window opacity" — users must infer three
   different scopes.
9. **No unsaved-changes guard**; closing via backdrop is easy. No reset-to-default,
   no presets, no before/after.
10. **Desktop manager is dense and text-heavy**: native selects, tiny buttons,
    CPU/RAM noise, permissions hidden in a disclosure, no visual reordering.
11. **Remove/delete confirmations are native** and the remove toast differs based on
    whether the widget was AI, which is useful but easy to miss.
12. **Saved AI has no management depth**: cannot rename, regenerate, edit, search, or
    see variant/appearance details; only add copy/delete.
13. **Preview demo data is silently fake** (weather Lisbon, apps Browser/Files/Music);
    fine for design, but the UI never says "sample data".
14. **Empty/loading/error states are inconsistent** across views (some `<p class="empty">`,
    some `.empty-state`).
15. **The edit-layout shortcut is shown but not actionable** in the switcher; the
    button duplicates its purpose.

## 13. Design brief for the AI

Redesign Widgets as a visual studio, not a settings list:

- **Browse**: make the catalog feel curated and visual. Prefer a responsive grid or
  editorial shelf that exposes multiple variants (or a clear "N designs" affordance)
  without horizontal scrolling. Define category navigation that behaves like a
  first-class page (breadcrumb/back, preserved filters) even without a router.
- **Cards**: decide one clear primary action. Suggested model: click = preview/details;
  a single **Add** quick action; configuration offered inside the preview. Remove the
  duplicate Customize/Add paths.
- **Customize**: turn the sheet into a focused composer. Use a larger preview, visual
  variant thumbnails, grouped "Look / Surface / Shape" controls, collapsible
  advanced options, one consistent opacity model, presets, reset, and a dirty-state
  guard. Replace the two full palette grids with compact color controls + popover.
  Clarify auto vs explicit values.
- **Search/filter**: one search model across types and variants, with tag filters and
  clear/empty states that match.
- **On desktop**: provide a scannable list with strong thumbnails, status, and a small
  set of high-value controls; move permissions and destructive actions into a details
  panel. Reduce runtime noise, or make it a single subtle metric. Offer a clear
  "arrange on desktop" entry point.
- **Saved AI**: give saved widgets a real library: search/sort, metadata, preview,
  add-copy, edit/regenerate entry points if navigation to AI supports it, delete.
- Keep the three views (Browse, On desktop, Saved), all IPC calls, permission
  semantics, safe-mode restrictions, and edit-mode behaviour. Do not invent backend
  fields; if a control needs data that does not exist, omit it or mark it as future.

## 14. Output format

Return TSX for the affected components + plain CSS scoped to the widgets area. Keep
`WidgetPreview` props and the preview bridge intact. Provide the list of new i18n keys.
Explain how Add/Customize now differ, how unsaved changes are handled, and how the
layout behaves at 720 × 520. Run `npm run typecheck` and `npm run lint` before
returning.
