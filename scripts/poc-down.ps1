# Para la POC local (nginx + FastAPI)

param(
    [switch]$Backup
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env.poc"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $Root ".env.poc.sample"
}

if ($Backup) {
    Write-Host "==> Backup local antes de parar..." -ForegroundColor Yellow
    & (Join-Path $Root "scripts\poc-backup-local.ps1") -Label "antes-poc-down"
}

Write-Host "==> Parando Docker Compose..." -ForegroundColor Yellow
docker compose --env-file $envFile -f (Join-Path $Root "docker/compose.yaml") down

if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Write-Host "==> Parando Supabase local..." -ForegroundColor Yellow
    supabase stop
}

Write-Host "POC detenida." -ForegroundColor Green
