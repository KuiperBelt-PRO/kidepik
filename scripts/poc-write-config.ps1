# Genera web/js/config.js desde Supabase status + .env.poc (LAN opcional)

param(
    [string]$LanHost
)

$ErrorActionPreference = "Stop"
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args 2>&1
    } else {
        pnpm dlx supabase @args 2>&1
    }
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

$envPoc = Join-Path $Root ".env.poc"
if (-not $LanHost) {
    $LanHost = Read-DotEnvValue -Path $envPoc -Key "KIDEPIK_LAN_HOST"
}

$publicSupabaseUrl = Read-DotEnvValue -Path $envPoc -Key "PUBLIC_SUPABASE_URL"
$supabaseUrl = "http://localhost:54321"

if ($publicSupabaseUrl -and $publicSupabaseUrl -notmatch "localhost" -and $publicSupabaseUrl -notmatch "127\.0\.0\.1") {
    $supabaseUrl = $publicSupabaseUrl
} elseif ($LanHost) {
    $oauthHost = $LanHost
    if ($oauthHost -match '^\d{1,3}(\.\d{1,3}){3}$') {
        $oauthHost = $oauthHost + ".nip.io"
    }
    $supabaseUrl = "http://" + $oauthHost + ":54321"
}

$publishableKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
try {
    $statusJson = Invoke-Supabase status -o json 2>$null | Out-String | ConvertFrom-Json
    if ($statusJson.PUBLISHABLE_KEY) { $publishableKey = $statusJson.PUBLISHABLE_KEY }
    elseif ($statusJson.anon_key) { $publishableKey = $statusJson.anon_key }
} catch {
    Write-Host "Usando publishable key por defecto (supabase status no disponible)." -ForegroundColor Yellow
}

$webConfig = Join-Path $Root "web\js\config.js"
$content = @"
/** Generado por scripts/poc-write-config.ps1 — no commitear */
export const config = {
  apiUrl: "/api/v1",
  mediaBaseUrl: "/media",
  supabaseUrl: "$supabaseUrl",
  supabaseAnonKey: "$publishableKey",
};
"@

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($webConfig, $content, $utf8)
Write-Host "Actualizado web/js/config.js (supabaseUrl=$supabaseUrl)" -ForegroundColor Green
