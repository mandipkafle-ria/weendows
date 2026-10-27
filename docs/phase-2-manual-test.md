# Phase 2 manual test steps

Phase 2 checklist: [phase-2-widget-manager.md](../build-plan/phases/phase-2-widget-manager.md).

Use the packaged app, not the dev server, for the final run.

## Setup

1. Stop any running copy:

   ```powershell
   Get-Process HomeLayer -ErrorAction SilentlyContinue | Stop-Process -Force
   ```

2. Build the unpacked app:

   ```powershell
   npm run build:unpack
   ```

3. Start it:

   ```powershell
   .\dist\win-unpacked\HomeLayer.exe
   ```

4. Back up the live user data before destructive tests:

   ```powershell
   $data = Join-Path $env:APPDATA 'HomeLayer'
   Copy-Item "$data\layout.json" "$env:TEMP\homelayer-layout-backup.json" -Force
   ```

The layout lives at `%APPDATA%\HomeLayer\layout.json`. Widget manifests and files live at
`%APPDATA%\HomeLayer\widgets\<id>\`.

## 1. Add, drag, resize and restart

### Add three widgets

1. Open Settings if it is not already open (tray icon, or use the gear in a widget's edit
   overlay).
2. In **Widget gallery**, click **Add** for Clock, Date and Calendar.
3. Confirm Settings shows `3 on desktop` and **On the desktop** lists all three.
4. Confirm three widget windows appear near the centre of the primary display, each shifted
   24 DIP from the previous one.

### Enter edit mode and drag

1. Click **Edit layout**. Every widget must show a dashed border, a gear, a close button and a
   resize handle.
2. Drag the Clock by its body to a new place. Keep the button held while moving.
3. Release. Confirm the widget lands on a position where both `x` and `y` are multiples of 8.
4. Check the value directly:

   ```powershell
   Get-Content "$env:APPDATA\HomeLayer\layout.json"
   ```

5. Confirm `width` and `height` did not change during a drag.
6. Drag a widget next to another widget's edge. Within 8 DIP it should magnetise to that edge.
7. Hold **Alt** while dragging near an edge. Magnetism must be bypassed.

### Resize

1. Drag the Calendar's bottom-right handle larger and smaller.
2. Release. Confirm the top-left corner did not move.
3. Confirm `width` and `height` in `layout.json` are multiples of 8.
4. Try to resize below the manifest minimum (Clock/Date 160x100, Calendar 210x230). It must
   stop at the minimum.

### Restart

1. Click **Finish editing**.
2. Quit HomeLayer from the tray, then start it again.
3. Confirm all three widgets return to the same positions, sizes and stacking order.
4. Confirm `layout.json` is byte-for-byte unchanged by the restart (unless a pending save
   completed during shutdown).

## 2. Delete layout.json

1. Quit HomeLayer.
2. Back up and delete the layout:

   ```powershell
   $data = Join-Path $env:APPDATA 'HomeLayer'
   Copy-Item "$data\layout.json" "$env:TEMP\homelayer-layout-backup.json" -Force
   Remove-Item "$data\layout.json"
   ```

3. Start HomeLayer.
4. Confirm one Clock appears at 48,48 and `layout.json` is recreated with one clock placement.
5. Do not add the other widgets again yet.

## 3. Corrupt layout.json

1. Quit HomeLayer.
2. Write invalid JSON **without a BOM**:

   ```powershell
   $layout = Join-Path $env:APPDATA 'HomeLayer\layout.json'
   [IO.File]::WriteAllText($layout, 'this is not json', (New-Object Text.UTF8Encoding($false)))
   ```

3. Start HomeLayer.
4. Confirm a file named `layout.json.corrupt-<timestamp>` exists next to `layout.json`.
5. Confirm Settings shows a warning notice containing the backup file name and that the layout
   was reset.
6. Confirm one default Clock appears and `layout.json` contains a valid clock placement.
7. Restore the saved layout:

   ```powershell
   $data = Join-Path $env:APPDATA 'HomeLayer'
   Get-Process HomeLayer -ErrorAction SilentlyContinue | Stop-Process -Force
   Copy-Item "$env:TEMP\homelayer-layout-backup.json" "$data\layout.json" -Force
   ```

8. Start HomeLayer and confirm the restored widgets return.

A valid empty layout is different from a missing or corrupt one. Put
`{ "schema": 1, "placements": [] }` in `layout.json`, start the app, and confirm it shows
**No widgets yet** without adding a Clock.

## 4. Monitor unplug and replug (moved to Phase 8)

This row needs a second physical monitor. Do not mark it PASS on a single-monitor machine. By
owner instruction it is moved from Phase 2 to the last phase (Phase 8) and must run there before
release. The steps stay here for reference; Phase 8 records the result.

1. Add widgets on the second monitor.
2. Note each widget's `displayId`, `x` and `y` in `layout.json`.
3. Unplug or disable the second monitor. Wait at least two seconds for the 500 ms display
   debounce.
4. Confirm its widgets move inside the primary work area and remain reachable.
5. Confirm the saved `displayId`, `x` and `y` are not overwritten just by the monitor change.
6. Reconnect the monitor. Wait two seconds.
7. Confirm the widgets return to their saved locations automatically.
8. If a widget was moved while the monitor was absent, confirm its saved placement now points
   at the current display.

The missing-display path can be simulated without hardware by replacing one `displayId` with
`999999999` and setting `x`/`y` far off-screen, but that does **not** replace the unplug/replug
test.

## 5. Hotkey, tray and hotkey conflict

### Toggle with both controls

1. Press **Ctrl+Alt+E**. Confirm every widget shows the edit overlay and Settings changes to
   **Finish editing**.
2. Press **Ctrl+Alt+E** again. Confirm the overlays disappear.
3. Right-click the HomeLayer tray icon. Confirm **Edit layout** is unchecked.
4. Click **Edit layout** in the tray menu. Confirm the overlays appear and the menu item is
   checked.
5. Toggle it off from the tray.

### Conflict

1. Occupy Ctrl+Alt+E with another app or a helper process.
2. Start HomeLayer.
3. Open Settings and confirm a warning notice says the global hotkey could not be registered
   and suggests using the tray menu.
4. Confirm HomeLayer did not crash and the tray item still toggles edit mode.
5. Release the other app and restart HomeLayer. Confirm the warning is gone and Ctrl+Alt+E
   works again.

## 6. Off-screen and minimum-size clamp

1. Enter edit mode.
2. Drag a widget toward each screen edge. Confirm at least 48 by 48 DIP remains inside the work
   area and you can always grab it again.
3. Try to drag it completely off-screen. It must stop at the clamp.
4. Resize every widget below its manifest minimum. The window must stop at `minWidth` and
   `minHeight`.
5. Check `layout.json` after release; only the clamped position/size is saved.

## 7. Drag smoothness

1. On the laptop display, enter edit mode.
2. Drag a widget slowly across the desktop, then quickly across it.
3. Confirm the window follows the pointer without visible stutter, jumping or size drift.
4. Repeat at 100%, 125% and 150% scaling if available.
5. Confirm the disk is not written on every mouse move; `layout.json` should update only after
   release (plus the normal 500 ms debounce).

## 8. Right-click menu and Lock

1. Leave edit mode.
2. Right-click a widget. Confirm the menu contains **Edit layout**, **Lock widget**,
   **Opacity** (100%, 80%, 60%), **Reload widget** and **Remove widget**.
3. Click **Edit layout**. Confirm edit mode turns on for every widget.
4. Leave edit mode, right-click the same widget, and choose **Lock widget**.
5. Enter edit mode. Confirm the locked widget shows a dimmed border and no gear, close button
   or resize handle.
6. Try to drag or resize it. Nothing must move.
7. Right-click it in normal mode and choose **Unlock widget**. Handles must return in edit mode.
8. Use **Reload widget** and confirm the widget content reloads without closing the window.
9. Use **Remove widget** and confirm the confirmation dialog appears.

## 9. Opacity

1. Right-click a widget and choose **Opacity > 80%**.
2. Confirm the change is visible immediately and Settings shows `80%` for that widget.
3. Choose **60%** and confirm it is still live.
4. Quit and restart HomeLayer.
5. Confirm the opacity is still 60% and the window is still translucent.
6. Repeat for 100%.

## 10. Remove confirmation and built-ins

1. In Settings, click **Remove** for Clock.
2. Confirm the dialog appears. Click **Cancel** and confirm the widget stays.
3. Click **Remove** again and confirm **Remove**. The widget disappears and the row count drops
   by one.
4. Confirm the built-in files remain at `%APPDATA%\HomeLayer\widgets\clock\` (built-ins delete
   only the placement).
5. Confirm Date shows the day, month and year and Calendar shows a month grid with today
   highlighted.
6. Re-add Clock and confirm it appears at a cascaded position.

## Results template

```text
Date:
Build:
Windows:
Scaling:
Monitor setup:
1 Add/drag/resize/restart:
2 Delete layout.json:
3 Corrupt layout.json:
4 Monitor unplug/replug:
5 Hotkey/tray/conflict:
6 Off-screen/minimum:
7 Smoothness:
8 Context menu/Lock:
9 Opacity:
10 Remove/built-ins:
Notes:
```
