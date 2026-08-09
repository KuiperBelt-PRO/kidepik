# Copia de seguridad local de datos mutables (journey, media, logs, Supabase).
# Uso: ./scripts/poc-backup-local.ps1
#      ./scripts/poc-backup-local.ps1 -Label "antes-reset"

param(
    [string]$Label = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Invoke-Supabase {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @Args
        return $LASTEXITCODE
    }
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        pnpm dlx supabase @Args
        return $LASTEXITCODE
    }
    return 127
}

function Copy-TreeIfExists {
    param(
        [string]$Source,
        [string]$Destination
    )
    if (-not (Test-Path $Source)) {
        return $false
    }
    $items = Get-ChildItem -Path $Source -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne ".gitkeep" }
    if (-not $items) {
        return $false
    }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
    return $true
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$folderName = if ($Label) { "$stamp-$Label" } else { $stamp }
$destRoot = Join-Path $Root "data\backups\$folderName"
New-Item -ItemType Directory -Path $destRoot -Force | Out-Null

Write-Host "==> Backup local KidepiK -> data/backups/$folderName" -ForegroundColor Cyan

$manifest = [ordered]@{
    created_at = (Get-Date).ToUniversalTime().ToString("o")
    label      = $Label
    paths      = @{}
}

$manifest.paths.journey = Copy-TreeIfExists (Join-Path $Root "data\journey") (Join-Path $destRoot "journey")
$manifest.paths.media = Copy-TreeIfExists (Join-Path $Root "web\media") (Join-Path $destRoot "media")
$manifest.paths.logs = Copy-TreeIfExists (Join-Path $Root "web\logs") (Join-Path $destRoot "logs")

$dumpPath = Join-Path $destRoot "supabase.sql"
$dumpExit = Invoke-Supabase db dump --local -f $dumpPath
if ($dumpExit -eq 0 -and (Test-Path $dumpPath) -and (Get-Item $dumpPath).Length -gt 0) {
    $manifest.paths.supabase = $dumpPath
    Write-Host "  Supabase: supabase.sql" -ForegroundColor Green
} else {
    if (Test-Path $dumpPath) { Remove-Item $dumpPath -Force -ErrorAction SilentlyContinue }
    $manifest.paths.supabase = $null
    Write-Host "  Supabase: omitido (CLI no disponible o stack parado)" -ForegroundColor Yellow
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $destRoot "manifest.json") -Encoding UTF8

foreach ($key in @("journey", "media", "logs")) {
    $ok = $manifest.paths[$key]
    $color = if ($ok) { "Green" } else { "DarkGray" }
    $state = if ($ok) { "copiado" } else { "vacío o ausente" }
    Write-Host "  $key : $state" -ForegroundColor $color
}

Write-Host ""
Write-Host "Backup listo en data/backups/$folderName" -ForegroundColor Green
