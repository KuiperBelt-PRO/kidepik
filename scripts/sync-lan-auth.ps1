# Sincroniza URLs OAuth para Supabase.
# Default (KIDEPIK_LAN_HOST vacío/off): PC local → 127.0.0.1 (mismo PC / localhost).
# Tablet en LAN: KIDEPIK_LAN_HOST=auto (detecta IP) o KIDEPIK_LAN_HOST=192.168.x.x

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

function Test-PrivateIpv4 {
    param([string]$Ip)
    if ($Ip -notmatch '^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$') { return $false }
    $a = [int]$Matches[1]
    $b = [int]$Matches[2]
    return (
        $a -eq 10 -or
        ($a -eq 192 -and $b -eq 168) -or
        ($a -eq 172 -and $b -ge 16 -and $b -le 31)
    )
}

function Get-PrimaryLanIPv4 {
    try {
        $configs = Get-NetIPConfiguration -ErrorAction Stop |
            Where-Object {
                $_.NetAdapter.Status -eq "Up" -and
                $null -ne $_.IPv4DefaultGateway -and
                $null -ne $_.IPv4Address
            }
        foreach ($cfg in $configs) {
            foreach ($addr in @($cfg.IPv4Address)) {
                $ip = $addr.IPAddress
                if ($ip -and (Test-PrivateIpv4 $ip)) {
                    return $ip
                }
            }
        }
    } catch {
        # Fallback abajo
    }

    try {
        $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -and
                (Test-PrivateIpv4 $_.IPAddress) -and
                $_.PrefixOrigin -ne "WellKnown"
            } |
            Sort-Object InterfaceMetric
        if ($addrs -and $addrs[0].IPAddress) {
            return $addrs[0].IPAddress
        }
    } catch {
        return $null
    }
    return $null
}

$envPoc = Join-Path $Root ".env.poc"
$lanHostRaw = Read-DotEnvValue -Path $envPoc -Key "KIDEPIK_LAN_HOST"
$lanSource = "pc"

# Mismo PC / localhost: siempre 127.0.0.1 para el redirect de Google.
# LAN solo si se pide explícitamente (auto o IP). Si no, OAuth en localhost
# redirige a nip.io de otra red y timeout (ERR_CONNECTION_TIMED_OUT).
if (-not $lanHostRaw -or $lanHostRaw -match '^(off|local|none|false|0)$') {
    $lanHost = $null
    $lanSource = "pc"
} elseif ($lanHostRaw -match '^(auto|detect)$') {
    $detected = Get-PrimaryLanIPv4
    if ($detected) {
        $lanHostRaw = $detected
        $lanHost = Resolve-LanOAuthHost $detected
        $lanSource = "auto"
    } else {
        $lanHost = $null
        $lanSource = "auto-none"
        Write-Host "KIDEPIK_LAN_HOST=auto pero no hay IPv4 LAN; usando 127.0.0.1" -ForegroundColor Yellow
    }
} else {
    $lanHost = Resolve-LanOAuthHost $lanHostRaw
    $lanSource = "env"
}

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
    Write-Host "Modo LAN activo ($lanHost) [$lanSource]" -ForegroundColor Cyan
    if ($lanHostRaw -and ($lanHostRaw -ne $lanHost)) {
        Write-Host "  (IP $lanHostRaw -> dominio OAuth $lanHost; Google no acepta IP privada)" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "Modo PC local (127.0.0.1) [$lanSource]" -ForegroundColor Cyan
}

$configToml = Join-Path $Root "supabase\config.toml"
if (-not (Test-Path $configToml)) {
    Write-Host "No existe supabase/config.toml" -ForegroundColor Red
    exit 1
}

# Wildcards: cualquier red via nip.io (Supabase GoTrue). Google Console sigue
# requiriendo cada {ip}.nip.io concreto en origins/redirects.
$lanUrls = @(
    "http://*.nip.io:8082",
    "http://*.nip.io:8082/**",
    "http://*.nip.io:8082/#/auth/callback"
)
if ($lanHost) {
    $lanUrls += @(
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
    Write-Host "En Google Cloud Console (una vez por red/IP), anade:" -ForegroundColor Yellow
    Write-Host ('  JS origin:     http://' + $lanHost + ':8082')
    Write-Host ('  Redirect URI:  ' + $googleRedirectUri)
    Write-Host "Tras cambiar de WiFi: ./scripts/sync-lan-auth.ps1 y reinicia Supabase." -ForegroundColor Yellow
}

exit 0
