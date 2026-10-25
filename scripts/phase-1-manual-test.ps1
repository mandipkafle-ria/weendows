param(
  [ValidateSet('A', 'B', 'C', 'auto')]
  [string]$Strategy = 'auto',
  [ValidateSet(1, 3, 5)]
  [int]$WidgetCount = 1,
  [string]$Exe = (Join-Path $PSScriptRoot '..\dist\win-unpacked\HomeLayer.exe'),
  [string]$Scale = '',
  [switch]$RestartExplorer
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logPath = Join-Path $env:APPDATA 'HomeLayer\logs\main.log'
$results = New-Object System.Collections.ArrayList

function Ask-Check {
  param(
    [string]$Name,
    [string]$Prompt
  )

  while ($true) {
    $answer = (Read-Host "$Prompt [p]ass, [f]ail, [s]kip").Trim().ToLowerInvariant()
    if ($answer -eq 'p') {
      [void]$results.Add([pscustomobject]@{ Name = $Name; Result = 'PASS'; Note = '' })
      return
    }
    if ($answer -eq 'f') {
      $note = (Read-Host 'What happened?').Trim()
      [void]$results.Add([pscustomobject]@{ Name = $Name; Result = 'FAIL'; Note = $note })
      return
    }
    if ($answer -eq 's') {
      [void]$results.Add([pscustomobject]@{ Name = $Name; Result = 'SKIP'; Note = '' })
      return
    }
    Write-Host 'Enter p, f, or s.'
  }
}

function Ask-Observation {
  param(
    [string]$Name,
    [string]$Prompt
  )

  $note = (Read-Host "$Prompt (stays / disappears / other)").Trim()
  [void]$results.Add([pscustomobject]@{ Name = $Name; Result = 'OBSERVED'; Note = $note })
}

function Stop-HomeLayer {
  Get-Process HomeLayer -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 1
}

function Wait-ForWidgets {
  for ($i = 0; $i -lt 24; $i += 1) {
    Start-Sleep -Milliseconds 500
    if (Test-Path -LiteralPath $logPath) {
      $tail = Get-Content -LiteralPath $logPath -Tail 30
      if ($tail -match 'Widget windows created') {
        return $true
      }
    }
  }
  return $false
}

if (-not (Test-Path -LiteralPath $Exe)) {
  throw "Executable not found: $Exe. Run npm run build:unpack first, or pass -Exe."
}

$existing = Get-Process HomeLayer -ErrorAction SilentlyContinue
if ($existing) {
  $stopExisting = (Read-Host 'HomeLayer is already running. Stop it? [y/n]').Trim().ToLowerInvariant()
  if ($stopExisting -ne 'y') {
    throw 'Stop the existing HomeLayer process before running this test.'
  }
  Stop-HomeLayer
}

Write-Host ''
Write-Host "Phase 1 manual test: strategy=$Strategy widgets=$WidgetCount scale=$Scale"
Write-Host "Executable: $Exe"
Write-Host 'The widget is pinned behind normal windows, so your apps cover it.'
Write-Host 'Use Win+D to show the desktop when the script asks about visibility.'
Write-Host 'The widget will start in 5 seconds. Focus a text editor and type continuously now.'
Write-Host 'This checks that showing the widget does not steal focus.'
for ($i = 5; $i -ge 1; $i -= 1) {
  Write-Host "Starting in $i..."
  Start-Sleep -Seconds 1
}

$oldStrategy = $env:HL_PIN_STRATEGY
$oldCount = $env:HL_WIDGET_COUNT
$env:HL_PIN_STRATEGY = $Strategy
$env:HL_WIDGET_COUNT = "$WidgetCount"
$arguments = @('--hidden')
if ($Scale) {
  $arguments += "--force-device-scale-factor=$Scale"
}

$process = Start-Process -FilePath $Exe -ArgumentList $arguments -PassThru
$started = Wait-ForWidgets
if (-not $started) {
  Write-Host 'Widget startup was not found in the log. Recent log:'
  if (Test-Path -LiteralPath $logPath) {
    Get-Content -LiteralPath $logPath -Tail 40
  }
  Stop-HomeLayer
  throw 'The app did not report Widget windows created.'
}

Write-Host ''
Write-Host 'Recent log:'
Get-Content -LiteralPath $logPath -Tail 20
Write-Host ''

Ask-Check 'No focus steal' 'Did typing continue without interruption while the widget appeared?'

Write-Host ''
Write-Host 'Press Win+D to show the desktop, or minimize all normal windows.'
Ask-Check 'Visible' 'Is the widget visible above the wallpaper and above desktop icons?'
Ask-Observation 'Win+D' 'After pressing Win+D, did the widget stay visible or disappear?'
Write-Host 'Press Win+D again to restore your windows.'

Write-Host ''
Write-Host 'Open a maximized normal app over the widget. Click the widget once.'
Ask-Check 'Behind apps' 'Does the app cover the widget, and does clicking the widget leave the app in front?'

Write-Host ''
Ask-Check 'Hidden from switchers' 'Is the widget absent from the taskbar and from Alt+Tab?'

Write-Host ''
Write-Host 'Press Win+L to lock Windows, then unlock and return here.'
[void](Read-Host 'Press Enter after unlocking')
Ask-Check 'Lock and unlock' 'Did the widget return in the same place after unlock?'

Write-Host ''
if ($RestartExplorer) {
  $doRestart = (Read-Host 'Restart Windows Explorer now? [y/n]').Trim().ToLowerInvariant()
  if ($doRestart -eq 'y') {
    Stop-Process -Name explorer -Force
    Write-Host 'Explorer stopped. Waiting for it to restart...'
    Start-Sleep -Seconds 5
  }
} else {
  Write-Host 'Restart Windows Explorer from Task Manager, or rerun this script with -RestartExplorer.'
}
Ask-Check 'Explorer restart' 'After Explorer restarted, is the widget still visible?'

if ($Scale) {
  Write-Host ''
  Ask-Check "Looks sharp at $Scale" "Does the clock card look sharp and correctly sized at scale $Scale?"
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = Join-Path $repo 'docs'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$outFile = Join-Path $outDir "phase-1-manual-results-$Strategy-$stamp.md"
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add('# Phase 1 manual test results')
[void]$lines.Add('')
[void]$lines.Add("- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$lines.Add("- Strategy: $Strategy")
[void]$lines.Add("- Widget count: $WidgetCount")
[void]$lines.Add("- Scale: $Scale")
[void]$lines.Add("- Executable: $Exe")
[void]$lines.Add("- Windows: $([System.Environment]::OSVersion.VersionString)")
[void]$lines.Add('')
foreach ($result in $results) {
  $line = "- $($result.Name): $($result.Result)"
  if ($result.Note) {
    $line += " ($($result.Note))"
  }
  [void]$lines.Add($line)
}
Set-Content -LiteralPath $outFile -Value $lines -Encoding UTF8
Write-Host ''
Write-Host "Results written to $outFile"

Stop-HomeLayer
if ($null -eq $oldStrategy) { Remove-Item Env:HL_PIN_STRATEGY -ErrorAction SilentlyContinue } else { $env:HL_PIN_STRATEGY = $oldStrategy }
if ($null -eq $oldCount) { Remove-Item Env:HL_WIDGET_COUNT -ErrorAction SilentlyContinue } else { $env:HL_WIDGET_COUNT = $oldCount }
