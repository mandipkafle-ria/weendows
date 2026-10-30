# Follow-up fixes and features

Status key: `TODO` / `IN PROGRESS` / `DONE`

1. DONE - Drag an app icon or bundle from one app-grid widget into another app-grid widget. Uses main-process cursor polling plus `grid.dragStart` / `grid.dragEnd`; manual multi-window check pending.
2. DONE - Added explicit `Icon + name` / `Icon only` display chips, with migration from the old `hideLabels` pref.
3. DONE - Cursor changes preview live through the `--hl-app-cursor` CSS variable before saving.
4. DONE - Widget gallery search is now an icon button that expands into an input (`ExpandableSearch`).
5. DONE - Widget removal and saved-widget deletion use the in-app `ConfirmDialog`; native prompt is bypassed through the confirmed IPC flag.
6. DONE - Desktop drag-to-delete target is now only an animated trash icon.
7. DONE - Live wallpaper windows and native attach rects use a 2 DIP overscan; manual visual check pending.
8. DONE - Added a taskbar customization page with selectable overlay/replace modes, themes, opacity, height, top/bottom position, clock/settings button toggles, and up to 32 pinned apps/folders. Replace mode hides the Windows taskbar via user32 and restores it on disable/quit; overlay and replace modes were runtime-checked.
