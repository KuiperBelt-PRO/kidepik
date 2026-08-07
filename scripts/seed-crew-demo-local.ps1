# Rellena datos demo en tripulantes locales (FastAPI).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

docker compose --env-file .env.poc -f docker/compose.yaml exec -T api python -m app.scripts.seed_crew_demo
