# Arranca cliente web KidepiK en http://localhost:8082

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

Write-Host "==> KidepiK - Web (HTML/CSS/JS)" -ForegroundColor Cyan

$publishableKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
try {
    $statusJson = Invoke-Supabase status -o json 2>$null | Out-String | ConvertFrom-Json
    if ($statusJson.PUBLISHABLE_KEY) { $publishableKey = $statusJson.PUBLISHABLE_KEY }
    elseif ($statusJson.anon_key) { $publishableKey = $statusJson.anon_key }
} catch {
    Write-Host "Usando publishable key por defecto (supabase status no disponible)." -ForegroundColor Yellow
}

$webConfig = Join-Path $Root "web\js\config.js"
$webSample = Join-Path $Root "web\js\config.sample.js"
if (-not (Test-Path $webConfig)) {
    Copy-Item $webSample $webConfig
    Write-Host "Creado web/js/config.js desde config.sample.js" -ForegroundColor Green
}

@"
export const config = {
  apiUrl: "http://localhost:8080",
  supabaseUrl: "http://localhost:54321",
  supabaseAnonKey: "$publishableKey",
};
"@ | Set-Content -Path $webConfig -Encoding utf8
Write-Host "Actualizado web/js/config.js (localhost)" -ForegroundColor Green

if ($Backend) {
    Write-Host "Levantando stack backend (poc-up)..." -ForegroundColor Yellow
    & (Join-Path $Root "scripts\poc-up.ps1")
} else {
    Write-Host "Modo galeria/UI (sin backend). Usa -Backend para POC arquitectura." -ForegroundColor DarkGray
}

Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Set-Location (Join-Path $Root "web")
if (-not (Test-Path "node_modules")) {
    pnpm install
} else {
    pnpm install --no-frozen-lockfile 2>$null
}

Write-Host ""
Write-Host "==> Web dev" -ForegroundColor Cyan
Write-Host "  URL app:     http://localhost:8082"
Write-Host "  Preview movil: ./scripts/poc-web-preview.ps1"
Write-Host "  Agentes MCP: browser_navigate -> http://localhost:8082 (viewport 390x844)"
Write-Host "  Capturas:    tmp/playwright-output/"
Write-Host ""

pnpm dev
