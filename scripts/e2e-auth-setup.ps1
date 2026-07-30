# Genera web/e2e/.auth/tutor.json para Playwright MCP y @playwright/test
$ErrorActionPreference = "Stop"
$Root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { Get-Location }

Write-Host "==> Auth E2E tutor (GoTrue local)" -ForegroundColor Yellow
Push-Location (Join-Path $Root "web")
try {
    node "e2e/helpers/ensure-tutor-user.mjs"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
Write-Host "Listo. MCP: usar storageState o authenticatePlaywrightPage (ver web-mobile-preview SKILL)." -ForegroundColor Green
