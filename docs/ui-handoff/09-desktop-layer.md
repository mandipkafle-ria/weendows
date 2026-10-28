# 09 — Desktop layer (widget shell, overlays, wallpaper, App Grid)

**Sources:** `src/renderer/widget-shell/main.ts` + `style.css`,
`src/main/windows/layout.ts`, `widget-window.ts`, `widget-badge-window.ts`,
`popover-window.ts`, `src/main/native/wallpaper-attach.ts`,
`src/renderer/wallpaper-host/**`, `src/renderer/wallpaper-thumbnail/main.ts`,
`src/renderer/settings/WidgetPreview.tsx`, `resources/builtin-widgets/**`

## 1. Scope

This is the UI **outside the settings window**: widgets living on the Windows
desktop, their edit overlay, the bundle popover, the crash badge, and the wallpaper
behind desktop icons. It is the product people actually see all day, yet its chrome is
much rougher than the settings window.

The built-in widgets themselves are separate mini-apps (HTML/CSS/JS) with their own
visual systems. This document inventories them but does not ask for a full redesign of
all eight; the primary target is the **shell/edit overlay and desktop chrome**.

## 2. Layer map

```
Windows desktop (Explorer)
├── WorkerW / Progman layer
│   └── HomeLayer wallpaper host (full-screen, behind desktop icons)
├── Desktop icons (Explorer-owned, not ours)
├── Widget windows (transparent, frameless, one per widget)
│   ├── widget-shell: <iframe src="widget://…"> + edit overlay
│   └── (optional) crash badge window (236×42, always-on-top toolbar)
├── Bundle popover (transparent, always-on-top, anchored to an App Grid tile)
└── Settings window (separate; not part of this layer)
```

- Widgets are normal desktop windows: `frame: false`, transparent, no taskbar entry,
  no shadow, shown inactive (`showInactive`), title = widget name, and focusable only
  for widgets that need typing/clicking (e.g. Notes, Weather, App Grid). They are not
  click-through by default.
- The wallpaper host is attached behind the icon layer using `WorkerW`/`Progman`
  native code; HTML wallpapers are sandboxed and receive pause/mouse events.
- There is no desktop "canvas" UI of our own; Explorer still owns icons, selection,
  and wallpaper behaviour. HomeLayer adds floating windows and an edit layer.

## 3. Widget shell and edit overlay

### Layout

```
┌──────────── widget window (exact width × height) ─────────────┐
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │              widget iframe (sandboxed)                  │  │
│  │                                                         │  │
│  │                                       (edit mode only)  │  │
│  │   ┌ 2px dashed border around the whole window ───────┐   │  │
│  │   │                                     [gear] [×]    │   │  │
│  │   │                                                ◢  │   │  │
│  │   └───────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
  gear = Edit with AI (opens settings AI tab for this widget)
  ×    = Remove widget
  ◢    = resize handle (20×20 dotted corner)
  drag = anywhere on the overlay when unlocked
  passthrough widgets (App Grid): drag only via a dotted pill at top center
```

The overlay is hidden unless edit mode is on. It is a full-size border box with a
2 px dashed light border, a faint accent wash, and `cursor: grab` (custom cursor if a
cursor pack is selected). Buttons are 26 px circular, dark translucent with 8 px
backdrop blur and inline SVG icons. On locked widgets the overlay border fades and
toolbar/resize handle disappear; dragging is disabled.

Overlay state matrix:

| State | Border | Background | Toolbar | Drag | Resize |
|---|---|---|---|---|---|
| Edit mode, unlocked | 2 px dashed light | accent 3.5% | visible | whole overlay | corner |
| Edit mode, locked | 2 px dashed 24% | transparent | hidden | disabled | hidden |
| Passthrough, unlocked | dotted | transparent | visible; buttons clickable | only top pill | only corner |
| Passthrough + locked | dotted | transparent | hidden | disabled | hidden |
| Edit mode off | none | none | none | n/a (iframe interactive) | n/a |

### Interaction details

- Entering edit mode: global hotkey, tray menu, right-click context menu on a widget,
  or **Edit layout** in Widgets settings. All call `setEditMode(true)`.
- Dragging uses pointer capture on the overlay. Drag end calls `drag-end`; the main
  process snaps to a grid step (`SNAP_STEP_DIP`) and clamps to the work area.
  **Hold Alt** during drag to bypass edge magnetism to other widgets.
- Resizing starts only from the bottom-right 20 px handle; minimum sizes come from the
  selected variant (`minWidth`/`minHeight`); the window cannot be resized beyond the
  work area.
- Locked widgets cannot be moved/resized; the toolbar is hidden, but right-click still
  offers Unlock.
- Gear opens the settings window with `?editWidget=<id>` and switches to AI. It is
  shown for **all** widgets, including built-ins that the AI editor cannot revise.
- `×` opens the main-process native warning dialog (**Cancel** / **Remove**, with the
  widget name and type-specific detail); confirming removes, and there is no undo in
  the overlay.
- Escape / clicking outside does not exit edit mode; the user must trigger the hotkey
  or the settings button again.
- The overlay has no visual snap guides, alignment lines, dimension readout, or
  multi-select. The only feedback is the window position itself.
- Right-click (when not suppressed) opens a native menu: Edit layout, Edit with AI
  (except AI previews), Lock/Unlock, Opacity (100/80/60%), Reload widget, Remove
  widget.

## 4. Crash / unresponsive badge

A separate 236 × 42 toolbar window appears at the widget's top-right (clamped to the
display work area) when a widget crashes or stops responding:

```
┌──────────────────────────────────────────────┐
│ ● Widget crashed          [Reload] [Disable] │
└──────────────────────────────────────────────┘
```

- Dark red translucent panel, 12 px radius, red dot, 12 px semibold label.
- **Reload** retries; **Disable** hides the widget and records a reason.
- Labels are hardcoded English (**Widget crashed**, **Widget not responding**,
  **Reload**, **Disable**); the badge uses a fixed dark red theme and does not follow
  the app theme, accent, or cursor.
- It is always-on-top, focusable, and positioned above the widget; it is not modal.
- The same underlying “disabled” state appears in Widgets settings as
  `Disabled: {reason}` with a red runtime badge.

## 5. Bundle popover (App Grid)

When a bundle/folder tile in an App Grid widget is opened, a separate frameless,
always-on-top popover window appears anchored to the tile:

- Width fixed (`BUNDLE_POPOVER_WIDTH`), height based on app rows (max rows constant),
  clamped to the work area.
- Sandboxed `popover.html` from the App Grid resources, themed by the App Grid variant
  (classic, monochrome, glass, cyberpunk, minimal, retro).
- Contains a title (editable), app count, app tiles, drag/reorder, remove-from-bundle,
  launch on click, and a close affordance.
- Closes on Escape, blur (after a grace period), reload, or when the parent widget
  closes. One popover at a time.
- It looks like a standalone mini window, not part of the settings design system.

## 6. Wallpaper host and thumbnails

- Full-screen borderless window attached behind desktop icons via
  `WorkerW`/`Progman`; content is one of:
  - image (`<img>`, object-fit based on fit),
  - video (`<video autoplay loop muted playsinline>`; fit; pause events),
  - HTML (`<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">`; pause and
    mouse-move messages).
- The host page is pure black until content loads; errors render centered white text on
  black (“Wallpaper source missing”, “Unsupported wallpaper type”).
- Thumbnails: image thumbnails via `hl-wallpaper://thumb/<id>`; video thumbnails are
  generated by a hidden renderer that loads the video, seeks to ~1 s, draws a canvas,
  and returns a PNG data URL; HTML uses a generic card in settings.
- No chrome, no overlay, no controls on the desktop itself. Live wallpaper cannot be
  paused from the desktop except via the policy (battery/fullscreen) or settings.

## 7. Built-in widget families (visual inventory)

All widgets are standalone HTML with their own CSS variables, light/dark support,
variant selectors (`html[data-variant=…]`), and a transparent background. They are
sized by the host window and largely fill it.

| Widget | Variants and character | Default size | Permissions / notes |
|---|---|---|---|
| Clock | Classic (editorial serif-ish numerals), Minimal (large time), Neon (cyan glow), Analog (dial), Terminal (mono green) | 240×140 | — |
| Date | Classic, Editorial (large date page), Minimal | 240×140 | — |
| Calendar | Grid, Compact, Paper (warm/print) | 280×300 | — |
| System | Dots, Bars, Rings, Terminal; CPU/RAM sampled every 2 s | 240×160 | `system.stats` |
| Battery | Ring, Bar, Minimal; charge + state | 240×160 | `system.battery` |
| Notes | Warm, Paper, Slate; editable scratch pad with private storage | 280×220 | `storage`; focusable |
| Weather | Classic, Compact, Station; Open-Meteo current conditions | 300×220 | `network`, `storage`; hosts Open-Meteo; focusable |
| Apps (App Grid) | Classic, Monochrome, Frosted Glass, Cyberpunk, Minimal, Retro; own header, tile grid, add/folder/style drawer, context menu | 384×280 | `launch`; focusable; edit passthrough |

App Grid is effectively an app inside a widget:

- Header: editable title (max 32), status line, refresh, **+ Folder**, **Add apps**,
  gear (**Theme & Folder Style**).
- Grid: 80 px tiles with generated letter/gradient icons or real icons, labels;
  drag reorder, drag-merge into folders after hover, right-click menu.
- Add-apps picker: search, checkbox list, “Show hidden entries”, Cancel/Add.
- Create-folder modal: name (max 24), search, selection count, Cancel/Create Folder.
- Style drawer: Theme/Aesthetic (Classic, B&W Mono, Frosted Glass, Cyberpunk, Minimal,
  Retro), Folder Style (2×2 Grid, 3D Stack, Tabbed, Hero Badge), Icon Shape
  (Squircle, Circle, Soft Square), Hide labels toggle.
- Context menu: Launch App, Create Folder with App, Remove from Grid.
- Empty state: **No apps yet** / **Use Add apps to build your grid.**
- All labels are hardcoded English, and the drawer is visually independent of both the
  settings tokens and the other built-in widgets.

## 8. Bridge, security, and update behaviour

- Widget shell creates a sandboxed `<iframe sandbox="allow-scripts">` and a
  MessageChannel; it forwards widget API calls to main and enforces method/param size
  limits, heartbeat/pong timeouts, and unresponsive reporting.
- Widget iframe URLs are `widget://<id>/index.html?variant=…&rev=…`.
- Shell applies theme and cursor via `<html data-theme>` and `--hl-cursor`; appearance
  changes reload the iframe (with a `rev` cache-buster); theme changes also post a
  `theme` event.
- Widgets can be `focusable` (Notes, Weather, App Grid) or click-through-ish (others
  are non-focusable windows). App Grid is `editPassthrough`, so its own UI remains
  clickable in edit mode while the overlay only captures drag/resize affordances.
- Crash badges and disabled reasons are generated in main; the settings panel surfaces
  them. AI preview widgets are excluded from the Edit-with-AI menu item.
- Permission/network enforcement is in main; the overlay itself has no permission UI.

## 9. Styling notes and design debt

- Overlay colors are hardcoded (`rgba(244,241,234,…)`, `rgba(255,122,69,.035)`,
  `rgba(12,10,18,.82)`) rather than using settings tokens; the root has no
  `data-theme` styling for the overlay itself.
- Dashed border radius is fixed at 18 px, unrelated to the widget variant's actual
  corner radius (the iframe draws its own corners). On widgets with different radii the
  dashed box visibly mismatches.
- Toolbar buttons have no visible text labels or tooltips (only `aria-label`s and a
  hover background), so the gear does not visibly communicate “AI”.
- The resize handle is a 20 px dotted corner; at small widget sizes it overlaps content
  and the toolbar.
- Locked state removes all affordances, so users cannot tell a widget is locked except
  by trying to drag it.
- The drag pill appears only for passthrough widgets; other widgets drag from anywhere
  on the overlay, which can feel accidental.
- Badge uses English text and a fixed dark red look; no theme integration.
- App Grid has its own visual language (blue accents, chips, drawer) that does not use
  the settings accent tokens.

## 10. UX observations

1. **Edit mode is intimidating and unclear**: a dashed rectangle + two unlabeled
   circular icons, no onboarding, no legend, no exit affordance in the overlay.
2. **No settings shortcut**: the shell exposes Edit with AI and Remove only; there is
   no “Widget settings” or “Open in HomeLayer” affordance even though the shell has an
   IPC action to open settings.
3. **Gear is misleading for built-ins**: it opens the AI editor for widgets that cannot
   be edited there; the settings list correctly hides Edit with AI for built-ins.
4. **No dimensions or alignment feedback**: no size readout, snap guides, or center
   guides; Alt-to-disable-magnetism is undocumented in the overlay (only in settings
   copy).
5. **Lock state is invisible** until interaction; no lock badge in the overlay.
6. **Removal starts from a tiny ×** and relies on a native blocking warning dialog;
   the overlay gives no context about what will be removed, and there is no undo.
7. **Overlay mismatch with widget shape** (fixed 18 px radius dashed border) makes
   polished widgets look rough while editing.
8. **No multi-select, grouping, distribute, or z-order controls.** Desktop layout is
   one widget at a time.
9. **Crash badge is disconnected** from the app's look and language, and sits on top of
   the widget with no explanation of consequences.
10. **Wallpaper has no desktop affordance** (no “change wallpaper” on right-click of
    the desktop layer); users must open settings.
11. **App Grid duplicates settings**: its own style drawer, folder style, and hide-labels
    toggles overlap conceptually with the Widgets customization sheet, but use
    different visuals and storage.
12. **Built-in widgets are individually beautiful but inconsistent** in typography,
    radii, and control styles; there is no shared widget design token contract.

## 11. Design brief for the AI

Redesign the desktop chrome (not necessarily every built-in widget):

- **Edit overlay**: make it feel like a professional design tool. Use a clear selected
  state, a floating contextual toolbar with labeled actions (Settings, AI, Lock,
  Duplicate, Remove), a visible drag handle, and a resize affordance with dimension
  feedback. Show snap/alignment guides and centering hints while dragging; indicate
  when Alt disables magnetism.
- **State clarity**: locked widgets should have a subtle lock pill/handle; passthrough
  widgets should explain where to drag; edit mode should have a global exit affordance
  (e.g. a floating “Done” pill) in addition to the hotkey.
- **Accidental action safety**: confirm or undo removal; make destructive actions
  secondary in an overflow menu; never put remove one click away from resize.
- **Corner accuracy**: the overlay should follow the widget's actual corner radius or
  use a neutral selection outline that does not pretend to be the widget border.
- **Crash badge**: redesign as a compact, theme-aware problem card with plain-language
  title, one primary action, and an overflow (Reload / Disable / Open settings /
  Details). Use i18n and app tokens.
- **Desktop entry points**: add a discoverable way to open HomeLayer settings and
  wallpaper settings from the desktop (context menu on a widget or a small tray/menu
  affordance), using existing IPC if available.
- **App Grid**: at minimum align its drawer/chips with the app's tokens and accent;
  ideally unify its style/folder options with the widget customization model. Do not
  break its grid, drag-merge, or bundle behaviours.
- **Wallpaper host**: keep it invisible, but design the empty/error states and any
  first-run desktop hint so users understand the live layer.
- Preserve all window creation flags, pointer/drag/resize IPC, snap behaviour,
  permissions, sandboxing, and edit-mode semantics. No new native behaviour without
  marking it future work.

## 12. Output format

Return:
1. `widget-shell/main.ts` overlay markup changes + `widget-shell/style.css`.
2. A redesigned crash badge (HTML/CSS) and, if proposed, the main-process hook points
   (document them; do not silently change IPC).
3. App Grid drawer/theme token updates if in scope.
4. Notes on multi-monitor clamping, DPI, small widget sizes, and keyboard access.
5. No new dependencies; keep all sandbox attributes and security checks.
