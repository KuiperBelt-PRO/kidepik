# Reset viajeros al first_run (cutover agentic)
# SPEC_AI_JOURNEY_FILE_LEDGER §10
param(
  [switch]$Apply,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

if (-not $Apply -and -not $DryRun) {
  $DryRun = $true
}

$flag = if ($Apply) { "--apply" } else { "--dry-run" }
Write-Host "Running journey reset ($flag) via docker compose service api..."
docker compose --env-file .env.poc -f docker/compose.yaml exec api `
  python -m app.scripts.reset_journey $flag
