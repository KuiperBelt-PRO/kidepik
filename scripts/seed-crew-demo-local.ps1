# Rellena datos de demostración en tripulantes locales (requiere stack levantado).
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repoRoot "docker")
try {
    docker compose --env-file .env.poc -f docker/compose.yaml --profile php-legacy exec -T php php /var/www/api/bin/seed-crew-demo.php
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
