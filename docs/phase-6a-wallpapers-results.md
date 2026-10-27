# Phase 6A results - static wallpapers and slideshow

- Date: 2026-10-26
- Build: packaged `dist/win-unpacked/HomeLayer.exe`
- Test profile: temporary `--user-data-dir` under `%TEMP%`; the owner's normal
  `%APPDATA%\HomeLayer` profile was not used
- Wallpaper: the real desktop wallpaper was restored after the run

## Gates

| Check                  | Result | Evidence                                                        |
| ---------------------- | ------ | --------------------------------------------------------------- |
| `npm run lint`         | PASS   | ESLint completed with no findings.                              |
| `npm run typecheck`    | PASS   | Node and web projects.                                          |
| `npm test`             | PASS   | 19 files / 157 tests; 3 new wallpaper files / 16 tests.         |
| `npm run build`        | PASS   | Main, preload, settings, widget shell and thumbnail page built. |
| `npm run build:unpack` | PASS   | `dist/win-unpacked/HomeLayer.exe`.                              |

## Packaged smoke

A temporary Playwright Electron script ran against the packaged app. All 16 checks passed:

| Check                            | Result | Detail                                                                                    |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Temporary profile used           | PASS   | `app.getPath('userData')` resolved inside the temp folder.                                |
| Wallpaper tab opens              | PASS   | The new Settings tab renders.                                                             |
| First-run original captured      | PASS   | Path, `WallpaperStyle`, and `TileWallpaper` were saved.                                   |
| Image import                     | PASS   | Two selected images were copied into the library.                                         |
| Video import                     | PASS   | MP4 was copied and a poster was generated.                                                |
| HTML folder import               | PASS   | Folder was copied and a generic card was shown.                                           |
| Thumbnails                       | PASS   | Image and video thumbnails loaded through `hl-wallpaper://thumb/<id>`.                    |
| Six fit modes                    | PASS   | Fill, Fit, Stretch, Tile, Center, and Span wrote the expected registry values.            |
| Static path containment          | PASS   | The applied file lived under the temporary `wallpapers` folder.                           |
| Source files untouched           | PASS   | SHA-256 hashes matched before and after the run.                                          |
| Slideshow start                  | PASS   | Mode, image list, interval, and last-change time persisted.                               |
| Slideshow restart                | PASS   | The saved slideshow configuration survived a full app restart.                            |
| Overdue schedule                 | PASS   | After setting `lastChangeAt` two minutes in the past, restart advanced to the next image. |
| Restore wallpaper                | PASS   | The first-run path, style, and tile values were restored.                                 |
| Remove wallpaper                 | PASS   | The HTML card and its copied library folder were removed after confirmation.              |
| Sources untouched after full run | PASS   | All three fixture hashes still matched.                                                   |

## Implementation notes

- Imports are copied under `wallpapers/<id>/`; originals are never moved or edited.
- Thumbnails are written to `wallpapers/thumbs/<id>.png`. Video posters also serve as the
  Phase 6B fallback field.
- Video frame capture uses a hidden `wallpaper-thumbnail` page at one second and falls back
  to the Windows thumbnail provider.
- Static setting validates an absolute path, existence, allowed image extension, and
  containment inside the wallpaper library before every registry/native call.
- The first-run capture also stores the original `WallpaperStyle` and `TileWallpaper` so
  Restore does not leave the first-run wallpaper with HomeLayer's last fit mode.
- The slideshow uses chained `setTimeout` calls, persisted `lastChangeAt`, and recomputes on
  `resume` and `unlock-screen`.
- Video and HTML wallpapers can be imported and previewed now; playback remains Phase 6B.

## Remaining manual checks

- Visual inspection of all six fit modes on the owner's desktop. The smoke verified the
  registry values, not the rendered appearance.
- Actual sleep/resume. The smoke verified restart and overdue-schedule recovery, but not a
  real Windows sleep cycle.
- Owner acceptance of the Settings tab and the final packaged build.
- Phase 5 manual acceptance is still pending.
