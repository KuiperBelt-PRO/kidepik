# Ejecuta la suite completa: PHPUnit (API) + unit JS + Playwright E2E.
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

$phpStatus = docker compose --env-file .env.poc -f docker/compose.yaml ps --status running --services php 2>$null
if (-not $phpStatus) {
  Write-Host "Stack no detectado; arrancando poc-up..." -ForegroundColor Yellow
  & (Join-Path $Root "scripts\poc-up.ps1")
}

Write-Host "==> PHPUnit (cobertura >= 90%)" -ForegroundColor Yellow
docker compose --env-file .env.poc -f docker/compose.yaml exec -T php vendor/bin/phpunit --no-coverage
if ($LASTEXITCODE -ne 0) { Fail "PHPUnit falló" }
$covOut = docker compose --env-file .env.poc -f docker/compose.yaml exec -T php vendor/bin/phpunit --coverage-text --colors=never 2>&1
$covOut | Out-Host
$covText = ($covOut | Out-String)
if ($covText -match 'Lines:\s+([\d.]+)%') {
  $pct = [double]$Matches[1]
  if ($pct -lt 90) { Fail "Cobertura PHP $($pct)% < 90%" }
  Write-Host "Cobertura PHP: $($pct)%" -ForegroundColor Cyan
} else {
  Fail "No se pudo parsear cobertura PHP de PHPUnit (buscar 'Lines: X%')"
}

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
