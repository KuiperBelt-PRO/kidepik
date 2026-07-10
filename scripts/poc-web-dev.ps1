# DEPRECADO — usar ./scripts/poc-up.ps1 (Docker nginx + PHP en :8082)

$ErrorActionPreference = "Stop"
Write-Host "poc-web-dev.ps1 está deprecado." -ForegroundColor Yellow
Write-Host "Usa: ./scripts/poc-up.ps1" -ForegroundColor Cyan
& (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\poc-up.ps1")
