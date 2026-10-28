# 02 — General

**Source:** `src/renderer/settings/GeneralPanel.tsx`,
`CursorGallery.tsx`, `ColorPicker.tsx`, `SliderField.tsx`
**Styles:** `main.css` — `.appearance-panel`, `.appearance-group`, `.segmented-control`,
`.accent-row`, `.hotkey-recorder`, `.cursor-gallery*`, `.maintenance-grid`,
`.setting-row`, `.switch`, `.color-picker*`, `.slider-field`

## 1. Purpose

General is the "whole app" tab: launch with Windows, the global edit-layout
shortcut, settings/widget theme, accent, the custom cursor pack, and maintenance.
It should answer three questions fast: *How does HomeLayer start and get invoked?
How does it look? How do I recover or inspect it?*

## 2. Current layout

```
General
Startup, appearance and maintenance for the whole app.        ● Running   v1.4.2
──────────────────────────────────────────────────────────────────────────────
┌─ Startup ──────────────────────────────────────────────────────────────────┐
│ Startup, appearance and maintenance for the whole app.                     │
│ Start HomeLayer with Windows                         [switch]              │
│ HomeLayer starts hidden in the tray.                                       │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Edit-layout shortcut ─────────────────────────────────────────────────────┐
│ Press the shortcut to toggle edit mode from anywhere.                      │
│ [Ctrl+Alt+E]                                    [Record shortcut]           │
└────────────────────────────────────────────────────────────────────────────┘
┌─ Appearance ───────────────────────────────────────────────────────────────┐
│ Set the mood for settings and widget chrome…                               │
│ Settings theme              [ Dark ][ Light ][ Use Windows setting ]        │
│ Widget default theme        [ Dark ][ Light ][ Use Windows setting ]        │
│ Accent colour               [● Ember ✓][● Violet][● Teal][● Rose]           │
│                                                                            │
│ Cursor pack                                                                │
│  [System][Dot][Neon][Pixel][Ring][Crosshair][Arrow]                        │
│  ┌────────────────── live stage ──────────────────┐  Colour  [picker…]    │
│  │  two skeleton cards + cursor image + hint      │  Size    [slider] 14px │
│  │  “Move and click here to try the cursor”       │  Opacity [slider] 90%  │
│  └────────────────────────────────────────────────┘  Glow    [slider] 60%  │
│                                                      Click animation       │
│                                                      [Ripple][Burst][None] │
│  Use outside HomeLayer                                          [switch]   │
│  Replaces the normal Windows arrow…                                        │
│                                                      [Cancel] [Apply cursor]│
└────────────────────────────────────────────────────────────────────────────┘
┌─ Maintenance ──────────────────────────────────────────────────────────────┐
│ Reset layout      Removes every widget…                 [Reset layout]      │
│ Open data folder  Open layouts, settings, logs…         [Open]              │
│ Export diagnostics Copies the last three log files…     [Export diagnostics]│
└────────────────────────────────────────────────────────────────────────────┘
```

All sections are full-width `.panel.panel-wide` cards in a single column. The
appearance card is by far the tallest; the cursor gallery alone can exceed the
viewport height.

## 3. Component and control inventory

| Area | Control | Behaviour | IPC |
|---|---|---|---|
| Startup | Switch | Optimistic? No; pending state disables all controls until resolved | `setStartWithWindows` |
| Shortcut | `<kbd>` + Record button | Click toggles recording; captures next chord at window level; Escape cancels; requires modifier or F-key | `setHotkey` |
| Appearance | Settings theme segmented | Instant apply + persist | `setTheme` |
| Appearance | Widget default theme segmented | Instant apply + persist | `setWidgetDefaultTheme` |
| Appearance | Accent choices (4) | Instant apply; swatch + label + check | `setAccent` |
| Cursor | Style radio row (7) | Updates a local draft only | — |
| Cursor | Live stage | Clicking pulses the selected click animation | — |
| Cursor | Colour picker | Draft only; disabled for System | — |
| Cursor | Size 8–24 px | Draft only; disabled for System | — |
| Cursor | Opacity 10–100% | Draft only; disabled for System | — |
| Cursor | Glow 0–100% | Draft only; enabled only for Neon/Ring | — |
| Cursor | Click animation segmented | Draft only; disabled for System | — |
| Cursor | "Use outside HomeLayer" switch | Draft only; Windows; only Dot/Neon/Pixel | — |
| Cursor | Cancel / Apply | Revert draft / commit | `setCursor` |
| Maintenance | Reset layout | Native `window.confirm`; info toast on cancel | `resetLayout` |
| Maintenance | Open data folder | Opens Explorer | `openDataFolder` |
| Maintenance | Export diagnostics | Copies logs + version; success toast with folder | `exportDiagnostics` |

`GeneralState` fields used: `theme`, `resolvedTheme`, `widgetDefaultTheme`,
`resolvedWidgetTheme`, `accent`, `hotkey`, `cursor`, `loginItemAvailable`,
`loginItemEnabled`, `safeMode`, `safeModeReason`, `failedStarts`, `version`,
`platform`, `arch`, `onboardingCompleted`.

## 4. Copy inventory

Startup:
- **Startup** / intro **Startup, appearance and maintenance for the whole app.**
- **Start HomeLayer with Windows**
- Hint: **HomeLayer starts hidden in the tray.** or **Available after installing a
  packaged build.**

Shortcut:
- **Edit-layout shortcut** · **Press the shortcut to toggle edit mode from anywhere.**
- **Record shortcut** → **Press keys...** · hint **Press Escape to cancel.**
- Errors: **Use Ctrl, Alt or Win with another key, or a function key.**
- Success: **Shortcut changed to {hotkey}.**
- Failure: **Could not register {hotkey}. Another app may be using it; the previous
  shortcut is still active.**

Appearance:
- **Appearance** · **Set the mood for settings and widget chrome. Each widget keeps
  its own character.**
- **Settings theme** · **Controls the appearance of this settings window only.**
- **Widget default theme** · **Default look for new widgets. Each widget can override it.**
- Options: **Dark**, **Light**, **Use Windows setting**
- **Accent colour** · **Used for focus, controls and selected designs.**
- **Ember**, **Violet**, **Teal**, **Rose**
- **Cursor pack** (title exists in i18n but is not rendered as a heading today; the
  gallery follows the accent row directly)

Cursor:
- **Colour**, **Size**, **Opacity**, **Glow intensity**, **Click animation**,
  **Ripple**, **Burst**, **None**
- Stage hint: **Move and click here to try the cursor**
- Scope: **Use outside HomeLayer**; hint **Replaces the normal Windows arrow in every
  app while HomeLayer runs. Text, resize and hand cursors stay native. Restores when
  HomeLayer quits; if it crashes, relaunch and switch this off.**
- Unsupported: **This style works inside HomeLayer only. Choose Dot, Neon or Pixel for
  system-wide.**
- **Cancel**, **Apply cursor**; success **Cursor updated.**

Maintenance:
- **Reset layout** · **Removes every widget from the desktop. Widget files and settings
  are kept.** Confirm: **Remove every widget from the desktop? Widget files stay on
  disk.** Confirm success **Desktop layout reset.** Cancel **Layout reset cancelled.**
- **Open data folder** · **Open layouts, settings, logs and widget files.**
- **Export diagnostics** · **Copies the last three log files and version information.**
  Button **Export diagnostics** → **Exporting...**; success **Diagnostics copied to {folder}.**

## 5. Interaction and state notes

- `pending` is a single string shared by all actions; while any request is in flight,
  every control in General is disabled. This creates unnecessary coupling.
- Theme and accent apply immediately (and the window updates), while cursor changes
  are a draft with explicit Apply/Cancel. Users must learn two different commit models
  on the same screen.
- `CursorGallery` is keyed by `JSON.stringify(general.cursor)`, so applying or external
  theme changes remount it. A draft is lost if the parent re-renders with a different
  cursor.
- The cursor stage simulates clicks; it does not affect the OS pointer. The actual
  preview image is drawn centered over two skeleton cards.
- `systemWide` is only supported for `dot`, `neon`, `pixel`; choosing another style
  turns it off silently. The switch labels the limitation via a hint.
- Color picker: native `<input type="color">` is the swatch; a second native picker is
  behind the wheel button; EyeDropper appears only when supported. Palette filters are
  hardcoded English (`All`, `Vibrant`, `Deep`, `Pastel`, `Grays`); 56 named swatches.
- Reset uses a blocking native dialog and pushes a toast even when the user cancels.
- No success toast for theme/accent changes; the visible change is the feedback.

## 6. Current styling notes

- Panels are 14 px radius, 22 px padding, 1 px border, flat until hover.
- Section headings: 17 px; body 11–12 px muted; intro paragraphs max ~70 ch.
- Settings rows use a two-column layout (copy left, control right) with a 48 px
  minimum; `setting-row-compact` reduces padding.
- Segmented control: 3 px padding, 7 px radius per segment, active uses raised panel
  + border + text, no accent fill (except segmented in the customize sheet also uses
  same treatment).
- Accent choices are 36 px tall, 8 px radius, swatch 18 px, active gets accent border
  + check circle.
- Cursor style row is horizontally scrollable on narrow widths; each cell is a
  74 px card with 28 px art.
- Cursor stage is a dark dotted panel, min-height 150 px, with two low-contrast
  skeleton cards; pointer image is centered and partially transparent.
- Maintenance is a 3-row grid with copy and button; destructive row uses danger
  outlined button, not a filled red button.

## 7. UX observations

1. **Mixed semantics**: theme/accent save instantly; cursor needs Apply. A user can
   change theme, then move a cursor slider, then close the window expecting the cursor
   to persist. Conversely, Cancel in the cursor section does not cancel theme changes.
2. **Too much inside Appearance**: cursor is a full-featured feature (7 styles, 4
   sliders, color picker, animation, OS-wide scope) nested as a sub-block of a theme
   card. It deserves its own section or a dedicated preview page.
3. **Tiny type and low contrast** on hints (9–11 px, `--muted`), especially the
   long system-wide warning.
4. **Hotkey recording has no modal surface**; it silently captures keys and only
   communicates failure via toast. There is no list of conflicts or reset-to-default.
5. **Startup card is mostly explanation** for a single toggle; the dev-build disabled
   state is a hint only.
6. **Reset is a native confirm** and sits one row away from "Open" and "Export".
   It also has the same-size button as safe actions.
7. **Maintenance copy is technical** ("diagnostics", "data folder") and the three
   actions have equal weight.
8. **Color picker is disproportionate**: a 56-swatch grid plus filters inside a
   settings card, with untranslated labels and a duplicate native color wheel.
9. **Cursor scope switch is easy to miss** at the bottom of a long card, yet it has
   OS-wide consequences.
10. **No reset-to-default** for appearance or cursor; Cancel only reverts the current
    draft.

## 8. Design brief for the AI

Rework General as a calm, scannable settings index rather than four stacked cards:

- Separate **Startup & shortcut**, **Appearance**, **Cursor**, and **Maintenance** so
  cursor is a first-class idea, not a nested block.
- Make commit semantics explicit and consistent. Preferred: everything applies
  immediately with a short "Saved" affordance and an undo; if you keep Apply for
  cursor, visually fence it as a live editor with a persistent "Unsaved changes" bar
  and disable navigation-away surprises.
- Replace the giant color picker with a compact, reusable color control (swatch +
  hex + a small curated row + "More") that opens a popover; the existing full picker
  can live in that popover.
- Present theme choices as visual mini-previews (not just words), especially
  "Use Windows setting"; show which one is currently resolved.
- Present cursor styles as a visual gallery with consistent preview art and a
  prominent live playground; keep the click animation test.
- Move "Use outside HomeLayer" next to the style choice or into a clearly labeled
  scope switch with an inline warning/confirmation; explain that only three styles
  support it instead of silently disabling.
- Turn shortcut recording into a small modal/inline capture state with clear
  "listening", cancel, conflict error, and a default/reset action.
- Demote maintenance into a subtle "Advanced" block, with destructive reset visually
  separated and requiring typed/inline confirmation rather than a native dialog.
- Keep all IPC calls and `GeneralState` fields; no new backend work.

## 9. Output format

Return updated `GeneralPanel.tsx` (plus extracted subcomponents if useful),
`CursorGallery.tsx`, and CSS. Provide an `en.json` key list for any new copy. Keep
`ColorPicker`/`SliderField` public props or document replacements. Verify the layout at
720 × 520 and with reduced motion.
