# Levanta la POC local completa: Supabase CLI + Docker (FastAPI + MinIO/R2)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> KidepiK POC — arranque" -ForegroundColor Cyan

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        function supabase { pnpm dlx supabase @args }
        Write-Host "Usando 'pnpm dlx supabase' (CLI no global)." -ForegroundColor Yellow
    } else {
        Write-Host "Instala Supabase CLI o pnpm: https://supabase.com/docs/guides/local-development/cli/getting-started" -ForegroundColor Red
        exit 1
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker no encontrado." -ForegroundColor Red
    exit 1
}

Write-Host "==> Supabase local (Postgres + Auth + REST)..." -ForegroundColor Yellow
supabase start

Write-Host "==> Aplicando migraciones..." -ForegroundColor Yellow
supabase db reset --local --no-seed 2>$null
if ($LASTEXITCODE -ne 0) {
    supabase migration up --local
}

$envFile = Join-Path $Root ".env.poc"
$envSample = Join-Path $Root ".env.poc.sample"
if (-not (Test-Path $envFile)) {
    Copy-Item $envSample $envFile
    Write-Host "Creado .env.poc desde plantilla." -ForegroundColor Green
}

Write-Host "==> Docker Compose (FastAPI + MinIO)..." -ForegroundColor Yellow
docker compose --env-file $envFile -f (Join-Path $Root "docker/compose.yaml") up -d --build

Write-Host ""
Write-Host "==> Estado Supabase" -ForegroundColor Cyan
supabase status

Write-Host ""
Write-Host "==> Endpoints (emulador Android usa 10.0.2.2)" -ForegroundColor Cyan
Write-Host "  FastAPI:   http://10.0.2.2:8080/health"
Write-Host "  Supabase:  http://10.0.2.2:54321"
Write-Host "  MinIO:     http://10.0.2.2:9000  (consola :9001)"
Write-Host ""
Write-Host "Siguiente paso — mobile:" -ForegroundColor Green
Write-Host "  1. supabase status  → copiar anon key a mobile/.env"
Write-Host "  2. ./scripts/poc-expo-go.ps1   (Expo Go, móvil físico)"
