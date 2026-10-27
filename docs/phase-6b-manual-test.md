# Phase 6B manual test - live video and HTML wallpapers

Use the packaged app for the final run. The automated gates cover build, types, lint, and pure
logic; this checklist covers the desktop, Explorer, monitor, pause, and fallback behavior that
needs a real Windows session.

## Setup

1. Build and launch:
   ```
   npm run build:unpack
   dist\win-unpacked\HomeLayer.exe
   ```
2. Open **Settings > Wallpaper**.
3. Prepare:
   - one H.264 MP4 or VP8/VP9 WebM, ideally 1080p at 30 fps or lower;
   - one HTML folder containing `index.html`;
   - optionally a second monitor or a monitor you can unplug/replug.
4. Record the current wallpaper so it can be restored:
   ```
   reg query "HKCU\Control Panel\Desktop" /v WallPaper
   reg query "HKCU\Control Panel\Desktop" /v WallpaperStyle
   reg query "HKCU\Control Panel\Desktop" /v TileWallpaper
   ```
5. Keep the app log open:
   ```
   %APPDATA%\HomeLayer\logs\main.log
   ```
   Confirm it contains `Wallpaper strategy: ...` and `Live wallpaper attached` with the
   expected display and strategy.

## Video wallpaper

- [ ] Add the video, select it, choose **Fill**, and click **Set live**.
- [ ] The video plays behind the desktop icons, not over them.
- [ ] Desktop icons remain visible and clickable.
- [ ] Right-clicking empty desktop space still opens the normal desktop menu.
- [ ] The taskbar is unaffected.
- [ ] The wallpaper window is absent from Alt+Tab.
- [ ] Win+D shows the video layer, then restores the apps.
- [ ] Switch through **Fit**, **Stretch**, and **Center** and confirm the expected framing.
- [ ] **Tile** and **Span** are not offered for live video.
- [ ] Toggle **Mute videos** off; if the browser blocks unmuted autoplay, note it and turn the
      setting back on. Turn it on and confirm the video is silent.
- [ ] Restart the app; the live video resumes without applying a static image permanently.

## Pause and resume

- [ ] Start a fullscreen video or game. The wallpaper pauses within 3 seconds.
- [ ] Exit fullscreen. The wallpaper resumes.
- [ ] Open a presentation/fullscreen notification state if available; the wallpaper pauses.
- [ ] Enable **Pause on battery**, unplug the charger, and confirm the wallpaper pauses.
      Reconnect power and confirm it resumes.
- [ ] Disable **Pause on battery** and repeat; the wallpaper keeps playing.
- [ ] Lock Windows. Unlock it and confirm the wallpaper resumes.
- [ ] Suspend the PC, wake it, and confirm the wallpaper resumes.
- [ ] Right-click the tray icon and enable **Pause live wallpaper**; confirm pause. Disable it
      and confirm resume.
- [ ] Start a fullscreen app while the tray pause is active; after exiting, the tray pause
      remains in effect until explicitly cleared.

## Recovery and fallback

- [ ] Open Task Manager, restart **Windows Explorer**, and confirm the wallpaper returns within
      5 seconds.
- [ ] Unplug a monitor (or disable it in Display settings) and confirm the remaining displays
      still show the wallpaper correctly.
- [ ] Reconnect the monitor and confirm a window is rebuilt at the correct position and scale.
- [ ] Start a live wallpaper, then end `HomeLayer.exe` from Task Manager. The desktop must show
      the static fallback, not black.
- [ ] Restart HomeLayer and confirm the saved live wallpaper is restored.
- [ ] Remove the current live wallpaper; confirm the live window closes and the static
      wallpaper is restored.
- [ ] Click **Restore Windows wallpaper**; confirm live mode stops and the first-run wallpaper,
      style, and tile are restored.

## HTML wallpaper and sandbox

Create a test `index.html` that:

- displays a moving element and a dot that follows `mousemove`;
- listens for `message` events and displays the `hl-pause` state;
- tries `fetch('https://example.com')` and displays either success or the error.

Then:

- [ ] Add the HTML folder, select it, and click **Set live**.
- [ ] The HTML page renders behind the icons; icons and desktop right-click still work.
- [ ] Enable **Interactive** and move the mouse over empty desktop space. The dot follows the
      cursor (normalized coordinates and forwarded mouse movement).
- [ ] Clicks are not required for v1; do not treat missing click interaction as a failure.
- [ ] The network fetch is blocked and the page reports the error.
- [ ] Pause the wallpaper from a fullscreen app or the tray; the page receives `hl-pause`.
- [ ] Resume and confirm the page receives the resumed state.
- [ ] Disable **Interactive** and confirm mouse forwarding stops.

## Media warnings

- [ ] Import a video above 500 MB and confirm a non-blocking warning appears.
- [ ] If `ffprobe` is available, import a video above 1080p or 30 fps and confirm the
      resolution/frame-rate warning appears.
- [ ] Without `ffprobe`, confirm the import still succeeds and only the size warning may appear.

## Windows test matrix

Record PASS/FAIL and the strategy from the log for each row.

| Windows build            | Monitors | Scaling       | Strategy used | Result |
| ------------------------ | -------- | ------------- | ------------- | ------ |
| Windows 10 22H2          | 1        | 100%          |               |        |
| Windows 11 23H2          | 1        | 125%          |               |        |
| Windows 11 24H2 or newer | 1        | 150%          |               |        |
| Any of the above         | 2, mixed | 100% and 150% |               |        |

Also test `HL_WP_STRATEGY=auto`, `classic`, and `progman-child` where the layout allows it.
The owner-confirmed build uses `progman-child`.

## Performance

- [ ] Measure CPU and GPU for a 1080p 30 fps H.264 loop with hardware decoding.
- [ ] Record the result here: CPU ____%, GPU ____%.
- [ ] Target is under 5% CPU on a laptop; this is a target, not a guarantee.

## Result

Record PASS/FAIL, Windows build, strategy, monitor/scaling details, and screenshots in
`docs/phase-6b-results.md`. Do not mark Phase 6B complete until every acceptance item above
passes on the owner's machine and the supported test matrix is recorded.
