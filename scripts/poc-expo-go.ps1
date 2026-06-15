# Arranca Expo Go: detecta IP LAN, configura mobile/.env y API (presigned MinIO)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-LanIPv4 {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notmatch "^127\." -and
            $_.IPAddress -notmatch "^169\.254\." -and
            $_.PrefixOrigin -ne "WellKnown"
        } |
        Sort-Object -Property InterfaceMetric |
        Select-Object -First 1 -ExpandProperty IPAddress

    if (-not $ip) {
        throw "No se detectó IP LAN. Conecta el PC a Wi‑Fi/Ethernet."
    }
    return $ip
}

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args
    } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @args
    } else {
        throw "Necesitas supabase CLI o pnpm."
    }
}

Write-Host "==> KidepiK POC — Expo Go" -ForegroundColor Cyan

$lanIp = Get-LanIPv4
Write-Host "IP LAN detectada: $lanIp" -ForegroundColor Green

# Supabase publishable key
$publishableKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
try {
    $statusJson = Invoke-Supabase status -o json 2>$null | Out-String | ConvertFrom-Json
    if ($statusJson.PUBLISHABLE_KEY) { $publishableKey = $statusJson.PUBLISHABLE_KEY }
    elseif ($statusJson.anon_key) { $publishableKey = $statusJson.anon_key }
} catch {
    Write-Host "Usando publishable key por defecto (supabase status no disponible)." -ForegroundColor Yellow
}

# mobile/.env
$mobileEnv = Join-Path $Root "mobile\.env"
@"
EXPO_PUBLIC_API_URL=http://${lanIp}:8080
EXPO_PUBLIC_SUPABASE_URL=http://${lanIp}:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$publishableKey
"@ | Set-Content -Path $mobileEnv -Encoding utf8
Write-Host "Escrito $mobileEnv" -ForegroundColor Green

# .env.poc + reinicio API para presigned URLs con IP LAN
$envPoc = Join-Path $Root ".env.poc"
if (-not (Test-Path $envPoc)) {
    Copy-Item (Join-Path $Root ".env.poc.sample") $envPoc
}

$envContent = Get-Content $envPoc -Raw
$replacements = @{
    "PUBLIC_API_URL=.*"          = "PUBLIC_API_URL=http://${lanIp}:8080"
    "PUBLIC_SUPABASE_URL=.*"       = "PUBLIC_SUPABASE_URL=http://${lanIp}:54321"
    "PUBLIC_STORAGE_URL=.*"        = "PUBLIC_STORAGE_URL=http://${lanIp}:9000"
    "S3_PUBLIC_BASE_URL=.*"        = "S3_PUBLIC_BASE_URL=http://${lanIp}:9000/kidepik-media"
    "S3_EXTERNAL_ENDPOINT_URL=.*"  = "S3_EXTERNAL_ENDPOINT_URL=http://${lanIp}:9000"
}
foreach ($pattern in $replacements.Keys) {
    if ($envContent -match $pattern) {
        $envContent = $envContent -replace $pattern, $replacements[$pattern]
    } else {
        $envContent += "`n$($replacements[$pattern])"
    }
}
Set-Content -Path $envPoc -Value $envContent.TrimEnd() -Encoding utf8

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "Reiniciando API con URLs LAN..." -ForegroundColor Yellow
    docker compose --env-file $envPoc -f (Join-Path $Root "docker/compose.yaml") up -d --build api
}

Write-Host ""
Write-Host "==> Pasos" -ForegroundColor Cyan
Write-Host "  1. Móvil y PC en la misma Wi‑Fi"
Write-Host "  2. Instala Expo Go: https://expo.dev/go"
Write-Host "  3. Comprueba desde el móvil (navegador): http://${lanIp}:8080/health"
Write-Host "  4. Escanea el QR que aparecerá abajo"
Write-Host ""
Write-Host "Firewall Windows: permite Node/Expo y puertos 8080, 54321, 9000 en red privada." -ForegroundColor Yellow
Write-Host ""

# Liberar Metro previo (evita "port 8081 is being used")
Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Remove-Item Env:CI -ErrorAction SilentlyContinue
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
$env:EXPO_DEVTOOLS_LISTEN_ADDRESS = "0.0.0.0"

Set-Location (Join-Path $Root "mobile")
if (-not (Test-Path "node_modules")) {
    pnpm install
} else {
    pnpm install --no-frozen-lockfile 2>$null
}

$expUrl = "exp://${lanIp}:8081"
$qrDir = Join-Path $Root "tmp"
New-Item -ItemType Directory -Force -Path $qrDir | Out-Null
$qrPath = Join-Path $qrDir "expo-go-qr.png"
Write-Host "Generando QR: $expUrl" -ForegroundColor Cyan
node (Join-Path $Root "mobile\scripts\generate-qr.mjs") $lanIp | ForEach-Object { Write-Host $_ }
if (Test-Path $qrPath) {
    Write-Host "QR guardado: $qrPath" -ForegroundColor Green
    Start-Process $qrPath
}

Write-Host ""
Write-Host "NOTA: http://localhost:8081 muestra JSON (manifiesto), no es un fallo." -ForegroundColor DarkGray
Write-Host "Escanea el PNG abierto (tmp/expo-go-qr.png) o el QR ASCII en esta terminal." -ForegroundColor Cyan
Write-Host "URL manual Expo Go: $expUrl" -ForegroundColor DarkGray
Write-Host ""

pnpm start --host lan
