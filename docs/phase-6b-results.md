# Phase 6B results - live video and HTML wallpapers

- Date: 2026-10-27
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Spike build: Windows 11 25H2 `10.0.26200.9711`, x64, 125% scaling, one display
- Strategy: `progman-child` (owner-confirmed spike, 2026-10-26)
- Manual live-wallpaper acceptance: **PASS** (owner, 2026-10-27)

## Gates

| Check                  | Result | Evidence                                                                   |
| ---------------------- | ------ | -------------------------------------------------------------------------- |
| `npm run lint`         | PASS   | ESLint completed with no findings.                                         |
| `npm run typecheck`    | PASS   | Node and web projects.                                                     |
| `npm test`             | PASS   | 22 files / 173 tests; new live-policy, attach-strategy and protocol tests. |
| `npm run build`        | PASS   | Main, preload, wallpaper host, settings, widget shell and thumbnail page.  |
| `npm run build:unpack` | PASS   | `dist/win-unpacked/HomeLayer.exe`; host page and preload are packaged.     |

## Implemented

- Native desktop attach in `src/main/native/wallpaper-attach.ts`, based on the proven spike:
  `Progman` discovery, `0x052C` spawn-worker request, layout detection, child-style conversion,
  `SetParent`, relative physical-pixel placement, `progman-child` insert after
  `SHELLDLL_DefView`, classic `WorkerW` fallback, and `HL_WP_STRATEGY` selection.
- Fullscreen/pause signal in `src/main/native/fullscreen.ts`:
  `SHQueryUserNotificationState` values 2/3/4 plus foreground-window monitor coverage with
  desktop/taskbar exclusions.
- Per-display host windows in `src/main/windows/wallpaper-window.ts`; display changes rebuild
  all live windows. Host windows use the existing widget session partition, sandboxing,
  context isolation, no taskbar entry, and no focus.
- Video and HTML host page in `src/renderer/wallpaper-host/`, with Fill/Fit/Stretch/Center
  object-fit mapping, muted/loop/autoplay video, and a sandboxed `allow-scripts` iframe for
  HTML wallpapers.
- HTML wallpapers use `widget://wp-<id>/index.html` mapped into `wallpapers/<id>/`; the widget
  protocol skips SDK injection for wallpaper hosts and keeps the no-network CSP. Local
  `widget:` assets are allowed for HTML wallpaper styles, images, fonts, and media.
- `hl-wallpaper://media/<id>/<filename>` serves MP4/WebM with `Accept-Ranges`, bounded,
  open-ended and suffix ranges, `206` responses, `HEAD`, and `416` for invalid ranges.
- Live controller in `src/main/services/wallpaper-live.ts`:
  - pause for notification/fullscreen state, battery rule, lock, suspend, and tray pause;
  - pause/resume events to video and HTML hosts;
  - normalized 0..1 mouse coordinates plus `mouseMove` forwarding for interactive HTML;
  - Explorer-restart recovery every 3 seconds;
  - post-login `Progman` wait up to 30 seconds;
  - static fallback before attach (video poster, original Windows wallpaper, then first image);
  - retry notices when attachment fails.
- Settings UI: Set live, live fit options, interactive HTML toggle, pause-on-battery,
  mute videos, and live hints. Fullscreen/notification pause follows the Phase 6B rules
  automatically.
- Tray: optional **Pause live wallpaper** checkbox.
- Media warnings: above 500 MB at import; optional `ffprobe` probe warns above 1080p or
  30 fps when `ffprobe` is available.

## Spike evidence carried forward

The owner-confirmed spike attached a child of `Progman` after `SHELLDLL_DefView`. It kept the
IDE visible, showed the layer on Win+D, kept `Shell_TrayWnd` visible, and kept the child style
without `WS_EX_LAYERED`/`WS_EX_TRANSPARENT`. `setIgnoreMouseEvents(true)` was rejected because
it made the layer composite over running apps. Results remain in
`out/spike-wallpaper-result.json` and `out/spike-wallpaper.log`.

## Manual result

- 2026-10-27: Owner reported the manual Phase 6B checklist passes on the current machine.
- The owner confirmed the Settings and tray UI.
- Record the exact Windows build, monitor/scaling row, strategy, and CPU/GPU numbers in the
  test matrix before marking Phase 6B fully complete.

## Still required

- Test the acceptance checklist on the Windows test matrix; no non-owner build has been run.
- Measure CPU/GPU for a 1080p 30 fps H.264 loop.
- Confirm the classic `WorkerW` strategy on a classic-layout build.
- Record the manual result details in the test matrix.
- Phase 5 manual acceptance remains pending.
