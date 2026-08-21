# Sincroniza URLs LAN para OAuth (Supabase + config.js).
# Lee KIDEPIK_LAN_HOST de .env.poc; si vacio, usa 127.0.0.1 (solo PC).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

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

function Upsert-DotEnv {
    param([string]$Path, [hashtable]$Values)
    $lines = @()
    if (Test-Path $Path) {
        $lines = Get-Content $Path
    }
    foreach ($key in $Values.Keys) {
        $value = $Values[$key]
        $replaced = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^\s*$key\s*=") {
                $lines[$i] = "$key=$value"
                $replaced = $true
                break
            }
        }
        if (-not $replaced) {
            if ($lines.Count -gt 0 -and $lines[-1] -ne "") {
                $lines += ""
            }
            $lines += "$key=$value"
        }
    }
    Write-Utf8NoBom -Path $Path -Content (($lines -join "`n") + "`n")
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

# Google OAuth rechaza redirect_uri con IP privada cruda (192.168.x.x).
# nip.io resuelve p. ej. 192.168.1.75.nip.io -> 192.168.1.75 (DNS publico).
function Resolve-LanOAuthHost {
    param([string]$HostOrIp)
    if ($HostOrIp -match '^\d{1,3}(\.\d{1,3}){3}$') {
        return ($HostOrIp + ".nip.io")
    }
    return $HostOrIp
}

$envPoc = Join-Path $Root ".env.poc"
$lanHostRaw = Read-DotEnvValue -Path $envPoc -Key "KIDEPIK_LAN_HOST"
$lanHost = if ($lanHostRaw) { Resolve-LanOAuthHost $lanHostRaw } else { $null }
$authHost = if ($lanHost) { $lanHost } else { "127.0.0.1" }

$apiExternalUrl = "http://" + $authHost + ":54321"
$googleRedirectUri = $apiExternalUrl + "/auth/v1/callback"

$supabaseEnv = Join-Path $Root "supabase\.env"
$supabaseDir = Split-Path $supabaseEnv -Parent
if (-not (Test-Path $supabaseDir)) {
    New-Item -ItemType Directory -Force -Path $supabaseDir | Out-Null
}

Upsert-DotEnv -Path $supabaseEnv -Values @{
    SUPABASE_API_EXTERNAL_URL = $apiExternalUrl
    SUPABASE_GOOGLE_REDIRECT_URI = $googleRedirectUri
}

Write-Host "supabase/.env OAuth base: $apiExternalUrl" -ForegroundColor Green
if ($lanHost) {
    Write-Host "Modo LAN activo ($lanHost)" -ForegroundColor Cyan
    if ($lanHostRaw -and ($lanHostRaw -ne $lanHost)) {
        Write-Host "  (IP $lanHostRaw -> dominio OAuth $lanHost; Google no acepta IP privada)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "Modo PC local (127.0.0.1)" -ForegroundColor Cyan
}

$configToml = Join-Path $Root "supabase\config.toml"
if (-not (Test-Path $configToml)) {
    Write-Host "No existe supabase/config.toml" -ForegroundColor Red
    exit 1
}

$lanUrls = @()
if ($lanHost) {
    $lanUrls = @(
        ("http://" + $lanHost + ":8082"),
        ("http://" + $lanHost + ":8082/"),
        ("http://" + $lanHost + ":8082/#/auth/callback")
    )
}

$content = Get-Content $configToml -Raw
$missing = @()
foreach ($url in $lanUrls) {
    if ($content -notmatch [regex]::Escape($url)) {
        $missing += $url
    }
}

if ($missing.Count -gt 0) {
    $insertLines = ($missing | ForEach-Object { '  "' + $_ + '",' }) -join "`n"
    $pattern = '(additional_redirect_urls\s*=\s*\[[^\]]*)(\])'
    if ($content -notmatch $pattern) {
        Write-Host "No se encontro additional_redirect_urls en config.toml" -ForegroundColor Red
        exit 1
    }
    $newContent = [regex]::Replace(
        $content,
        $pattern,
        ('$1' + "`n" + $insertLines + "`n" + '$2'),
        1
    )
    Write-Utf8NoBom -Path $configToml -Content $newContent
    Write-Host "Anadidas URLs LAN a supabase/config.toml:" -ForegroundColor Green
    $missing | ForEach-Object { Write-Host "  $_" }
}

if ($lanHost) {
    Write-Host ""
    Write-Host "Google OAuth NO acepta IP privada en redirect_uri." -ForegroundColor Yellow
    Write-Host "Abre la app en el movil con:" -ForegroundColor Yellow
    Write-Host ('  http://' + $lanHost + ':8082')
    Write-Host ""
    Write-Host "En Google Cloud Console, anade:" -ForegroundColor Yellow
    Write-Host ('  JS origin:     http://' + $lanHost + ':8082')
    Write-Host ('  Redirect URI:  ' + $googleRedirectUri)
    Write-Host "Reinicia Supabase: supabase stop; supabase start" -ForegroundColor Yellow
}

exit 0
