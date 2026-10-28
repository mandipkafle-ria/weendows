# HomeLayer — UI Handoff Pack

> **Purpose:** Explain the current UI of HomeLayer, section by section, so an external
> UI/UX design AI can propose a better version **without breaking the app**.
>
> **Status:** Describes the app as it exists today (post Phase 7B redesign).
> **Owner files:** `src/renderer/settings/**`, `src/renderer/widget-shell/**`,
> `src/renderer/wallpaper-host/**`, `src/renderer/wallpaper-thumbnail/**`.
> **Last review:** 2026-10-28

---

## 1. How to use this pack

1. Give the design AI **this README first** (product context + design system + rules).
2. Then give it **one section file** from the list below.
3. Ask for a redesign of that section only. Each section file ends with a
   "Design brief for the AI" and "Output format" block you can paste directly.
4. Bring the returned code back to this project. The "Integration contract" in each
   file says what must stay compatible.

Do **not** ask the design AI to change main-process logic, IPC names, data shapes,
or security behaviour. This pack is about presentation and interaction only.

### Section files

| File | Covers | Current entry file(s) |
|---|---|---|
| `01-app-shell.md` | Window shell: sidebar, navigation, header, scroll area, notices, safe mode, toasts | `App.tsx`, `Toasts.tsx`, `useToasts.ts` |
| `02-general.md` | General tab: startup, edit-mode shortcut, appearance (settings theme, widget default theme, accent), cursor gallery, maintenance | `GeneralPanel.tsx`, `CursorGallery.tsx`, `ColorPicker.tsx`, `SliderField.tsx` |
| `03-widgets.md` | Widgets tab: Browse catalog, category drill-down, live preview, customize sheet, On Desktop manager, Saved AI library, edit mode | `WidgetsPanel.tsx`, `WidgetCatalog.tsx`, `WidgetCategoryPage.tsx`, `WidgetCustomizeSheet.tsx`, `WidgetPreview.tsx` |
| `04-wallpaper.md` | Wallpaper library: static images, live video/HTML, slideshow, fit, restore | `WallpaperPanel.tsx` |
| `05-apps-and-bundles.md` | Apps and bundles: Start-menu scan, app list, bundle list, create-bundle modal, target-widget picker | `AppsPanel.tsx` |
| `06-ai.md` | AI tab: provider config, model loading, prompt/revise, generation result, permission approval, preview console | `AiPanel.tsx` |
| `07-about.md` | About tab: version, restore wallpaper, issue tracker, licenses, native check | `AboutPanel.tsx` |
| `08-onboarding.md` | First-run onboarding: welcome/privacy, first widgets, optional Gemini key | `Onboarding.tsx` |
| `09-desktop-layer.md` | The desktop surface: widget shell/edit overlay, crash badge, built-in widget families, wallpaper host/thumbnail, App Grid widget | `widget-shell/**`, `resources/builtin-widgets/**`, `wallpaper-host/**` |

Throughout, `src/` means `homelayer/src/`.

---

## 2. Product in one paragraph

HomeLayer is a Windows desktop customization app built with Electron. It puts live
widgets (clock, calendar, system, battery, notes, weather, app launcher) on top of the
Windows desktop and can replace the wallpaper with an image, video, or interactive
HTML scene. A settings window controls startup, appearance, cursors, widgets,
wallpapers, app bundles, and AI-generated widgets. Widgets are sandboxed iframes
served over a custom `widget://` protocol. AI widget generation previews first and
requires explicit permission approval before saving.

**Users:** Windows power users who want a beautiful, personal desktop without
replacing Explorer. The app should feel like a premium creative tool, not a
control panel.

**Key promises the UI must keep visible:**
- Nothing is saved or published until the user approves it (AI widgets).
- Permissions and network hosts are explicit, reviewable, and revocable.
- Widgets run locally; network access is limited to approved hosts.
- Windows wallpaper can always be restored.
- Safe mode protects users after repeated crashes.

---

## 3. Technology and hard constraints

| Item | Value |
|---|---|
| Runtime | Electron `44.x` |
| UI | React `19.x`, TypeScript, plain CSS (no Tailwind, no UI kit) |
| Build | `electron-vite` |
| Entry | `src/renderer/settings/main.tsx` → `<App />` |
| State | Local React state + IPC (`window.api`) to the main process. No Redux/Zustand/router. |
| Styling | One stylesheet: `src/renderer/settings/assets/main.css` (≈4,900 lines). Class-based. |
| Fonts | System fonts only: `'Segoe UI Variable Display', 'Segoe UI', system-ui`; mono: `Consolas, 'Cascadia Mono'`. One bundled font (`DotGothic16`) used by some built-in widgets, not settings. |
| Icons | Inline SVG paths defined in `App.tsx` (`ICON_PATHS`) and inside components. No icon library. |
| Copy | `t('key')` from `src/renderer/i18n`; English strings live in `src/renderer/i18n/en.json`. |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: hl-wallpaper:; connect-src 'self' ws://localhost:* http://localhost:*; frame-src widget:` |
| Window | Default 880 × 620; minimum 720 × 520. Sidebar 208 px. The app must remain usable at 720 × 520. |
| Offline | No remote fonts, images, analytics, or runtime dependencies. Redesigns must not add any. |

### Non-negotiable compatibility rules

- Keep the same **component public props** (or adapt the parent call sites deliberately).
- Keep the same **IPC/API calls and their order/semantics**. Do not replace real calls
  with mock data in production components.
- Keep **i18n**: every user-visible string must stay a `t()` key (or use a new key added
  to `en.json`). No hardcoded English in new production UI.
- Keep **keyboard support** and visible focus; do not remove ARIA roles already present.
- Keep **iframes sandboxed**; never add `allow-same-origin`, navigation, or remote embeds.
- Design must work in **dark and light themes**, with all four accents, and with Windows
  **forced-colors** and **prefers-reduced-motion**.
- Prefer **CSS custom properties** over hardcoded colors. Reuse existing tokens where
  possible; if new tokens are needed, define light/dark/accent variants.

---

## 4. Current layout and navigation

The settings window is a two-column app shell:

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ SIDEBAR      │ WORKSPACE                                                │
│ 208px        │                                                          │
│              │  header: eyebrow (group) / h1 (tab) / subtitle           │
│  brand       │          status pill + version                           │
│              │  ──────────────────────────────────────────────────────  │
│  DESKTOP     │  scrollable body                                         │
│   General    │    [safe-mode banner]                                    │
│   Widgets    │    [notices]                                             │
│   Wallpaper  │    [active tab content]                                  │
│  TOOLS       │                                                          │
│   Apps       │                                                          │
│   AI         │                                                          │
│  APP         │                                                          │
│   About      │                                                          │
│              │                                                          │
│  version     │                                                          │
│  platform    │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
                    toasts float bottom-right
```

Top-level group labels: **Desktop** (General, Widgets, Wallpaper), **Tools**
(Apps and bundles, AI), **App** (About). The Widgets nav item shows a live count of
widgets on the desktop. The default tab is General unless the window was opened with
`?editWidget=<id>`, which opens the AI tab in edit mode.

The first-run flow replaces the whole shell with `Onboarding` until
`general.onboardingCompleted` is true.

---

## 5. Design system in use today

### 5.1 Color tokens

Dark (default):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#090a0d` | window background |
| `--bg-deep` | `#060709` | preview wells |
| `--sidebar` | `#0d0f13` | sidebar |
| `--panel` | `#13161c` | cards, panels |
| `--panel-soft` | `#191c23` | inputs, nested blocks |
| `--panel-raised` | `#20242d` | hover / selected segments |
| `--border` | `#2c323d` | default border |
| `--border-strong` | `#3f4756` | hover/active border |
| `--text` | `#f8fafc` | primary text |
| `--muted` | `#a3acba` | secondary text |
| `--faint` | `#818997` | metadata / mono labels |
| `--accent` | `#ff7a45` (Ember) | CTA, selection, focus |
| `--accent-strong` | `#ff966b` | CTA hover |
| `--accent-soft` | `rgba(255,122,69,.15)` | tinted surfaces |
| `--accent-line` | `rgba(255,122,69,.45)` | selected borders |
| `--accent-ink` | `#180c05` | text on accent |
| `--ok` | `#4ade80` | success/running |
| `--error` | `#f87171` | error/destructive |
| `--warning` | `#fbbf24` | warnings |
| `--shadow-lg` | `0 24px 70px rgba(0,0,0,.45)` | sheets/modals |
| `--shadow-sm` | `0 8px 24px rgba(0,0,0,.25)` | cards/nav |

Light theme overrides: `--bg #f1f3f6`, `--panel #ffffff`, `--panel-soft #f4f6f9`,
`--text #0f172a`, `--border #cbd5e1`, `--accent #c2410c`. Accents:
Violet `#a78bfa` (light `#6d28d9`), Teal `#2dd4bf` (light `#0f766e`),
Rose `#fb7185` (light `#be123c`).

The window body has a soft radial accent glow at the top-right; the sidebar has a
blurred accent orb at the top-left and a vertical gradient.

### 5.2 Type scale (as implemented)

| Role | Size / weight | Family |
|---|---|---|
| App h1 | 30 px / 650, letter-spacing -0.035em | Segoe UI Variable Display |
| Panel h2 | 17 px | inherited (body) |
| Card h3 | 12–13 px / 650 | Display |
| Body | 13 px | Segoe UI Variable Text |
| Control text | 11–12 px | body |
| Metadata | 10–11 px, `--muted`/`--faint` | body or mono |
| Eyebrow / nav group | 9–10 px, 700, 0.15em uppercase | body |
| Mono values | 10–12 px | Consolas / Cascadia Mono |

There is no separate type-token layer; sizes are written per component. A redesign may
introduce one, but the final CSS must keep the same compact desktop density.

### 5.3 Geometry and motion

- Base spacing unit: 4 px. Workspace padding 26/30 px top, 30 px sides, 36 px bottom.
- Radii: panels 14 px, cards 13–14 px, controls 7–9 px, pills 999 px,
  sheets 16 px, onboarding card 18 px.
- Borders: 1 px. Selected states use `--accent` border plus a 1 px inner ring.
- Shadows: subtle; cards mostly flat until hover.
- Motion: 120–180 ms for controls, 220 ms for the customize sheet,
  180 ms slide for the category page, pulsing live dot. Reduced motion is globally
  neutralized in CSS.

### 5.4 Shared controls and states

| Control | Classes | Notes |
|---|---|---|
| Primary button | `.button-primary`, base `.panel button` | accent fill, accent-ink text, bold |
| Secondary | `.button-secondary` | panel-soft fill, border, text |
| Quiet | `.button-quiet` | text-like, border on hover |
| Danger | `.button-danger` | error text, tinted border |
| Compact | `.button-compact` | 5×9 px, 10 px text |
| Segmented | `.segmented-control`, `.segment-active` | 2–3 mutually exclusive options |
| Switch | `.switch` + hidden checkbox | 42×24 px, accent when on |
| Slider | `.slider-field` (React `SliderField`) | label + output + native range |
| Color picker | `.color-picker` (React `ColorPicker`) | swatch trigger, hex, wheel, eyedropper, 50 swatches, 5 category tabs |
| Search | `.search-field` | inline SVG icon, clear button |
| Chip | `.filter-chip`, `.chip` | filter/prompt chips |
| Keycap | `<kbd>` | mono, 2 px bottom border |
| Badge | `.runtime-badge`, `.stat-chip`, `.count`, `.category-mark` | status/count |
| Empty state | `.empty-state` | dashed container, title, body, CTA |
| Toast | `.toast-stack`, `.toast-{success,error,info}` | fixed bottom-right, 5 s auto-dismiss, max 4 |
| Notice | `.notice`, `.notice-{info,warning,error}` | inline, left color bar |
| Sheet | `.sheet-backdrop`, `.customize-sheet` | right-side, full height |
| Modal | `.ai-modal-backdrop`, `.ai-modal`, plus inline-styled modals in Apps | centered |
| Preview well | `.wallpaper-thumb`, `.desktop-thumb`, `.saved-preview`, `.widget-preview` | dotted/radial dark stage |

Accessibility baseline already present: `role="tablist"`, `role="tab"`,
`aria-selected`, `role="radiogroup"`/`role="radio"`, `aria-checked`, `aria-pressed`,
`aria-live`, `role="dialog"`, `aria-modal`, `aria-label`, `sr-only`,
visible `:focus-visible` outlines, forced-colors fallbacks.

---

## 6. What "better" should mean here

The product is already visually unified, but it is still a settings window with
several dense, text-driven areas and a few rough edges. A redesign should make it:

1. **More visual, less explanatory** — show the result instead of describing it.
   Previews, thumbnails, and visual choices beat labels and selects.
2. **More legible and less cramped** — current UI uses 9–11 px type in many places.
   Keep density but raise the floor for supporting text and hit targets.
3. **More intentional hierarchy** — one primary action per screen; group related
   controls; separate destructive maintenance from everyday settings.
4. **More forgiving** — preview before commit, undo/cancel where possible,
   explicit empty/loading/error states, no surprise actions.
5. **More premium but restrained** — tasteful depth, spacing, and micro-motion;
   no gradient soup, no glass everywhere, no decorative noise.
6. **Faster to scan** — fewer competing accents, clearer status communication,
   less duplicated chrome.

Avoid: adding new features that need backend work, changing permissions semantics,
adding icon/font dependencies, or redesigning the information architecture to a
web dashboard pattern. This is a compact Windows utility, not a SaaS admin panel.

---

## 7. Cross-cutting UX issues visible across all sections

These are known and can be addressed by any section redesign that touches them:

- Very small supporting text (9–11 px) and compact hit targets, especially in cards,
  metadata, and secondary actions.
- Mixed control languages: native `<select>` dropdowns, segmented controls, sliders,
  checkboxes, color inputs, and inline-styled modals all coexist.
- Busy-state feedback is inconsistent: some buttons say "Adding…"/"Saving…",
  others only disable; some actions use a toast, some an inline message, some nothing.
- Native blocking `window.confirm` is used for remove/reset/delete flows.
- Destructive actions sit directly next to everyday actions in dense rows.
- Duplicate information: version appears in the header and sidebar; wallpaper restore
  appears in Wallpaper and About; "Create bundle" appears twice in Apps.
- Some UI text is hardcoded English (ColorPicker titles, AppsPanel inline labels,
  AI preset names, badge HTML) while the rest uses `t()`.
- Several modals use large inline `style` objects instead of shared classes.
- No unsaved-changes guard when closing the customize sheet or navigating away from AI.
- The wallpaper "set current" action requires selecting a card first; there is no
  visible "current mode" summary (static / slideshow / live) outside the item badge.
- The desktop layer and settings layer use separate visual systems: the widget edit
  overlay is much darker/rougher than the settings window.

---

## 8. Integration contract for returned redesigns

When the design AI returns code:

1. **File shape** — prefer one component file + CSS additions. Do not introduce
   CSS modules, styled-components, Tailwind, animation libraries, or new packages.
2. **Public API** — keep the component's props/state contract described in the section
   file. If a new prop is needed, explain it and update the parent call site too.
3. **Data** — keep every `window.api.*` call, validation, ordering, and error handling.
   Purely visual subcomponents may be extracted.
4. **i18n** — keep existing `t()` keys. New copy must be added to `en.json`; provide
   the key list with the redesign.
5. **Classes** — existing shared classes (buttons, segmented, switch, slider, empty,
   toast) should be reused where possible. New classes must be namespaced to the
   section (e.g. `.wp-*` for wallpaper) to avoid collisions.
6. **Accessibility** — keep or improve roles, labels, focus order, and keyboard paths.
   Every icon-only button needs `aria-label`.
7. **Responsive** — must work at 720 × 520 (minimum) and 1280 × 800. The sidebar
   collapses only as it does today (208 → 184 → 176 px); no hamburger is required.
8. **Verification** — the redesign should survive `npm run typecheck`, `npm run lint`,
   and `npm test` without behavioural changes.

### Recommended prompt prefix

> You are redesigning one section of HomeLayer, a compact Windows desktop utility
> (Electron + React 19 + TypeScript + plain CSS). Read the attached README for the
> design tokens, constraints, and integration rules. Then read the section file.
> Redesign only that section. Keep all data flow, IPC calls, i18n keys, ARIA, and
> keyboard behaviour. Return production-ready TSX and plain CSS. No new dependencies,
> no remote assets, no mock data in production paths. The result must feel premium,
> visual-first, calm, and dense enough for an 880 × 620 window.

---

## 9. Section map with source references

| Area | Primary files |
|---|---|
| Shell and nav | `src/renderer/settings/App.tsx`; styles in `main.css` (`.app-shell`, `.sidebar`, `.workspace`) |
| Toast state | `src/renderer/settings/Toasts.tsx`, `useToasts.ts` |
| General | `GeneralPanel.tsx`; `CursorGallery.tsx`; shared `ColorPicker.tsx`, `SliderField.tsx` |
| Widgets | `WidgetsPanel.tsx`; `WidgetCatalog.tsx`; `WidgetCategoryPage.tsx`; `WidgetCustomizeSheet.tsx`; `WidgetPreview.tsx` |
| Wallpaper | `WallpaperPanel.tsx` |
| Apps | `AppsPanel.tsx` |
| AI | `AiPanel.tsx` |
| About | `AboutPanel.tsx` |
| Onboarding | `Onboarding.tsx` |
| Desktop widgets | `src/renderer/widget-shell/main.ts`, `style.css`; `src/main/windows/widget-window.ts`, `layout.ts`, `widget-badge-window.ts` |
| Built-in widgets | `resources/builtin-widgets/{clock,date,calendar,system,battery,notes,weather,app-grid}` |
| Wallpaper display | `src/renderer/wallpaper-host/main.ts`; `src/renderer/wallpaper-thumbnail/main.ts`; `src/renderer/settings/assets/main.css` (wallpaper section) |
| Shared types | `src/shared/types.ts`, `builtins.ts`, `appearance.ts`, `cursor.ts` |
| IPC names/API | `src/shared/ipc.ts`, `src/preload/settings-preload.ts` |
