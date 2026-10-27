# Phase 5 manual test

Use this checklist for the manual-only Phase 5 acceptance items. Automated coverage is in
`docs/phase-5-app-grid-results.md`.

## Setup

1. Back up `%APPDATA%\HomeLayer\layout.json` and `grids.json`/`groups.json`, or use a disposable
   Windows profile. Do not use the real Gemini key for these tests.
2. Launch `dist\win-unpacked\HomeLayer.exe`.
3. In Settings, add the **Apps** widget. Confirm that Settings stays responsive while the status
   changes from scanning to a count.
4. Use a safe temporary shortcut for launch and watcher tests:

   ```powershell
   $start = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
   $shell = New-Object -ComObject WScript.Shell
   $normal = $shell.CreateShortcut((Join-Path $start 'HomeLayer Test.lnk'))
   $normal.TargetPath = 'C:\Windows\System32\notepad.exe'
   $normal.Save()
   $admin = $shell.CreateShortcut((Join-Path $start 'HomeLayer Admin Test.lnk'))
   $admin.TargetPath = 'C:\Windows\regedit.exe'
   $admin.Save()
   ```

   Delete both shortcuts at the end of the run.

## 1. Background scan

- Launch the app and immediately open Settings.
- Add the Apps widget.
- Expected: Settings is usable before the scan finishes; the grid status eventually reports
  the installed-app count. A real run listed 184 apps and 167 visible picker rows.

## 2. Launch, administrator prompt, deleted shortcut

- Open **Add apps**, search for `HomeLayer Test`, add it, and close the picker.
- Click the tile.
- Expected: Notepad opens.
- Add `HomeLayer Admin Test` and click it.
- Expected: the normal Windows UAC prompt appears. Cancel it. No custom prompt replaces UAC.
- Delete `HomeLayer Test.lnk` from the Start Menu while its tile is still visible, then click the
  tile before the background rescan removes it.
- Expected: a toast says the app could not be launched and offers **Remove from grid**. Click
  Remove and confirm the tile disappears.

The watcher normally removes a deleted shortcut within about 5 seconds. For a deterministic
toast test, click immediately after deleting the `.lnk`.

### Steam games

- Open **Add apps** and search for an installed Steam game, such as `Deadlock`, `Marvel Rivals`,
  `Wallpaper Engine`, or `Drawful 2`.
- Expected: the game appears with library-cache art, even though Steam has no Start Menu
  shortcut for it.
- Add it and click its tile.
- Expected: Steam opens the game through `steam://rungameid/<appid>`. Steamworks Common
  Redistributables should not appear as an app.

## 3. Picker search and add

- Open **Add apps** and type `edge` in lowercase.
- Expected: matching rows remain, including mixed-case names. Search is case-insensitive and
  matches inside the name.
- Check an app that is already on the grid.
- Expected: it is greyed out and cannot be selected.
- Select a new app and click **Add**.
- Expected: the picker closes and the app appears on the grid.

## 4. Bundles

- Drag one app tile onto another. Move at least 8 DIP and hold over the middle of the target
  for 500 ms.
- Expected: a ghost tile follows the pointer, the target highlights, and dropping creates a
  bundle with a 2 by 2 preview.
- Drag a third app onto the bundle.
- Expected: it joins the bundle and the preview updates.
- Click the bundle.
- Expected: the popover opens over the tile and shows the apps in three columns.
- Rename the bundle, remove one app, and drag to reorder the remaining apps.
- Expected: the title saves on Enter, Remove returns the app to the grid, and the new order is
  visible immediately.
- Remove apps until one remains.
- Expected: the bundle dissolves and both the removed and remaining apps are standalone tiles.

## 5. Popover close and screen edges

- Open a bundle, wait at least 150 ms, then click outside the popover on the desktop.
- Expected: the popover closes. A click during the first 150 ms is intentionally ignored.
- Open it again and press Escape.
- Expected: it closes.
- Move the App Grid to the top-left, top-right, bottom-left, and bottom-right of the display,
  opening a bundle at each position.
- Expected: the popover stays entirely inside that display's work area. The automated run
  checked centre and all four corners.

## 6. Persistence

- Rename a bundle, rename the App Grid title, reorder its apps, and reorder the grid.
- Quit HomeLayer completely and relaunch.
- Expected: the grid title, grid order, bundle names, bundle membership, and bundle app order
  are restored. The packaged checks restored 73 items, the `Work` bundle, and the `Focus` title.

## 7. Watcher

- Create `HomeLayer Test.lnk` using the setup command.
- Open the picker and click **Refresh** if needed.
- Expected: `HomeLayer Test` appears within about 5 seconds.
- Delete the shortcut.
- Expected: the app leaves the picker/list within about 5 seconds.
- Repeat with the manual Refresh button and confirm it produces the same result.

## 8. Fake id and path rejection

This is covered by the packaged smoke and the Vitest IPC tests. Run:

```powershell
npm test -- tests/unit/widget-api.test.ts
```

Expected: `C:\Windows\notepad.exe` returns `invalid_args` and an unknown id returns `not_found`;
no process is started. The packaged smoke also sent both values through the real preload API and
observed the same errors.

## 9. Icons at 100 and 150 percent

- Set display scaling to 100 percent, restart HomeLayer, and inspect the grid.
- Repeat at 150 percent.
- Expected: icons are sharp on their 44 px plates, labels are one line with ellipsis, and no
  shortcut-arrow overlay appears. UWP apps use manifest icons, Steam games use library-cache
  art, and stale shortcuts without a usable target show a coloured letter tile, not a broken
  image. The packaged screenshots at both scales showed 80 by 96 tiles, 44 by 44 plates, and
  48 by 48 natural icons. The packaged audit found 179 icons and 5 stale-shortcut letters.

## 10. Memory

- Add about 60 apps to the grid.
- Open Task Manager, Details tab, and find the HomeLayer renderer processes.
- Expected: the App Grid and Clock renderer working sets are measurable. The latest packaged
  run reported 188 MB total: about 103 MB for the App Grid and 85 MB for the Clock at 125
  percent. There is no hard v1 budget; record the result rather than failing on a threshold.

## 11. Keyboard and accessibility

- Focus the grid and use the arrow keys, Home, and End.
- Expected: focus moves between tiles and the grid scrolls the focused tile into view.
- Press Enter or Space on a focused app.
- Expected: the app launches.
- Press Escape with the picker open and with the popover open.
- Expected: the picker or popover closes.
- Inspect a tile's accessible name.
- Expected: app tiles expose the app name; bundle tiles expose the bundle name and app count.

## 12. Cleanup

- Remove the test tiles and bundle from the grid.
- Delete `HomeLayer Test.lnk` and `HomeLayer Admin Test.lnk`.
- Restore the backed-up layout and grid/group files if the run used the normal profile.
- Confirm the App Grid is not left running after quitting HomeLayer.

## Result record

| Check                               | Result               | Notes                                  |
| ----------------------------------- | -------------------- | -------------------------------------- |
| Background scan                     | Pending              |                                        |
| Normal launch                       | Pending              |                                        |
| Administrator UAC                   | Pending              |                                        |
| Steam launch                        | Pending              | Packaged scan found 4 games with icons |
| Deleted shortcut toast              | Pending              |                                        |
| Picker search/add                   | Pending              |                                        |
| Bundle create/rename/remove/reorder | Pending              |                                        |
| Popover outside click/Escape        | Pending              |                                        |
| Popover edge clamping               | Pending              |                                        |
| Persistence, including grid title   | Pending              | Packaged title check PASS              |
| Install/uninstall watcher           | Pending              |                                        |
| Fake id/path rejection              | Automated PASS       | `widget-api` tests and packaged smoke  |
| Icons at 100/150 percent            | Pending visual check | Automated screenshots PASS             |
| UWP/Steam icon audit                | Automated PASS       | 179/184 icons; 5 stale shortcuts       |
| Memory measurement                  | Automated PASS       | 188 MB total; see decisions            |
| Keyboard/accessibility              | Pending              |                                        |

Step 16, the experimental Hide desktop icons switch, is out of scope for Phase 5.
