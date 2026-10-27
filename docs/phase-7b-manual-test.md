# Phase 7B manual verification

Status: automated checks pass; interactive desktop checks are pending.

## Automated checks (2026-10-27)

- `npm run typecheck`, `npm run lint`, `npm test` (199 tests), and `npm run build` pass.
- All eight built-in directories contain an index page, a variant bootstrap, and a theme
  listener; they load without a manual SDK tag and their inline JavaScript parses.
- Isolated Electron smoke run with `--user-data-dir`:
  - Settings opens at 880 x 620 and every sidebar tab is reachable.
  - Live previews load from `widget://_builtins/<type>/index.html?variant=<id>&preview=1`.
  - Clock preview switches from `classic` to `neon` and the advertised size updates.
  - App-grid preview loads with demo apps.
  - Dark, light, Teal, and Dot choices apply immediately.
  - Changing tabs resets the workspace scroll position.
  - At 720 x 520 the sidebar stays usable, the gallery becomes one column, and no horizontal
    overflow appears.
  - No renderer console errors or page errors were reported.
- All 24 built-in variant previews were captured in dark and light modes. The comparison
  exposed a preview-only white background on transparent variants. The preview iframe
  inherited the settings page `color-scheme`, which made Chromium paint an opaque canvas.
  Setting `color-scheme: normal` on `.widget-preview iframe` restored transparency.
- System-wide cursor smoke run with an isolated profile:
  - The **Use outside HomeLayer** switch is disabled while the System pack is selected.
  - Selecting Neon enables it; turning it on persists `cursorSystemWide: true`.
  - Turning it off persists `cursorSystemWide: false` and calls the Windows restore path.
  - Quitting with it enabled restores the pointer; relaunching reapplies the saved pack.
  - `LoadCursorFromFileW` loaded all three generated `.cur` files and a direct
    `SetSystemCursor`/`SPI_SETCURSORS` check succeeded.
  - The packaged `build:unpack` app loaded the unpacked `.cur` assets, applied Pixel, and
    restored the pointer on quit.

## Interactive checks still required

- [ ] Drag, resize, and merge app-grid bundles on the desktop.
- [ ] Confirm widget rounded corners stay transparent over a light and a dark wallpaper.
- [ ] Change opacity on the desktop and confirm corners remain rounded.
- [ ] Toggle edit mode and check the custom cursor pack on the overlay and buttons.
- [ ] Enable **Use outside HomeLayer** with Dot, Neon, and Pixel; check the pointer over the
      desktop and another app, then disable it and confirm the Windows pointer returns.
- [ ] Quit with the system-wide cursor enabled and confirm the Windows pointer is restored;
      relaunch and confirm the saved pack is reapplied.
- [ ] Check the system-wide cursor at 100%, 125%, and 150% scaling and confirm text, hand, and
      resize cursors remain native.
- [ ] Switch a desktop widget between every design and restart to confirm persistence.
- [ ] Resize a widget larger than its default, switch design, and confirm the custom size is
      kept and only clamped when below the new minimum.
- [ ] Open saved AI widgets, preview them, and confirm the locked placeholder for widgets that
      cannot preview.
- [ ] Check keyboard navigation and visible focus on every tab and dialog.
- [ ] Check reduced-motion behavior.
- [ ] Check Windows display scaling at 100%, 125%, and 150%.
- [ ] Re-run onboarding from a fresh profile and confirm it reaches the sidebar shell.
