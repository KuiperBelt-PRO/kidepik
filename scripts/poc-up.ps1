# Levanta la POC: Supabase CLI + Docker (nginx + PHP)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> KidepiK POC - arranque" -ForegroundColor Cyan

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args 2>&1 | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @args 2>&1 | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    } else {
        Write-Host "Instala Supabase CLI o pnpm." -ForegroundColor Red
        exit 1
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker no encontrado." -ForegroundColor Red
    exit 1
}

Write-Host "==> Supabase local (Postgres + Auth + REST)..." -ForegroundColor Yellow
& (Join-Path $Root "scripts\sync-google-oauth-env.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Host "OAuth Google no configurado aún. Ejecuta: ./scripts/setup-google-oauth.ps1" -ForegroundColor Yellow
}
$null = Invoke-Supabase start

Write-Host "==> Aplicando migraciones..." -ForegroundColor Yellow
$null = Invoke-Supabase db reset --local --no-seed
if ($LASTEXITCODE -ne 0) {
    $null = Invoke-Supabase migration up --local
}

$envFile = Join-Path $Root ".env.poc"
$envSample = Join-Path $Root ".env.poc.sample"
if (-not (Test-Path $envFile)) {
    Copy-Item $envSample $envFile
    Write-Host "Creado .env.poc desde plantilla." -ForegroundColor Green
}

& (Join-Path $Root "scripts\poc-write-config.ps1")

Write-Host "==> Docker Compose (nginx + PHP; migraciones PHP al arrancar contenedor)..." -ForegroundColor Yellow
docker compose --env-file $envFile -f (Join-Path $Root "docker\compose.yaml") up -d --build

Write-Host ""
Write-Host "==> Estado Supabase" -ForegroundColor Cyan
$null = Invoke-Supabase status

Write-Host ""
Write-Host "==> Endpoints" -ForegroundColor Cyan
Write-Host "  App (web + API):  http://localhost:8082"
Write-Host "  API health:       http://localhost:8082/api/v1/health"
Write-Host "  Media:            http://localhost:8082/media/"
Write-Host "  Supabase:         http://localhost:54321"
Write-Host ""
Write-Host "Preview movil: ./scripts/poc-web-preview.ps1" -ForegroundColor Green
