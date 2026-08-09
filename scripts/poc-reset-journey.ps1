# Reset viajeros al first_run (cutover agentic)
# SPEC_AI_JOURNEY_FILE_LEDGER §10
param(
  [switch]$Apply,
  [switch]$DryRun,
  [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not $Apply -and -not $DryRun) {
  $DryRun = $true
}

if ($Apply -and -not $SkipBackup) {
  Write-Host "==> Backup local antes del reset de journey..." -ForegroundColor Yellow
  & (Join-Path $repo "scripts\poc-backup-local.ps1") -Label "antes-reset-journey"
}

$flag = if ($Apply) { "--apply" } else { "--dry-run" }
Write-Host "Running journey reset ($flag) via docker compose service api..."
docker compose --env-file .env.poc -f docker/compose.yaml exec api `
  python -m app.scripts.reset_journey $flag
