param(
  [ValidateSet('A', 'B', 'C', 'auto')]
  [string]$Strategy = 'A',
  [int]$WidgetCount = 1,
  [string]$Scale = ''
)

$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot '..\dist\win-unpacked\HomeLayer.exe'

if (-not (Test-Path -LiteralPath $exe)) {
  throw 'Packaged app not found. Run npm run build:unpack first.'
}

$existing = Get-Process HomeLayer -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host 'Restarting the running HomeLayer instance...'
  $existing | Stop-Process -Force
  Start-Sleep -Seconds 1
}

$env:HL_PIN_STRATEGY = $Strategy
$env:HL_WIDGET_COUNT = "$WidgetCount"
$arguments = @('--hidden')
if ($Scale) {
  $arguments += "--force-device-scale-factor=$Scale"
}

Start-Process -FilePath $exe -ArgumentList $arguments
Start-Sleep -Seconds 2

$process = Get-Process HomeLayer -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $process) {
  throw 'HomeLayer did not start. Check the log below.'
}

Write-Host "HomeLayer is running (PID $($process.Id))."
Write-Host "Widgets: $WidgetCount | Strategy: $Strategy | Scale: $(if ($Scale) { $Scale } else { 'system' })"
Write-Host 'The clock is at the top-left of the desktop. Press Win+D to show it.'
Write-Host "Log: $env:APPDATA\HomeLayer\logs\main.log"
Write-Host 'Stop it with: Stop-Process -Name HomeLayer -Force'
