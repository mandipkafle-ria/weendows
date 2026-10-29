# HomeLayer — Themed Widget Gallery
## Design Specification for Google Stitch

> **Document purpose:** A complete, screen-by-screen design brief for generating
> high-fidelity mockups in Google Stitch. Each section names one screen, describes
> the layout and visual language, calls out interactive states, and lists the exact
> content to appear. Reference the design system section at the end for tokens.
>
> **App context:** HomeLayer is a premium Windows desktop customization tool
> (Electron + React). The settings window is 880 × 620 px (min 720 × 520).
> The aesthetic goal is "creative studio, not control panel."

---

## Part 1 — The Vision

The core idea: **widget discovery is an experience, not a list.**

When a user opens the Widgets tab they are immediately inside a
**themed immersive environment** — the workspace transforms into a living scene
that wraps every widget in a matching visual world. The reference image (shared)
shows widgets floating in a sky-blue atmospheric space, tinted and textured to
match. That is the model.

Each **theme** is a named visual world (Sky, Forest, Glass, Midnight, Sakura,
Monochrome, Ember). The user switches themes from the sidebar or a compact
selector at the top of the Browse view — no intermediate gallery step.
The scene changes instantly. When they hover a widget tile inside the scene,
it comes alive — analog clock hands tick, digital clocks count, weather
widgets animate. Clicking a tile opens the customize sheet.

The shell around all of this (sidebar, header, chrome) also elevates — deeper,
richer, more intentional. It feels like launching a premium creative app.

---

## Part 2 — Design System Tokens

### 2.1 Base Color Palette (Dark, default)

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#08090c` | Window base |
| `--bg-deep` | `#050608` | Preview wells, deep recesses |
| `--sidebar` | `#0d0f14` | Sidebar surface |
| `--panel` | `#12151b` | Cards, panels |
| `--panel-soft` | `#181c24` | Inputs, nested rows |
| `--panel-raised` | `#1e2330` | Hover states, selected |
| `--border` | `#252a36` | Default border |
| `--border-strong` | `#3a4155` | Hover / active border |
| `--text` | `#f0ede4` | Primary text |
| `--muted` | `#96a0b2` | Secondary text (5.2:1 on base) |
| `--faint` | `#7a8294` | Metadata, labels (4.6:1 on base — WCAG AA) |
| `--accent` | `#ff7a45` | Primary CTA, active, focus |
| `--accent-strong` | `#ff9a6b` | CTA hover |
| `--accent-soft` | `rgba(255,122,69,.12)` | Tinted surfaces |
| `--ok` | `#4ade80` | Running, success |
| `--error` | `#f87171` | Error, destructive |
| `--warning` | `#fbbf24` | Warnings, caution |

Light theme: `--bg #eef0f5`, `--panel #ffffff`, `--text #0f1623`, `--border #d0d6e0`

### 2.2 Theme Environment Palettes

Each theme has **six tones** used across its environment scene and widget chrome.
All text-on-chrome combinations verified at WCAG AA (4.5:1 minimum).

| Theme | ID | Atmosphere Base | Mid | Highlight | Glow | Text on Dark | CTA |
|---|---|---|---|---|---|---|---|
| Sky | `sky` | `#aec8ef` | `#c8daf7` | `#e8f0fc` | `rgba(120,170,240,.4)` | `#1a3a6b` | `#1e4a9a` |
| Forest | `forest` | `#1e3a28` | `#3a6040` | `#5a9a62` | `rgba(70,160,80,.35)` | `#e0f5e4` | `#5a9a62` |
| Glass | `glass` | `rgba(180,200,240,.12)` | `rgba(200,215,250,.18)` | `rgba(230,240,255,.28)` | `rgba(140,170,240,.3)` | `#e8edf8` | `rgba(255,255,255,.9)` |
| Midnight | `midnight` | `#0c1228` | `#162050` | `#2a3580` | `rgba(90,110,220,.4)` | `#b0bcf0` | `#5070e0` |
| Sakura | `sakura` | `#2a1220` | `#4a2035` | `#7a3555` | `rgba(220,100,150,.3)` | `#f8d0e0` | `#d86090` |
| Monochrome | `mono` | `#0e0e0e` | `#1e1e1e` | `#3a3a3a` | `rgba(255,255,255,.08)` | `#f0f0f0` | `#ffffff` |
| Ember | `ember` | `#1c0e04` | `#3a1a08` | `#6a3518` | `rgba(240,160,50,.3)` | `#ffe0c0` | `#d08020` |

**Glass scene gradient** (required — Glass needs a tinted base, not raw `#08090c`):
`linear-gradient(135deg, #10141e 0%, #141a2a 50%, #0e1220 100%)`

**Monochrome editorial accent:** A single `#cc2222` rule line (1 px) appears at
the top edge of each widget tile — a Bauhaus reference that gives Monochrome its
identity without introducing color into the palette.

**Ember vs global accent:** Ember is deliberately shifted toward amber-gold
(`#d08020`) to avoid collision with the app's orange accent (`#ff7a45`). These
must never be the same hue.

### 2.3 Typography

**Display font:** Segoe UI Variable Display (system, no import needed)
**Body font:** Segoe UI Variable Text
**Mono:** Consolas / Cascadia Mono

| Role | Size | Weight | Tracking |
|---|---|---|---|
| App brand | 15 px | 700 | +0.05em |
| Theme title (hero) | 32 px | 700 | -0.03em |
| Theme subtitle | 13 px | 400 | 0 |
| Section header | 11 px | 700 | +0.14em uppercase |
| Widget card name | 12 px | 650 | 0 |
| Widget card meta | 10 px | 400 | 0, muted |
| Button | 12 px | 600 | 0 |
| Nav label | 12 px | 500 | 0 |

### 2.4 Geometry

- Window: **880 x 620 px** default; min **720 x 520 px**
- Sidebar: **220 px** wide
- Border radius: panels **16 px**, cards **14 px**, buttons **8 px**, pills **999 px**
- Spacing unit: **4 px**. Component gaps: 12 px, 16 px, 24 px
- Borders: **1 px solid**. Selected borders: **1 px + 1 px inner ring**

### 2.5 Motion

| Trigger | Duration | Easing |
|---|---|---|
| Nav tab active | 150 ms | ease-out |
| Theme switch (scene crossfade) | 320 ms | cubic-bezier(.22,1,.36,1) |
| Widget tile hover lift | 200 ms | cubic-bezier(.22,1,.36,1) |
| Widget card hover scale | 180 ms | ease-out |
| Widget live element tick | real-time, CSS | steps(1) or smooth |
| Sheet slide in | 240 ms | cubic-bezier(.22,1,.36,1) |
| Toast slide up | 220 ms | ease-out |
| Reduced motion | all durations 0 ms, no translate | |

---

## Part 3 — Screen Inventory

| # | Screen | What Stitch should generate |
|---|---|---|
| S1 | App Shell — Redesigned | Full window with new sidebar + header chrome |
| S2 | Theme Scene — Widgets Browse | Immersive scene; widget tiles floating; theme selector at top |
| S3 | Widget Catalog — Inside Theme | Scrollable catalog over the scene; frosted cards |
| S4 | Widget Customize Sheet | Focused composer with themed preview |
| S5 | On Desktop Manager | Visual desktop management tab |
| S6 | Saved AI Library | AI widget collection |

---

## Screen S1 — App Shell (Redesigned)

### Purpose
The persistent frame around every section. Feels like a premium creative studio
launcher, not a Windows Settings clone.

### Layout (880 x 620)

```
sidebar 220px                       workspace
+------------------------------+    +---------------------------------------+
|                              |    |                                       |
|  [logo]  HomeLayer           |    |  [active section content]             |
|                              |    |                                       |
|  DESKTOP                     |    |                                       |
|  [icon] General              |    |                                       |
|  [icon] Widgets          3   |    |                                       |
|  [icon] Wallpaper            |    |                                       |
|                              |    |                                       |
|  TOOLS                       |    |                                       |
|  [icon] Apps & Bundles       |    |                                       |
|  [icon] AI Studio            |    |                                       |
|                              |    |                                       |
|  APP                         |    |                                       |
|  [icon] About                |    |                                       |
|                              |    |                                       |
|  v1.4.2  [green dot]Running  |    |                                       |
+------------------------------+    +---------------------------------------+
                                                  [toast stack, bottom-right]
```

### Visual Design

**Sidebar:**
- Background: `--sidebar` (`#0d0f14`) with a subtle vertical gradient
  (transparent to `rgba(255,122,69,.03)` at bottom)
- Brand mark: a 28 x 28 rounded square with a 3x3 grid of dots using `--accent`
- Brand name: "HomeLayer" in 15 px / 700, `--text`
- No subtitle in sidebar
- Nav group labels: 9 px / 700 / uppercase / `--faint`, 24 px top margin
- Nav items: 36 px tall rows, 12 px label, 20 px icon SVG
- Active item: `--panel-raised` background, 2 px `--accent` left bar,
  `--accent` text, subtle glow via `box-shadow: inset 0 0 0 1px --accent-soft`
- Counts badge: 18 px pill, `--accent-soft` bg, `--accent` text, 9 px mono
- Footer: version 10 px mono `--faint` left, status dot + "Running" `--ok` right
- Right edge: 1 px `--border` divider

**Workspace:**
- Background: `--bg` with radial accent bloom at top-right:
  `radial-gradient(ellipse 600px 400px at 100% 0%, rgba(255,122,69,.06), transparent)`
- No visible header bar. Section heading floats as inline compact label:
  11 px uppercase group eyebrow + 22 px bold section name, e.g. `DESKTOP / Widgets`
- Status pill removed from header; lives in sidebar footer only
- Content area: 30 px padding top/sides, 36 px bottom, scrollable

**Safe mode:**
- Sidebar footer shows amber `⚠ Safe mode` pill instead of Running
- Floating amber notice bar at top of workspace (full width, 36 px, sticky):
  "Safe mode is on — widgets and wallpapers are paused. [Start normally →]"

**Toasts:** fixed bottom-right 20 px inset; max-width 300 px; `--panel-raised`
dark panel, 1 px `--border`, 3 px left color stripe, 12 px text, x dismiss;
newest at bottom; max 4; slides in from right

---

## Screen S2 — Theme Scene: Widgets Browse (Sky as example)

### Purpose
The first and default state of the Widgets tab Browse view. The workspace is
immediately filled with the last-used theme environment (default: Sky).
No intermediate gallery or selection step — the user is inside the experience.

### Layout

```
[ Browse  v Sky ]  [ On desktop  3 ]  [ Saved  1 ]       [●][●][●][●][●][●][●]
                                                          Sk Fo Gl Mi Sa Mo Em

+-------------------------------------------------------------------+
|                                                                   |
|  [cloud wisps]     [TILE small]          [TILE small]             |
|                                                                   |
|              ╔═══════════════════╗                                |
|              ║   HERO TILE 1.5x  ║    [TILE small]               |
|              ║  (Analog Clock)   ║                                |
|              ╚═══════════════════╝                                |
|                                                                   |
|  [TILE small]              [TILE small]   [TILE small]            |
|                                                                   |
|  [cloud wisps]                                                    |
+-------------------------------------------------------------------+
 [All]  [Time]  [System]  [Focus]  [Weather]  [Apps]  [ Search... ]
```

### Visual Design

**Top bar (merged):** The view tabs and theme selector share a single 40 px bar.
- Left: view tabs (`Browse ▾ Sky`, `On desktop 3`, `Saved 1`). The Browse tab
  includes a dropdown indicator that opens a theme flyout on click.
- Right: theme quick-switch — 7 colored squares (10x10 px each, 6 px gap),
  each filled with that theme's atmosphere base color. Active theme has a
  2 px `--text` border ring. Hover shows theme name in a tooltip.
  `role="radiogroup"` with `role="radio"` on each; `aria-label="Widget theme"`.

**Scene background (fills workspace):**
- `linear-gradient(180deg, #b8d0f0 0%, #d4e6ff 45%, #e8f2ff 100%)`
- Soft cloud layers: 4-6 blurred white ellipses at different depths,
  subtle parallax on mouse-move (+-8 px travel)
- Noise texture overlay: `opacity: .03` grain for tactility

**Widget tiles (floating in scene):**
- One **hero tile** in the center at **1.5x scale** (the most visually rich
  widget — Analog Clock by default). This is the focal point.
- 5-6 secondary tiles around it at normal size, organic positions, not a grid
- Shared tile style (used in both S2 scene and S3 catalog):
  ```
  background: rgba(255,255,255,.7)
  backdrop-filter: blur(16px) saturate(1.4)
  border: 1px solid rgba(255,255,255,.5)
  border-radius: 16px
  box-shadow: 0 12px 40px rgba(80,130,200,.2)
  ```
- Live WidgetPreview iframes, interactive disabled
- Float animation: each tile bobs up-down 6 px on a 4-7 s sine cycle
  with unique animation-delay
- Focus: `:focus-visible` shows `outline: 2px solid {theme-highlight}` +
  `outline-offset: 2px`, matching the hover lift

**Filter bar:** bottom of scene, 40 px strip with pill-style category filters
and compact search; `rgba(8,9,12,.65)` bg with backdrop-filter blur.
Positioned at `bottom: 56px` to clear the toast stack zone.

**Loading state:** Scene background renders immediately (CSS only). Tiles appear
with a staggered fade-in (200 ms delay per tile) as each iframe loads.

**Error state:** A failed widget tile shows a subtle `⚠` icon over a blurred
placeholder in the theme's mid color. Never an empty white rectangle.

**Theme switch:** When user picks a different theme from the quick-switch bar,
the scene crossfades (320 ms). Widget tiles re-skin in place (border colors,
background tint, text colors update). Particles change type. An `aria-live`
region announces: "Switched to {Theme} theme, {n} designs available."

---

## Screen S3 — Widget Catalog: Inside Theme (Sky)

### Purpose
Scrollable catalog of all widgets styled in the Sky theme. Scene becomes
scrollable container; parallax clouds move more slowly as user scrolls.

### Layout

```
<- Back to themes                     Sky          7 designs
----------------------------------------------------------------------------
 [All]  [Time]  [System]  [Focus]  [Weather]  [Apps]   [ Search... ]
----------------------------------------------------------------------------

TIME — 5 designs

+----------------------+  +----------------------+  +----------------------+
|  [live clock widget] |  |  [live clock widget] |  |  [live date widget]  |
|                      |  |                      |  |                      |
|  Sky Analog Clock    |  |  Sky Digital Clock   |  |  Sky Date            |
|  240 x 240           |  |  300 x 160           |  |  240 x 140           |
|  ------------------  |  |  ------------------  |  |  ------------------  |
|  [Customize]  [Add]  |  |  [Customize]  [Add]  |  |  [Customize]  [Add]  |
+----------------------+  +----------------------+  +----------------------+

SYSTEM — 3 designs
...
```

### Visual Design

**Container:**
- Scene background remains (dims slightly on scroll: opacity lerps 1.0 -> 0.7)
- Cards float directly on scene background, no separate container panel

**Category headers:**
- 12 px / 700 / uppercase in theme text color (sky: `#1a3a6b`)
- 2 px bottom border in theme CTA color
- Higher visual priority than card titles (which are 12 px / 650 regular case)

**Widget cards (in-theme style):**
- Same `.theme-widget-tile` style as S2 scene tiles (consistency):
  `background: rgba(255,255,255,.7)`, `backdrop-filter: blur(16px) saturate(1.4)`,
  `border: 1px solid rgba(255,255,255,.5)`, `border-radius: 16px`
- Preview area: top 55% of card, live WidgetPreview with sky-tinted stage
- Title: 12 px / 650 / theme text color (regular case, not uppercase)
- Meta: 10 px / theme muted color
- "Customize" = quiet ghost button; "Add" = theme CTA solid button
  (sky: `#1e4a9a` bg, white text — 5.5:1 contrast)
- Hover: card lifts 4 px, widget preview animates (pointer events still off)
- "1 on desktop" badge: small pill top-right corner, theme CTA fill
- Add action feedback: toast + badge + subtle pulse on badge number
- Focus: `:focus-visible` uses `outline: 2px solid {theme-highlight}`,
  `outline-offset: 2px`

**Filter bar:**
- Active chip: theme CTA fill, white text
- Inactive chip: `rgba(255,255,255,.3)` border, theme text color

---

## Screen S4 — Widget Customize Sheet (Themed)

### Purpose
Right-side sheet overlay for widget configuration. Preview stays in theme's
visual world; controls stay in base dark palette for readability.

### Layout (sheet over catalog, darkened backdrop)

```
      +--------------------------------------------------------------------+
      |  New widget  .  Sky Analog Clock                               x   |
      |  ----------------------------------------------------------------  |
      |                                                                    |
      |  +-------------------------------------------------------------+   |
      |  |                                                             |   |
      |  |           [ live interactive preview ]                     |   |
      |  |           240 x 240 . analog                               |   |
      |  |                                                             |   |
      |  +-------------------------------------------------------------+   |
      |  [green dot] Live preview                                          |
      |                                                                    |
      |  DESIGN                                                            |
      |  [Analog ACTIVE] [Digital] [Minimal] [Neon] [Terminal]             |
      |                                                                    |
      |  LOOK                                                              |
      |  Theme      [ Dark ] [ Light ] [ Auto ACTIVE ]                    |
      |  Background [ Solid ] [ Blur ACTIVE ] [ None ]                    |
      |  Colour     [sky-blue swatch]   Opacity --------O---- 85%        |
      |  Blur       ----O-------------- 12 px                             |
      |                                                                    |
      |  SURFACE                                                           |
      |  Corners    ----O-------------- 16 px                             |
      |  Border     [auto swatch]  --------O---- 60%                     |
      |  Content    ----------------O---- 100%                            |
      |                                                                    |
      |  > Advanced                                                        |
      |                                                                    |
      |  ----------------------------------------------------------------  |
      |  [Cancel]                                    [Add to desktop]      |
      +--------------------------------------------------------------------+
```

### Visual Design

**Sheet:**
- Background: `--panel` (`#12151b`) — un-themed for control readability
- Left edge: 3 px sky atmosphere color stripe (`#aec8ef`)
- 16 px radius on left edge; full height; slides in from right
- Backdrop: `rgba(0,0,0,.55)` with `blur(8px)`

**Preview pane:**
- 220 px tall dark stage (`--bg-deep`) with theme atmosphere gradient behind widget:
  `radial-gradient(ellipse, theme-glow, transparent)`
- Widget renders fully live and interactive
- Live-preview dot: animated green pulse + "Live preview" 10 px label

**Design variant chips:**
- Horizontal pill row; active = `--accent` fill; others = `--panel-soft`
- Chip shows variant name only

**Controls:**
- Section labels: 9 px / uppercase / `--faint`
- Sliders: custom styled range with `--accent` thumb; track in `--border`
- Color swatches: 20 x 20 px rounded squares, click to open compact popover
  (4x6 swatch grid + hex input in 200 px floating popover, NOT full palette grid)
- Segmented controls: pill group, active filled with `--panel-raised`

**Footer:**
- [Cancel] — quiet button, left; [Add to desktop] — primary, right
- Keyboard: Escape = cancel, Enter on footer = confirm

---

## Screen S5 — On Desktop Manager

### Purpose
Manage widgets currently placed on the desktop. Scannable, thumbnail-forward.

### Layout

```
DESKTOP / Widgets
----------------------------------------------------------------------------
[ Browse ]  [ On desktop  3 ]  [ Saved  1 ]
----------------------------------------------------------------------------

On the desktop — 3 widgets                          [Edit layout ->]

+-----------------------------------------------------------------------+
| +------+  Classic Clock              [green dot] Running              |
| | live |  Built-in . 240x140 . Sky Analog               0.3% / 11 MB |
| | prev |  ---------------------------------------------------         |
| |      |  Design [Classic v]  Theme [Auto v]  Opacity [100% v]       |
| +------+  [Show] [Lock] [Customize] [Duplicate] [...]                 |
+-----------------------------------------------------------------------+
+-----------------------------------------------------------------------+
| +------+  Compact Weather            [green dot] Running              |
| | live |  Built-in . 280x140 . Sky Compact              0.2% / 9 MB  |
| | prev |                                                              |
| +------+  [Show] [Lock] [Customize] [Duplicate] [...]                 |
+-----------------------------------------------------------------------+
+-----------------------------------------------------------------------+
| +------+  My Productivity Widget     [gray dot] Hidden                |
| | live |  AI . 320x220 . Generated Oct 15                            |
| | prev |                                                              |
| +------+  [Show] [Edit with AI] [Duplicate] [...]                     |
+-----------------------------------------------------------------------+

[ + Add widget ]
```

### Visual Design

**List cards:**
- Full width, `--panel` bg, 14 px radius, 1 px `--border`
- Preview thumb: 80 x 56 px, live WidgetPreview, 8 px radius, `--bg-deep` stage
- Status dot: 6 px circle — `--ok` green (running), `--muted` gray (paused),
  `--error` red (crashed/disabled)
- Widget name: 13 px / 650 / `--text`
- Meta row: 10 px / `--faint` — kind, dimensions, variant, theme
- Runtime: 10 px mono right-aligned — CPU% / MB
- Controls: Design select, Theme select, Opacity select in horizontal row
- Actions: compact 28 px buttons; destructive actions inside ... menu
- Permissions: hidden inside ... menu, not inline

**Empty state:**
- 48 px widget icon (dots pattern, `--accent` tint), centered
- "Nothing on your desktop yet" / "Browse widget themes to get started"
- [Browse themes ->] primary button

---

## Screen S6 — Saved AI Library

### Purpose
Collection of AI-generated widgets. Grid view with search and sort.

### Layout

```
DESKTOP / Widgets
----------------------------------------------------------------------------
[ Browse ]  [ On desktop  3 ]  [ Saved  1 ]
----------------------------------------------------------------------------

AI Generated — 1 saved                     [ Search... ]  [Date v]

+--------------------+
|  [live preview]    |
|                    |
|  My Widget         |
|  320 x 220         |
|  "a dark glassy    |
|   clock with..."   |
|  Oct 15, 2026      |
|  [Add copy]  [...]  |
+--------------------+
```

### Visual Design

- Grid: `minmax(200px, 1fr)`, 16 px gap
- Cards: `--panel` bg, 14 px radius, 1 px `--border`
- Preview: 16:9 aspect ratio top area, live iframe
- Prompt text: 10 px / `--muted`, clamped to 2 lines
- Date: 9 px / `--faint` mono
- Actions: "Add copy" = quiet button; ... = popover with Delete (danger)

---

## Part 4 — Interaction Catalogue

### 4.1 Interaction Flow

```
User opens Widgets tab
  -> S2: Scene renders immediately in the last-used theme (default: Sky)
         7 widget tiles float in the scene, live and animated

User picks a different theme (theme selector at top, pill-style)
  -> Scene crossfades to new theme environment (320 ms)
         widget tiles re-skin in place, particles change

User hovers a widget tile in the scene (200 ms)
  -> Tile lifts 4 px; widget animates live (clock hands tick, etc.)

User clicks a widget tile OR clicks category filter / search
  -> S3: Scene dims slightly; catalog grid scrolls over it
         frosted-glass widget cards appear for that category

User clicks Customize on any card
  -> S4: Sheet slides in from right, themed preview active

User clicks Add (no sheet)
  -> Widget added immediately
  -> Toast: "[Widget Name] added to your desktop."
  -> Tile acquires "1 on desktop" badge

User clicks <- Back (in catalog)
  -> Returns to full scene view (S2)
```

### 4.2 Widget Live Preview Rules

| Widget type | Animation in scene (always) | Animation on hover |
|---|---|---|
| Analog clock | Continuous hand sweep | Hands accelerate briefly |
| Digital clock | Live counter | Digits highlight on tick |
| Date | Shows real current date | Static |
| Calendar | Highlights today | Static |
| Weather | Cloud/sun icon gentle pulse | Pulse speed increases |
| System monitor | Bars animate to real stats | Bars flash accent color |
| Battery | Ring fills to real level | Ring glows |
| Notes | Cursor blink | Static |
| App grid | Icons subtle shimmer | Shimmer intensifies |

All previews use existing WidgetPreview iframe + MessageChannel bridge.
No new preview mechanism needed. Pointer events remain OFF for gallery views.

### 4.3 Scene Particle Systems

| Theme | Particle type | Count | Behaviour |
|---|---|---|---|
| Sky | White cloud wisps (CSS blobs) | 6 | Drift left at 0.2 px/s |
| Forest | Small leaf shapes (SVG, rotated) | 8 | Fall + sway |
| Glass | Refraction circles (border rings) | 5 | Pulse expand/fade |
| Midnight | Star dots (white, tiny) | 20 | Random twinkle opacity |
| Sakura | Petal shapes (SVG) | 10 | Fall + rotate |
| Monochrome | Film grain overlay | n/a | Static noise texture |
| Ember | Ember dots (orange, small) | 8 | Rise upward + fade |

All particles are pure CSS or inline SVG — no canvas, no JS animation library.
Respect `prefers-reduced-motion`: set all particle AND tile float/bob animations
to `animation: none`. Only live widget content (clock ticking) continues.

---

## Part 5 — Theme Visual Reference Sheets

For each theme, Stitch should generate a **16:9 scene reference** (1280 x 720)
showing: atmosphere background, sample floating widgets in theme palette, and
particle effects. These are reference art, not UI screens.

### Theme: Sky
- **Atmosphere:** Bright cloudy sky blue, soft light from above
- **Widget chrome:** White-to-sky-blue frosted glass tiles, navy text
- **CTA:** `#1e4a9a` (deep sky blue, 5.5:1 on frosted glass)
- **Font color on widgets:** `#1a3a6b`
- **Particles:** Wispy white cloud forms, very soft blur
- **Mood:** Airy, calm, iOS-adjacent, fresh
- **Light mode:** Scene gradient shifts to Mid→Highlight range; widget text stays navy

### Theme: Forest
- **Atmosphere:** Forest canopy with dappled light — brighter than v1.1 to register
  as green against the dark app base. Scene gradient uses `#1e3a28` → `#3a6040`.
- **Widget chrome:** Semi-transparent forest panels `rgba(25,50,30,.75)`, sage accents
- **CTA:** `#5a9a62` (bright sage, high contrast on dark green chrome)
- **Font color on widgets:** `#e0f5e4` (pale leaf, 7.2:1 on chrome)
- **Particles:** Falling leaf shapes, semi-transparent, gentle sway
- **Mood:** Natural, earthy, focused, calm
- **Light mode:** Atmosphere lightens to `#3a6040` → `#5a9a62`; chrome becomes lighter

### Theme: Glass
- **Atmosphere:** NOT transparent-on-black. Uses a tinted gradient base:
  `linear-gradient(135deg, #10141e 0%, #141a2a 50%, #0e1220 100%)`
  This gives Glass a visible blue-gray identity instead of appearing identical to
  the un-themed app shell.
- **Widget chrome:** Ultra-frosted glass, `rgba(200,215,250,.18)` panels,
  `backdrop-filter: blur(24px) saturate(1.6)`, `border: 1px solid rgba(255,255,255,.2)`
- **CTA:** `rgba(255,255,255,.9)` button with dark text (`#0e1220`)
- **Font color on widgets:** `#e8edf8`
- **Particles:** Expanding ring halos, light refractions
- **Mood:** Ultra-premium, luxurious, clean, modern
- **Light mode:** Gradient shifts lighter; glass panels become more opaque

### Theme: Midnight
- **Atmosphere:** Deep space indigo — clearly chromatic, not just dark. Uses
  `#0c1228` → `#162050` — noticeably bluer than the `#08090c` app base.
  Subtle nebula gradients in purple-blue, distant star field.
- **Widget chrome:** Dark indigo panels `#162050`, electric blue borders `#2a3580`
- **CTA:** `#5070e0` (bright electric indigo, stands out on dark chrome)
- **Font color on widgets:** `#b0bcf0`
- **Particles:** Twinkling stars, opacity pulsing
- **Mood:** Cosmic, dramatic, focused, night-mode perfectionist
- **Light mode:** Atmosphere shifts to `#162050` → `#2a3580`; chrome lightens

### Theme: Sakura
- **Atmosphere:** Deep pink-purple dusk, warm soft light
- **Widget chrome:** Dark berry panels, `rgba(42,18,32,.9)`, rose-gold borders
- **CTA:** `#d86090` (bright sakura, 4.5:1 on dark berry — WCAG AA pass)
- **Font color on widgets:** `#f8d0e0`
- **Particles:** Falling petal shapes, slow rotation
- **Mood:** Romantic, poetic, Japanese-inspired, twilight
- **Light mode:** Atmosphere warms to rose-gold range; chrome becomes lighter berry

### Theme: Monochrome
- **Atmosphere:** Near-black (`#0e0e0e`) with subtle grain texture, zero color
- **Widget chrome:** Dark grays `#1e1e1e`, white text, borders `#3a3a3a` (visible)
- **CTA:** `#ffffff` (pure white on black = maximum Swiss contrast)
- **Font color on widgets:** `#f0f0f0`
- **Editorial accent:** A single `#cc2222` rule line (1 px) at the top edge of each
  widget tile — a Bauhaus reference that gives Monochrome its identity
- **Particles:** Film grain texture (static), no animated particles
- **Mood:** Editorial, minimal, Swiss-design, intentional
- **Light mode:** Inverts — white atmosphere, black chrome, red accent remains

### Theme: Ember
- **Atmosphere:** Deep charcoal with warm amber-gold glow from below (NOT orange —
  shifted toward gold to differentiate from the app's `#ff7a45` orange accent)
- **Widget chrome:** Very dark panels `#3a1a08` with amber borders `#6a3518`
- **CTA:** `#d08020` (amber-gold, clearly distinct from global accent `#ff7a45`)
- **Font color on widgets:** `#ffe0c0` (warm cream)
- **Particles:** Small rising amber sparks, golden glow, fade and disappear
- **Mood:** Intense, warm, dramatic, bonfire-night energy
- **Light mode:** Atmosphere shifts to warm amber; chrome becomes lighter caramel

---

## Part 6 — Stitch Prompt Guide

Use these prompts in Google Stitch to generate each screen:

### Prompt Template

```
Design a screen for HomeLayer, a premium Windows desktop widget customization app
(Electron window, 880 x 620 px). Style: dark mode, premium creative tool,
dense but polished, no gradients everywhere, restrained micro-motion.
Design system: #08090c base, #12151b panels, #ff7a45 accent, Segoe UI font.

[SCREEN-SPECIFIC INSTRUCTION BELOW]
```

### S1 — App Shell
```
...template above...
Show the redesigned app shell with a 220 px dark sidebar containing:
branded HomeLayer dot-grid logo, nav groups (DESKTOP: General/Widgets/Wallpaper;
TOOLS: Apps/AI Studio; APP: About), version and Running status in footer.
The workspace area shows the Widgets section active with a floating section
label "DESKTOP / Widgets" and a soft radial orange glow at top-right.
No heavy header bar. Sidebar has a single 1 px right-edge border.
```

### S2 — Theme Scene: Widgets Browse
```
...template above...
Show the full Widgets workspace as the Sky theme environment — the default Browse
state, immediate, no gallery step. Background: sky gradient (#b8d0f0 top, #e8f2ff
center). ONE hero widget tile (Analog Clock) at 1.5x scale in the center; 5 smaller
tiles (digital clock, date, weather, system, battery) around it. All tiles: frosted
glass, white-blue palette, drop shadows. Cloud wisps drifting at corners.
Top bar: view tabs left (Browse v Sky / On desktop 3 / Saved 1), and 7 small colored
squares right — each the atmosphere color of a theme, active one has a white border
ring. Bottom: dark translucent filter bar with category pills and search.
No "back" needed — this IS the home state.
```

### S3 — Widget Catalog in Theme
```
...template above...
Show the Sky theme widget catalog: workspace background is the sky scene (slightly
dimmed). Overlaid: a scrollable catalog with a "<- Back" link top-left, category
headers in sky navy color. Cards are frosted glass with white-blue chrome, live
widget previews, sky-blue "Add" buttons. Category: "TIME — 5 designs" with 3
visible cards. Filter chips at top in sky palette: [All ACTIVE] [Time] [System] etc.
```

### S4 — Customize Sheet
```
...template above...
Show the widget customize sheet sliding in from the right over the Sky catalog.
Sheet is 360 px wide, dark (#12151b), left edge has a 3 px sky-blue stripe.
Inside: header "New widget . Sky Analog Clock", large live preview in a dark
stage with sky-glow behind, Design variant chips (Analog selected), LOOK controls
(Theme/Background/Colour/Blur), SURFACE controls (Corners/Border/Content),
collapsed Advanced section, Cancel and "Add to desktop" footer buttons.
```

### S5 — On Desktop Manager
```
...template above...
Show the "On desktop" tab. Workspace background has a subtle radial glow in the
last-used theme's atmosphere color (replacing the default orange bloom — maintains
continuity from the Browse scene). Header: "On the desktop — 3 widgets" with
[Edit layout ->] button right. Three full-width list cards, each: 80x56 px live
preview thumb left, widget name + status dot (Running/Hidden) + meta row (kind,
size, variant) + runtime CPU/MB, second row with Design/Theme/Opacity selects,
third row with compact action buttons [Show] [Lock] [Customize] [Duplicate] [...].
Dark panels, base dark palette, no full theme styling but the background tint
provides continuity. At bottom: dashed "+ Add widget" row.
```

### S6 — Saved AI Library
```
...template above...
Show the "Saved" tab. Same subtle theme-tinted background glow as On Desktop.
Header: "AI Generated — 1 saved" with search input and date sort dropdown right.
A grid of AI widget cards (minmax 200px, 1fr), each: 16:9 live preview top,
widget name, dimensions, 2-line truncated prompt, date, [Add copy] quiet button
and [...] menu. Dark panels, base dark palette.
```

---

## Part 7 — Constraints and Rules for Stitch

1. **No remote assets.** All textures are CSS gradients, SVG shapes, or
   noise generated via CSS. No stock photos, no icon libraries.
2. **Dark-first.** Every screen is dark mode. Light mode is an override.
   Avoid pure black — use `#08090c`.
3. **Restrained accent.** Orange accent (`#ff7a45`) appears on CTAs, active
   states, and the brand mark only. Not used as background fill anywhere.
4. **Theme colors are scoped.** Sky blues, forest greens etc. appear only inside
   the theme scene area and themed widget chrome. The sidebar, sheet controls,
   and general UI stay in the base dark palette.
5. **Depth through layers, not color.** Use box-shadow, backdrop-filter, layered
   backgrounds, and subtle borders — not color gradients — to create depth.
6. **Text is always readable.** Min contrast 4.5:1 for body text. Every themed
   widget tile must have sufficient contrast. `--faint` is `#7a8294` (4.6:1),
   never darker. All theme CTAs have been verified at AA.
7. **Density is intentional.** This is an 880 x 620 px desktop app. Keep content
   tight. Do not introduce large empty areas or web-dashboard-scale padding.
8. **Preserve existing nav.** The 6 sections (General, Widgets, Wallpaper, Apps,
   AI, About) and 3 groups (Desktop, Tools, App) are fixed — do not change them.
9. **Focus states required.** Every interactive element in the themed scene must
   show `:focus-visible` with `outline: 2px solid {theme-highlight}` and
   `outline-offset: 2px`. Never remove focus indicators.
10. **Responsive.** The design must work at 720 x 520 (see Part 8).

---

## Part 8 — Responsive Behavior (720 x 520 minimum)

At 720 px window width with 180 px sidebar (compressed), workspace = **540 px**.

| Element | 880 px (default) | 720 px (minimum) |
|---|---|---|
| Sidebar | 220 px | 180 px (labels remain, counts hide) |
| S2 scene tiles | 1 hero + 5-6 secondary | 1 hero (1.2x, not 1.5x) + 4 secondary |
| S2 tile scatter | Full organic layout | Tighter scatter, reduced spacing |
| S3 catalog grid | 3 columns | 2 columns |
| S4 customize sheet | 360 px | 300 px, or full workspace width |
| Theme selector | 7 color squares + labels | 7 color squares only (no labels) |
| Filter bar pills | Full text labels | Abbreviated or scroll horizontally |
| S5 desktop cards | Full controls visible | Controls wrap to 2 rows |
| S6 saved grid | `minmax(200px, 1fr)` | Single column |

At any width below 820 px:
- Toast stack shifts to `bottom: 16px; right: 16px` and max-width shrinks to 260 px
- Sheet backdrop click area is still accessible (min 60 px visible behind sheet)

---

*Document version: 1.2 — 2026-10-28*
*Author: Design spec written from user's vision and reference images.*
*Changes in v1.2: applied design review — fixed WCAG contrast failures (--faint,*
*Sakura CTA), brightened Forest and Midnight atmospheres, shifted Ember to amber-gold,*
*gave Glass a tinted base, added hero tile hierarchy, merged nav bars, added responsive*
*breakpoints, focus states, loading/error states, light mode notes, theme tint for*
*S5/S6 continuity. See design-review.md for full rationale.*
*For implementation: see docs/ui-handoff/03-widgets.md for component contract.*
