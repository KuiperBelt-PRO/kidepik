# Para la POC local (FastAPI + MinIO)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env.poc"
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path $Root ".env.poc.sample"
}

Write-Host "==> Parando Docker Compose..." -ForegroundColor Yellow
docker compose --env-file $envFile -f (Join-Path $Root "docker/compose.yaml") down

if (Get-Command supabase -ErrorAction SilentlyContinue) {
    Write-Host "==> Parando Supabase local..." -ForegroundColor Yellow
    supabase stop
}

Write-Host "POC detenida." -ForegroundColor Green
