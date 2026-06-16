# Arranca Expo Web en localhost:8081 — desarrollo en PC y pruebas MCP browser

param(
    [switch]$Backend
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args
    } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @args
    } else {
        throw "Necesitas supabase CLI o pnpm."
    }
}

Write-Host "==> KidepiK POC - Expo Web (localhost)" -ForegroundColor Cyan

$publishableKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
try {
    $statusJson = Invoke-Supabase status -o json 2>$null | Out-String | ConvertFrom-Json
    if ($statusJson.PUBLISHABLE_KEY) { $publishableKey = $statusJson.PUBLISHABLE_KEY }
    elseif ($statusJson.anon_key) { $publishableKey = $statusJson.anon_key }
} catch {
    Write-Host "Usando publishable key por defecto (supabase status no disponible)." -ForegroundColor Yellow
}

$mobileEnv = Join-Path $Root "mobile\.env"
@"
EXPO_PUBLIC_API_URL=http://localhost:8080
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$publishableKey
"@ | Set-Content -Path $mobileEnv -Encoding utf8
Write-Host "Escrito $mobileEnv (localhost)" -ForegroundColor Green

if ($Backend) {
    Write-Host "Levantando stack backend (poc-up)..." -ForegroundColor Yellow
    & (Join-Path $Root "scripts\poc-up.ps1")
} else {
    Write-Host "Modo galería/UI (sin backend). Usa -Backend para POC arquitectura." -ForegroundColor DarkGray
}

Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Remove-Item Env:CI -ErrorAction SilentlyContinue
Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue
$env:EXPO_OFFLINE = "1"

Set-Location (Join-Path $Root "mobile")
if (-not (Test-Path "node_modules")) {
    pnpm install
} else {
    pnpm install --no-frozen-lockfile 2>$null
}

$webUrl = "http://localhost:8081"
Write-Host ""
Write-Host "==> Expo Web" -ForegroundColor Cyan
Write-Host "  URL app:     $webUrl"
Write-Host "  Agentes MCP: browser_navigate -> $webUrl"
Write-Host "  Capturas:    tmp/playwright-output/"
if ($Backend) {
    Write-Host "  API health:  http://localhost:8080/health"
}
Write-Host ""
Write-Host "NOTA: con Metro nativo (sin --web), localhost:8081 muestra JSON de manifiesto." -ForegroundColor DarkGray
Write-Host ""

pnpm web
