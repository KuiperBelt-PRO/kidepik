# Ejecuta la suite completa: pytest (FastAPI) + unit JS + Playwright E2E.
# Requiere stack POC levantado: ./scripts/poc-up.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> KidepiK test-all" -ForegroundColor Cyan

function Fail($msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Fail "Docker no encontrado. Levanta el stack con ./scripts/poc-up.ps1"
}

$apiStatus = docker compose --env-file .env.poc -f docker/compose.yaml ps --status running --services api 2>$null
if (-not $apiStatus) {
  Write-Host "Stack no detectado; arrancando poc-up..." -ForegroundColor Yellow
  & (Join-Path $Root "scripts\poc-up.ps1")
}

Write-Host "==> Pytest (FastAPI)" -ForegroundColor Yellow
docker compose --env-file .env.poc -f docker/compose.yaml exec -T api pytest -q
if ($LASTEXITCODE -ne 0) { Fail "Pytest falló" }

Write-Host "==> Node unit tests (cobertura >= 90%)" -ForegroundColor Yellow
Push-Location (Join-Path $Root "web")
if (-not (Test-Path "node_modules")) {
  npm install
}
npm run test:coverage
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Node tests fallaron" }
Pop-Location

Write-Host "==> Playwright E2E" -ForegroundColor Yellow
Push-Location (Join-Path $Root "web")
$env:PLAYWRIGHT_BASE_URL = "http://localhost:8082"
npx playwright install chromium 2>$null
npm run test:e2e
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Playwright E2E falló" }
Pop-Location

Write-Host "==> Todos los tests OK" -ForegroundColor Green
