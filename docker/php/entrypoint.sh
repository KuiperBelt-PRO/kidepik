#!/bin/sh
set -e

should_run_migrations() {
    if [ "${RUN_MIGRATIONS_ON_START:-}" = "false" ]; then
        return 1
    fi
    if [ "${RUN_MIGRATIONS_ON_START:-}" = "true" ]; then
        return 0
    fi
    [ "${APP_ENV:-local}" = "local" ]
}

if should_run_migrations; then
    max_attempts=30
    attempt=0
  while [ "$attempt" -lt "$max_attempts" ]; do
    if php /var/www/api/bin/apply-migrations.php; then
      break
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "apply-migrations: Postgres no alcanzable tras ${max_attempts} intentos" >&2
      exit 1
    fi
    sleep 1
  done
fi

if [ "${AI_DISCOVERY_ON_START:-true}" != "false" ]; then
  php /var/www/api/bin/sync-ai-discovery.php || echo "sync-ai-discovery: warning (non-fatal)" >&2
fi

exec docker-php-entrypoint "$@"
