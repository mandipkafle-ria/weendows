# Phase 6A manual test

Use the packaged app for the final run. The automated smoke already covers import,
thumbnails, registry values, persistence, and restore; this checklist covers the visual and
sleep/resume checks that need a real desktop.

## Setup

1. Build and launch:
   ```
   npm run build:unpack
   dist\win-unpacked\HomeLayer.exe
   ```
2. Open **Settings > Wallpaper**.
3. Prepare two images with different aspect ratios, one short MP4/WebM, and one folder
   containing `index.html`.
4. Record the current wallpaper path and fit:
   ```
   reg query "HKCU\Control Panel\Desktop" /v WallPaper
   reg query "HKCU\Control Panel\Desktop" /v WallpaperStyle
   reg query "HKCU\Control Panel\Desktop" /v TileWallpaper
   ```

## Library and thumbnails

- [ ] **Add images/videos** copies both images and the video into
      `%APPDATA%\HomeLayer\wallpapers\<id>\`.
- [ ] The two images show real thumbnails.
- [ ] The video shows a poster frame, not a broken image.
- [ ] **Add HTML folder** adds a card with a generic **HTML** tile.
- [ ] The original source files still exist and are unchanged.

## Fit modes

For each mode, select an image, choose the mode, and click **Set**:

- [ ] Fill - image fills the screen without stretching.
- [ ] Fit - whole image is visible with letterboxing if needed.
- [ ] Stretch - image fills the screen and may distort.
- [ ] Tile - image repeats across the desktop.
- [ ] Center - image is centered at its natural size.
- [ ] Span - image spans the current monitor arrangement.

- [ ] The **Current** badge follows the selected wallpaper.
- [ ] Switching back to another image and setting it works.
- [ ] **Remove** asks for confirmation and deletes the card.
- [ ] Removing the current static wallpaper restores the first-run wallpaper.

## Restore

- [ ] **Restore Windows wallpaper** is enabled after the first run.
- [ ] Restore brings back the first-run image, fit style, and tile setting.
- [ ] The current badge clears after restore.

## Slideshow

- [ ] Add at least two images and enable **Slideshow**.
- [ ] Set the interval to **1 min** and leave the app running.
- [ ] The desktop changes to another image after about one minute.
- [ ] Toggle **Shuffle** and confirm the next change is not the current image.
- [ ] Stop the slideshow and confirm the timer stops.
- [ ] Start it again, then restart the app; the slideshow is still enabled.
- [ ] Put Windows to sleep for more than the interval, wake it, and confirm the wallpaper
      advances promptly.
- [ ] Restart the app after a change and confirm the schedule continues rather than resetting.
- [ ] **Restore Windows wallpaper** stops the slideshow and restores the original.

## Failure checks

- [ ] Add an unsupported file (for example `.txt`) and confirm it is rejected.
- [ ] Add an HTML folder without `index.html` and confirm it is rejected.
- [ ] Try to apply a video or HTML card; Phase 6A shows the Phase 6B hint instead of applying.
- [ ] Remove the current slideshow image; the slideshow advances or stops cleanly.

## Result

Record PASS/FAIL and any screenshots in the phase results. Do not mark Phase 6A complete until
the visual fit checks and a real sleep/resume cycle pass on the owner's machine.
