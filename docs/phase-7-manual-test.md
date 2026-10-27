# Phase 7 manual test - settings, resilience, and performance

Use the packaged app. This checklist covers the Windows integration, crash recovery, first-run
flow, accessibility, and the performance budget that the automated tests cannot measure.

## Setup

1. Build and launch the unpacked app:
   ```powershell
   npm run build:unpack
   dist\win-unpacked\HomeLayer.exe
   ```
2. Confirm the app data folder before testing:
   ```powershell
   explorer "$env:APPDATA\HomeLayer"
   ```
3. Keep the log available:
   ```powershell
   Get-Content "$env:APPDATA\HomeLayer\logs\main.log" -Wait
   ```
4. Record the machine and test assets for the performance notes:
   ```powershell
   Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model
   Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors
   Get-CimInstance Win32_VideoController | Select-Object Name, CurrentHorizontalResolution, CurrentVerticalResolution
   (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics').AppliedDPI
   [System.Environment]::OSVersion.VersionString
   ```
5. Run the functional checks before the timed performance runs. Do not change the widget
   layout, wallpaper, power plan, or Windows scaling during a timed run.

## Settings window

- [ ] Open Settings from the tray. It opens at 880 by 620, is resizable, never stays on top of
      other apps, and can be reduced to 720 by 520.
- [ ] Resize it larger and smaller, close it, and reopen it. The size is remembered.
- [ ] The tab order is General, Widgets, Apps and bundles, Wallpaper, AI, About.
- [ ] Use the keyboard alone: Tab reaches every control, Space/Enter activates it, arrow keys
      change selects, and a visible focus ring is always present.
- [ ] Switch Windows to a high-contrast theme and repeat the keyboard pass. Controls and focus
      stay visible.
- [ ] Turn off Windows animations (Settings > Accessibility > Visual effects > Animation
      effects off) and confirm Settings transitions stop.

## Tray

- [ ] Left-click the tray icon and confirm Settings opens.
- [ ] Right-click the tray icon and confirm the menu contains Edit layout, Add widget,
      Pause live wallpaper, Settings, and Quit.
- [ ] Toggle Edit layout from the tray and confirm widget handles appear and disappear.
- [ ] Add a widget from the tray submenu and confirm it appears once.
- [ ] Toggle Pause live wallpaper with a live wallpaper selected and confirm it pauses and
      resumes.
- [ ] Hover the tray icon and confirm the tooltip shows the HomeLayer version.
- [ ] Quit from the tray and confirm the tray icon and all HomeLayer processes exit.

## General tab

### Start with Windows

- [ ] In the packaged app, **Start with Windows** is available. In `npm run dev` it is disabled
      or reports that it is unavailable, and does not register `electron.exe`.
- [ ] Turn it on, close Settings, and confirm the login item exists:
  ```powershell
  Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
  ```
- [ ] Turn it off and confirm the entry is gone.
- [ ] Turn it on again, reboot Windows, and confirm HomeLayer starts hidden. Widgets and the
      wallpaper return within 5 seconds of the desktop appearing. The Settings window must not
      open on a normal startup.
- [ ] Turn it off after the reboot test.

### Hotkey

- [ ] Record a different combination, for example **Ctrl+Alt+H**. Confirm Settings shows the
      new combination and it toggles edit mode.
- [ ] Restart HomeLayer and confirm the new combination is still active.
- [ ] Occupy the combination with another app (PowerToys Keyboard Manager, AutoHotkey, or
      another global-hotkey tool), then try to record and save it again. Settings shows a
      conflict/failure message, keeps the previous working shortcut, and HomeLayer does not
      crash.
- [ ] Record the default **Ctrl+Alt+E** again and confirm it works.

### Theme

- [ ] Choose **Dark**, **Light**, and **System**. Each applies immediately to Settings.
- [ ] With a theme-aware widget on the desktop, change Windows or the in-app theme and confirm
      the widget receives the change without a reload.
- [ ] Change the Windows app theme while **System** is selected and confirm both Settings and
      the widget follow it.

### Maintenance buttons

- [ ] **Reset layout** asks for confirmation. Cancel leaves the desktop unchanged; confirm
      restores the default layout.
- [ ] **Open data folder** opens `%APPDATA%\HomeLayer`.
- [ ] **Export diagnostics** opens a new folder under `%APPDATA%\HomeLayer\diagnostics`.
- [ ] The folder contains at most the three newest log files and `versions.txt`.
- [ ] `versions.txt` lists HomeLayer, Windows, Electron, and Chromium versions.
- [ ] The folder does not contain `secrets.json`, `ai-settings.json`, widget storage, or the
      whole data folder.
- [ ] The export produces an in-app toast, not a Windows notification.

## Widgets tab

- [ ] Every widget row shows its name, kind (Built-in or AI), size, permission chips, CPU
      percent, and RAM in MB.
- [ ] The CPU/RAM values update while the tab is open and are within about 10 percent of Task
      Manager. To compare, open Task Manager > Details, match each widget process, and sum the
      values; allow for sampling-time differences.
- [ ] **Sort by RAM** reorders the rows and the largest consumer is obvious.
- [ ] **Hide** removes the widget from the desktop and changes to **Show**. Show restores it.
- [ ] **Lock** prevents dragging and resizing; unlocking restores both.
- [ ] Change **Opacity** and confirm the desktop widget changes.
- [ ] **Duplicate** creates a second placement with its own settings.
- [ ] **Reload** reloads only the selected widget.
- [ ] **Edit with AI** opens the AI tab for an AI widget. A built-in widget does not offer it.
- [ ] **Remove** asks for confirmation and removes the placement after confirmation.
- [ ] **Delete** for a saved AI widget asks for confirmation and removes the widget files.
- [ ] Permission toggles work: turning a permission off is reflected on the next widget API
      call; turning it back on restores access.

## Crash recovery and safe mode

### Widget crash

- [ ] Identify the widget renderer process in Task Manager > Details (or Process Explorer).
- [ ] End that process once. The widget reloads automatically and the Settings badge clears
      after it loads.
- [ ] End the same widget process three more times within one minute. The second and third
      crashes reload it; the fourth crash within the window leaves it disabled and Settings
      shows a badge explaining why.
- [ ] Re-enable the widget from Settings and confirm it loads.
- [ ] Confirm the log records `Renderer process gone`/the failure and the automatic reload
      attempts. It must not contain `Uncaught main-process exception` or
      `Unhandled main-process rejection`.

### Manual safe mode

- [ ] Start with `--safe`:
  ```powershell
  Start-Process '.\dist\win-unpacked\HomeLayer.exe' -ArgumentList '--safe'
  ```
- [ ] No widgets or live wallpaper appear. Settings shows the safe-mode banner and a **Start
      normally** button.
- [ ] Click **Start normally**. HomeLayer relaunches without `--safe`, widgets return, and the
      banner is gone.

### Automatic safe mode after failed startups

- [ ] Close HomeLayer completely.
- [ ] Run the forced crash three times. Each run must exit by itself:
  ```powershell
  $env:HL_FORCE_STARTUP_CRASH = '1'
  1..3 | ForEach-Object {
    $p = Start-Process '.\dist\win-unpacked\HomeLayer.exe' -PassThru
    Wait-Process -Id $p.Id
    Start-Sleep -Seconds 1
  }
  Remove-Item Env:\HL_FORCE_STARTUP_CRASH
  ```
- [ ] Start HomeLayer normally. It enters safe mode, skips widgets/live wallpaper, and shows
      the repeated-crash notice with **Start normally**.
- [ ] Confirm `%APPDATA%\HomeLayer\startup.json` contains the failed attempts before the safe
      launch. After 30 seconds of safe-mode uptime, confirm a clean start clears them.
- [ ] Click **Start normally**, confirm widgets return, and confirm a normal launch is recorded
      as clean after 30 seconds.

## First-run onboarding

- [ ] Close HomeLayer, back up the settings file, and remove it:
  ```powershell
  Copy-Item "$env:APPDATA\HomeLayer\settings.json" "$env:APPDATA\HomeLayer\settings.backup.json"
  Remove-Item "$env:APPDATA\HomeLayer\settings.json"
  ```
- [ ] Start HomeLayer. The three onboarding steps appear in Settings.
- [ ] Step 1 explains the app and the privacy model.
- [ ] Step 2 preselects Clock, System, and Apps; they can be changed.
- [ ] Step 3 accepts an optional AI key, and **Skip** completes onboarding without a key.
- [ ] The chosen widgets appear once and are not duplicated.
- [ ] Restart HomeLayer and confirm onboarding does not appear again.
- [ ] Restore the backup:
  ```powershell
  Move-Item "$env:APPDATA\HomeLayer\settings.backup.json" "$env:APPDATA\HomeLayer\settings.json" -Force
  ```

## Wallpaper, AI, and About tabs

- [ ] The Wallpaper tab still passes the Phase 6B checklist for static and live wallpapers.
- [ ] The AI tab creates a preview, shows the permission approval dialog, and saves or cancels
      without leaving a hidden preview window. Confirm the preview process disappears after
      closing/cancelling in Task Manager.
- [ ] The About tab shows the app version, third-party package and font licenses, a working
      issue-tracker link, the Native check, and **Restore Windows wallpaper**.
- [ ] Restore Windows wallpaper returns the original Windows wallpaper and stops live mode.

## In-app notices

- [ ] Trigger successful and failing actions (for example, export diagnostics, a hotkey
      conflict, and a denied widget permission). Feedback appears as an in-app toast and in
      Settings, not as a Windows notification.
- [ ] Toasts disappear on their own, can be dismissed, and do not steal keyboard focus.

## Performance procedure

### Configuration

Use the same configuration for every measurement:

- Five widgets **plus** the App Grid: Clock, Date, System, Battery, and Notes, plus Apps.
  Grant the permissions those widgets request.
- Static wallpaper: one local image, **Fill**.
- Live wallpaper: one local 1080p H.264 MP4 or VP8/VP9 WebM, muted, **Fill**. Record the file
  name and SHA-256:
  ```powershell
  Get-FileHash 'C:\path\to\wallpaper.mp4' -Algorithm SHA256
  ```
- Close Settings, the AI preview, popovers, browsers, games, and other heavy apps before each
  run. Leave the desktop idle.
- Set sleep and display-off to **Never**, disable the screen saver, and pause Windows Update
  for the duration. A sleeping display pauses live wallpaper and invalidates the result.
- Record the machine details from Setup, Windows scaling, the widget layout, and the wallpaper
  asset in the results notes.
- Close HomeLayer, then move the old log aside so this run's samples cannot be mixed with an
  earlier run:
  ```powershell
  Move-Item "$env:APPDATA\HomeLayer\logs\main.log" `
    "$env:APPDATA\HomeLayer\logs\main.before-$(Get-Date -Format yyyyMMdd-HHmmss).log"
  ```
- Enable metrics and restart HomeLayer:
  ```powershell
  $env:HL_DEBUG_METRICS = '1'
  Start-Process '.\dist\win-unpacked\HomeLayer.exe'
  ```
  The variable must be present in the environment that starts HomeLayer. With it unset, the
  log must contain no `metrics` lines.

### Parsing the samples

The log line has this form:

```text
metrics processes=8 cpu=0.7% ram=392MB
```

After a run, parse it with:

```powershell
$log = "$env:APPDATA\HomeLayer\logs\main.log"
$samples = @(
  Get-Content $log | ForEach-Object {
    if ($_ -match 'metrics processes=(\d+) cpu=([\d.]+)% ram=(\d+)MB') {
      [pscustomobject]@{
        Processes = [int]$Matches[1]
        Cpu = [double]$Matches[2]
        RamMB = [int]$Matches[3]
      }
    }
  }
)
$samples | Select-Object -First 12 | Format-Table
```

- Ignore the first sample: the first `getAppMetrics` reading reports 0 percent CPU.
- For idle CPU and total RAM, use ten consecutive samples after the app has been idle for at
  least five minutes. Each sample is already a 60-second value.
  ```powershell
  $window = $samples | Select-Object -Skip 5 -First 10
  $window | Measure-Object Cpu -Average -Minimum -Maximum
  $window | Measure-Object RamMB -Average -Minimum -Maximum
  ```
- Record the average CPU as the **Idle CPU, 60-second average**. Record the average RAM as the
  **Total RAM, all processes**.

### Startup time

1. Close HomeLayer. Start a 60 fps screen recording (Xbox Game Bar `Win+G`, or a phone in slow
   motion).
2. Launch `dist\win-unpacked\HomeLayer.exe`.
3. Stop recording when the five widgets and the App Grid are all visibly drawn and the
   wallpaper is present.
4. In the recording, count frames from the first visible launch response to the frame where the
   last widget is fully drawn. Divide by the recording frame rate.
5. Repeat three times after one warm-up launch. Record the average of the three runs.
6. Repeat with the live wallpaper already selected and running.

The debug build's first launch after `build:unpack` is a cold-cache run; do not use it as one of
the three measured runs.

### Eight-hour run

Run this separately for the static wallpaper and the live wallpaper. Do not run both at once.

1. Start the configuration above, leave Settings closed, and confirm metrics lines appear once
   per minute.
2. Note the start time. At 10 minutes, use the sample nearest T+10:00 as the RAM baseline. With
   one sample per minute and the first sample at T+1:00, that is index 9:
   ```powershell
   $baseline = $samples[9].RamMB   # adjust if the first samples were not 60 s apart
   ```
3. Leave the machine idle for eight hours. Do not change the layout, wallpaper, power plan, or
   Windows scaling. Do not lock the screen if that pauses the live wallpaper; note if it does.
4. At the end, confirm HomeLayer is still running and take the last sample as the final RAM:
   ```powershell
   $final = $samples[-1].RamMB
   $growth = (($final - $baseline) / $baseline) * 100
   [pscustomobject]@{
     BaselineMB = $baseline
     FinalMB = $final
     GrowthPercent = [math]::Round($growth, 1)
   }
   ```
5. Confirm the log has no `Uncaught main-process exception`, no
   `Unhandled main-process rejection` after the first hour, and no widget crash/reload after the
   first hour:
   ```powershell
   Select-String -Path $log -Pattern 'Uncaught main-process exception|Unhandled main-process rejection|Renderer process gone|Child process gone'
   ```
6. Record the baseline, final, growth percentage, crash/rejection result, and total run time.

## Performance budget

Fill the measured columns only from actual runs on this machine. Do not paste target values into
the measured columns.

| Measure                     | Target           | Measured, static wallpaper | Measured, live wallpaper |
| --------------------------- | ---------------- | -------------------------- | ------------------------ |
| Idle CPU, 60-second average | under 1 percent  | to fill in                 | to fill in               |
| Total RAM, all processes    | under 450 MB     | to fill in                 | to fill in               |
| Start until widgets visible | under 3 seconds  | to fill in                 | to fill in               |
| RAM growth over 8 hours     | under 20 percent | to fill in                 | to fill in               |

If a target is missed, record the attempt and the measured numbers, then apply the mitigation
list in `build-plan/phases/phase-7-settings-resilience.md` one change at a time and remeasure.
Record the decision and the final numbers in `docs/decisions.md`.

## Pass criteria

- Every functional checkbox passes.
- The performance table contains real numbers for both wallpapers, or an explicit "not
  measured" with a written reason and follow-up.
- The eight-hour run finishes without a crash, with RAM growth under 20 percent, and with no
  unhandled rejection after the first hour.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass on the tested
  source revision.
