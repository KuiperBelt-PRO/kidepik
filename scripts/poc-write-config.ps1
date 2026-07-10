# Genera web/js/config.js desde Supabase status

$ErrorActionPreference = "Stop"
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args 2>&1
    } else {
        pnpm dlx supabase @args 2>&1
    }
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
  supabaseUrl: "http://localhost:54321",
  supabaseAnonKey: "$publishableKey",
};
"@

[System.IO.File]::WriteAllText($webConfig, $content)
Write-Host "Actualizado web/js/config.js" -ForegroundColor Green
