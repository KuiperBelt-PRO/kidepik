# Electron preview 390x844 — requiere web dev en 8082 o usa -Static

param(
    [switch]$Static,
    [switch]$NoServer
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PreviewDir = Join-Path $Root "tools\preview-electron"
$WebDir = Join-Path $Root "web"

if (-not $NoServer) {
    if ($Static) {
        Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
        Set-Location $WebDir
        if (-not (Test-Path "node_modules")) { pnpm install }
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WebDir'; pnpm exec serve . -p 8082" | Out-Null
        Start-Sleep -Seconds 2
        $env:KIDEPIK_PREVIEW_URL = "http://localhost:8082"
    } else {
        $listening = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue
        if (-not $listening) {
            Write-Host "Puerto 8082 libre: arrancando poc-up.ps1 (Docker) en segundo plano..." -ForegroundColor Yellow
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; ./scripts/poc-up.ps1" | Out-Null
            Start-Sleep -Seconds 8
        }
        $env:KIDEPIK_PREVIEW_URL = "http://localhost:8082"
    }
}

Set-Location $PreviewDir
if (-not (Test-Path "node_modules")) {
    pnpm install
}

Write-Host "Abriendo Electron -> $env:KIDEPIK_PREVIEW_URL" -ForegroundColor Cyan
pnpm start
