# Bootstrap de credenciales Google OAuth para Supabase local
# Uso: ./scripts/setup-google-oauth.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$SecretsDir = Join-Path $Root ".secrets"
$EnvSample = Join-Path $Root ".secrets.sample\gcp-oauth.env.sample"
$EnvFile = Join-Path $SecretsDir "gcp-oauth.env"
$JsonFile = Join-Path $SecretsDir "gcp-oauth-client.json"

Write-Host "==> KidepiK - setup Google OAuth (local)" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null

if (-not (Test-Path $EnvFile) -and -not (Test-Path $JsonFile)) {
    Copy-Item $EnvSample $EnvFile
    Write-Host "Creado .secrets/gcp-oauth.env desde plantilla." -ForegroundColor Green
    Write-Host ""
    Write-Host "Siguiente paso en Google Cloud Console:" -ForegroundColor Yellow
    Write-Host "  1. APIs and Services - OAuth consent screen (app Testing)"
    Write-Host "  2. Credentials - Create OAuth client ID - Web application"
    Write-Host "  3. Authorized JavaScript origins:"
    Write-Host "       http://localhost:8082"
    Write-Host "  4. Authorized redirect URIs (exacto, 127.0.0.1 no localhost):"
    Write-Host "       http://127.0.0.1:54321/auth/v1/callback"
    Write-Host "  5. Descarga JSON y guarda como .secrets/gcp-oauth-client.json"
    Write-Host "     O copia Client ID y Secret en .secrets/gcp-oauth.env"
    Write-Host ""
    Write-Host "Luego ejecuta: ./scripts/sync-google-oauth-env.ps1" -ForegroundColor Green
    exit 0
}

& (Join-Path $Root "scripts\sync-google-oauth-env.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "==> Reiniciando Supabase para cargar el provider Google..." -ForegroundColor Yellow

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args 2>&1 | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    }
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @args 2>&1 | ForEach-Object { Write-Host $_ }
        return $LASTEXITCODE
    }
    Write-Host "Supabase CLI no encontrado. Usa: pnpm dlx supabase stop; pnpm dlx supabase start" -ForegroundColor Red
    exit 1
}

$null = Invoke-Supabase stop
$code = Invoke-Supabase start
if ($code -ne 0) { exit $code }

Write-Host ""
Write-Host "==> Listo. Prueba en http://localhost:8082" -ForegroundColor Green
