# Sincroniza credenciales OAuth Google → supabase/.env (gitignored)
# Fuentes (en orden):
#   1. kidepik/.secrets/gcp-oauth-client.json (descarga de GCP Console)
#   2. kidepik/.secrets/gcp-oauth.env (GCP_OAUTH_CLIENT_ID / GCP_OAUTH_CLIENT_SECRET)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$SecretsDir = Join-Path $Root ".secrets"
$EnvFile = Join-Path $SecretsDir "gcp-oauth.env"
$JsonFile = Join-Path $SecretsDir "gcp-oauth-client.json"
$SupabaseEnv = Join-Path $Root "supabase\.env"

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Read-DotEnvValue {
    param([string]$Path, [string]$Key)
    if (-not (Test-Path $Path)) { return $null }
    foreach ($line in Get-Content $Path) {
        if ($line -match "^\s*#") { continue }
        if ($line -match "^\s*$Key\s*=\s*(.+)\s*$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

$clientId = $null
$clientSecret = $null

if (Test-Path $JsonFile) {
    $json = Get-Content $JsonFile -Raw | ConvertFrom-Json
    if ($json.web) {
        $clientId = $json.web.client_id
        $clientSecret = $json.web.client_secret
    } elseif ($json.installed) {
        $clientId = $json.installed.client_id
        $clientSecret = $json.installed.client_secret
    } elseif ($json.client_id) {
        $clientId = $json.client_id
        $clientSecret = $json.client_secret
    }
    if ($clientId -and $clientSecret) {
        Write-Host "Credenciales leídas de .secrets/gcp-oauth-client.json" -ForegroundColor Green
    }
}

if (-not $clientId -and (Test-Path $EnvFile)) {
    $clientId = Read-DotEnvValue -Path $EnvFile -Key "GCP_OAUTH_CLIENT_ID"
    $clientSecret = Read-DotEnvValue -Path $EnvFile -Key "GCP_OAUTH_CLIENT_SECRET"
    if ($clientId -and $clientSecret) {
        Write-Host "Credenciales leídas de .secrets/gcp-oauth.env" -ForegroundColor Green
    }
}

if (-not $clientId -or -not $clientSecret -or $clientId -like "TU_*" -or $clientSecret -like "TU_*") {
    Write-Host ""
    Write-Host "Faltan credenciales OAuth Google." -ForegroundColor Yellow
    Write-Host "  Opción A: coloca el JSON en .secrets/gcp-oauth-client.json"
    Write-Host "  Opción B: edita .secrets/gcp-oauth.env (GCP_OAUTH_CLIENT_ID / GCP_OAUTH_CLIENT_SECRET)"
    Write-Host "  Luego vuelve a ejecutar: ./scripts/sync-google-oauth-env.ps1"
    Write-Host ""
    exit 1
}

$supabaseDir = Split-Path $SupabaseEnv -Parent
if (-not (Test-Path $supabaseDir)) {
    New-Item -ItemType Directory -Force -Path $supabaseDir | Out-Null
}

$content = @"
# Generado por scripts/sync-google-oauth-env.ps1 — no commitear
GOOGLE_CLIENT_ID=$clientId
GOOGLE_CLIENT_SECRET=$clientSecret
"@

Write-Utf8NoBom -Path $SupabaseEnv -Content $content
Write-Host "Actualizado supabase/.env" -ForegroundColor Green

# Mantener gcp-oauth.env alineado si solo existía JSON
if (-not (Test-Path $EnvFile)) {
    $envContent = @"
# Generado desde gcp-oauth-client.json — no commitear
GCP_OAUTH_CLIENT_ID=$clientId
GCP_OAUTH_CLIENT_SECRET=$clientSecret
GCP_PROJECT_ID=kidepik
"@
    New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
    Write-Utf8NoBom -Path $EnvFile -Content $envContent
    Write-Host "Creado .secrets/gcp-oauth.env" -ForegroundColor Green
}

exit 0
