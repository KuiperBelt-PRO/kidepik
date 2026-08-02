<?php

declare(strict_types=1);

namespace Kidepik\Shared;

use Kidepik\Shared\Logging\LogLevel;

final class Config
{
    private static bool $loaded = false;

    public static function load(?string $envFile = null): void
    {
        if (self::$loaded) {
            return;
        }

        if ($envFile !== null && is_readable($envFile)) {
            $dotenv = \Dotenv\Dotenv::createImmutable(dirname($envFile), basename($envFile));
            $dotenv->safeLoad();
        }

        self::$loaded = true;
    }

    public static function appName(): string
    {
        return self::get('APP_NAME', 'kidepik-api');
    }

    public static function appEnv(): string
    {
        return self::get('APP_ENV', 'local');
    }

    public static function runMigrationsOnRequest(): bool
    {
        $flag = self::get('RUN_MIGRATIONS_ON_REQUEST', '');
        if ($flag !== '') {
            return filter_var($flag, FILTER_VALIDATE_BOOL);
        }

        // Local: migraciones en arranque del contenedor PHP (entrypoint), no en cada request.
        return self::appEnv() !== 'local';
    }

    public static function supabaseUrl(): string
    {
        return rtrim(self::get('SUPABASE_URL', 'http://host.docker.internal:54321'), '/');
    }

    public static function supabaseAnonKey(): string
    {
        return self::get('SUPABASE_ANON_KEY', '');
    }

    public static function databaseUrl(): ?string
    {
        $url = self::get('DATABASE_URL', '');
        return $url !== '' ? $url : null;
    }

    public static function storageDriver(): string
    {
        return self::get('STORAGE_DRIVER', 'local');
    }

    public static function mediaRoot(): string
    {
        return self::get('MEDIA_ROOT', '/var/www/html/media');
    }

    public static function mediaPublicBaseUrl(): string
    {
        $base = self::get('MEDIA_PUBLIC_BASE_URL', '/media');
        return $base === '' ? '/media' : rtrim($base, '/');
    }

    public static function publicApiUrl(): string
    {
        return self::get('PUBLIC_API_URL', '/api/v1');
    }

    public static function publicSupabaseUrl(): string
    {
        return self::get('PUBLIC_SUPABASE_URL', 'http://localhost:54321');
    }

    public static function uploadTokenTtl(): int
    {
        return (int) self::get('UPLOAD_TOKEN_TTL', '900');
    }

    public static function aiEnabled(): bool
    {
        $v = self::get('AI_ENABLED', 'true');

        return filter_var($v, FILTER_VALIDATE_BOOL);
    }

    public static function aiMock(): bool
    {
        // Prohibido en runtime de producto (SPEC_AI_OPENROUTER_GATEWAY — máximas inviolables).
        return false;
    }

    public static function aiAllowPaid(): bool
    {
        // Inviolable: solo modelos free de OpenRouter.
        return false;
    }

    public static function openRouterApiKey(): string
    {
        return self::get('OPENROUTER_API_KEY', '');
    }

    public static function openRouterBaseUrl(): string
    {
        return rtrim(self::get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'), '/');
    }

    /**
     * Semilla opcional de ranking (solo si el operador define env). Vacío = puro discovery+ranking.
     *
     * @return list<string>
     */
    public static function aiModelPreferenceSeed(string $purpose = 'dialogue'): array
    {
        if (self::isPlacementPurpose($purpose)) {
            $placement = self::get('AI_MODEL_PREFERENCE_PLACEMENT', '');
            if ($placement !== '') {
                return self::parseCsvList($placement);
            }
        }

        if (self::isJourneyPurpose($purpose)) {
            $journey = self::get('AI_MODEL_PREFERENCE_JOURNEY', '');
            if ($journey !== '') {
                return self::parseCsvList($journey);
            }
        }

        if (self::aiUsesQualityFreeModels($purpose)) {
            $quality = self::get('AI_MODEL_PREFERENCE_QUALITY', '');
            if ($quality !== '') {
                return self::parseCsvList($quality);
            }
        }

        return self::aiModelPreference();
    }

    /** @return list<string> */
    public static function aiModelPreference(): array
    {
        $raw = self::get('AI_MODEL_PREFERENCE', '');
        if ($raw === '') {
            $raw = self::get('OPENROUTER_MODELS', '');
        }

        return $raw !== '' ? self::parseCsvList($raw) : [];
    }

    public static function aiUsesQualityFreeModels(string $purpose): bool
    {
        return in_array($purpose, [
            'dialogue',
            'journey_summarizer',
            'placement_exam_composer',
            'placement_exam_batch_writer',
            'placement_item_writer',
        ], true)
            || str_starts_with($purpose, 'placement_')
            || str_starts_with($purpose, 'adventure_');
    }

    /**
     * @deprecated Use aiModelPreferenceSeed(); sin env devuelve [].
     *
     * @return list<string>
     */
    public static function aiModelPreferenceFor(string $purpose): array
    {
        return self::aiModelPreferenceSeed($purpose);
    }

    private static function isPlacementPurpose(string $purpose): bool
    {
        return in_array($purpose, [
            'placement_exam_composer',
            'placement_exam_batch_writer',
            'placement_item_writer',
        ], true) || str_starts_with($purpose, 'placement_');
    }

    private static function isJourneyPurpose(string $purpose): bool
    {
        return in_array($purpose, ['dialogue', 'journey_summarizer'], true)
            || str_starts_with($purpose, 'adventure_');
    }

    /**
     * @return list<string>
     */
    private static function parseCsvList(string $raw): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $raw)), static fn (string $s): bool => $s !== ''));
    }

    /** @return list<string> */
    public static function aiModelDenylist(): array
    {
        $raw = self::get('AI_MODEL_DENYLIST', '');

        return array_values(array_filter(array_map('trim', explode(',', $raw)), static fn (string $s): bool => $s !== ''));
    }

    public static function aiMaxModelAttempts(): int
    {
        return max(1, (int) self::get('AI_MAX_MODEL_ATTEMPTS', '12'));
    }

    public static function aiGatewayWallBudgetSeconds(): int
    {
        return max(1, (int) self::get('AI_GATEWAY_WALL_BUDGET_SECONDS', '90'));
    }

    public static function aiCooldownTransportHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_TRANSPORT_HOURS', '6'));
    }

    public static function aiCooldownNotFoundHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_NOT_FOUND_HOURS', '24'));
    }

    public static function aiCooldownRateLimitHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_RATE_LIMIT_HOURS', '2'));
    }

    public static function aiCooldownEmptyHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_EMPTY_HOURS', '4'));
    }

    public static function aiCooldownHttpHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_HTTP_HOURS', '6'));
    }

    public static function aiCooldownDefaultHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_DEFAULT_HOURS', '6'));
    }

    public static function aiCooldownComposeParseHours(): int
    {
        return max(1, (int) self::get('AI_COOLDOWN_COMPOSE_PARSE_HOURS', '2'));
    }

    public static function aiDiscoveryEnabled(): bool
    {
        if (self::openRouterApiKey() === '') {
            return false;
        }

        return filter_var(self::get('AI_DISCOVERY_SYNC', 'true'), FILTER_VALIDATE_BOOL);
    }

    public static function aiDiscoveryIntervalHours(): int
    {
        return max(1, (int) self::get('AI_DISCOVERY_INTERVAL_HOURS', '6'));
    }

    public static function aiDiscoveryMaxNewPerPurpose(): int
    {
        return max(1, (int) self::get('AI_DISCOVERY_MAX_NEW_PER_PURPOSE', '5'));
    }

    public static function aiDiscoveryRebuildTop(): int
    {
        return max(3, (int) self::get('AI_DISCOVERY_REBUILD_TOP', '15'));
    }

    public static function aiQueueRefreshMinMinutes(): int
    {
        return max(1, (int) self::get('AI_QUEUE_REFRESH_MIN_MINUTES', '5'));
    }

    public static function aiComposeBatchMaxSlots(): int
    {
        return max(1, (int) self::get('AI_COMPOSE_BATCH_MAX_SLOTS', '4'));
    }

    public static function aiComposeBatchConcurrency(): int
    {
        return max(1, (int) self::get('AI_COMPOSE_BATCH_CONCURRENCY', '3'));
    }

    public static function aiComposeBatchRetries(): int
    {
        return max(0, (int) self::get('AI_COMPOSE_BATCH_RETRIES', '2'));
    }

    public static function aiComposeStickyWinner(): bool
    {
        return filter_var(self::get('AI_COMPOSE_STICKY_WINNER', 'true'), FILTER_VALIDATE_BOOL);
    }

    public static function aiSuccessBoostHours(): int
    {
        return max(1, (int) self::get('AI_SUCCESS_BOOST_HOURS', '48'));
    }

    public static function aiTimeoutSeconds(): int
    {
        return max(5, (int) self::get('AI_TIMEOUT_SECONDS', '30'));
    }

    public static function aiHttpReferer(): string
    {
        return self::get('AI_HTTP_REFERER', 'http://localhost:8082');
    }

    public static function aiAppTitle(): string
    {
        return self::get('AI_APP_TITLE', 'KidepiK');
    }

    public static function aiRateLimitPerChildDay(): int
    {
        return max(1, (int) self::get('AI_RATE_LIMIT_PER_CHILD_DAY', '80'));
    }

    public static function aiDebugEnvAllowed(): bool
    {
        return in_array(self::appEnv(), ['local', 'development', 'test'], true);
    }

    public static function aiDebugEnabled(): bool
    {
        if (!self::aiDebugEnvAllowed()) {
            return false;
        }

        return filter_var(self::get('APP_DEBUG_AI', 'false'), FILTER_VALIDATE_BOOL);
    }

    public static function shouldAttachDebugResponse(?string $debugHeader): bool
    {
        if (!self::aiDebugEnabled()) {
            return false;
        }

        return trim((string) $debugHeader) === '1';
    }

    public static function openRouterKeyPresent(): bool
    {
        return self::openRouterApiKey() !== '';
    }

    public static function fileLoggingEnabled(): bool
    {
        if (self::appEnv() === 'production') {
            return filter_var(self::get('LOG_TO_FILES', 'false'), FILTER_VALIDATE_BOOL);
        }

        return filter_var(self::get('LOG_TO_FILES', 'true'), FILTER_VALIDATE_BOOL);
    }

    public static function logDir(): string
    {
        $dir = self::get('LOG_DIR', '/var/www/html/logs');

        return $dir !== '' ? $dir : '/var/www/html/logs';
    }

    public static function logLevel(): string
    {
        $default = self::appEnv() === 'production' ? 'warning' : 'info';
        $raw = self::get('LOG_LEVEL', $default);

        return LogLevel::normalize($raw);
    }

    public static function clientLogIngestEnabled(): bool
    {
        if (!self::fileLoggingEnabled()) {
            return false;
        }

        if (self::appEnv() === 'production') {
            return filter_var(self::get('LOG_CLIENT_INGEST', 'false'), FILTER_VALIDATE_BOOL);
        }

        return filter_var(self::get('LOG_CLIENT_INGEST', 'true'), FILTER_VALIDATE_BOOL);
    }

    public static function clientLogLevel(): string
    {
        if (self::aiDebugEnabled()) {
            return LogLevel::DEBUG;
        }

        return self::logLevel();
    }

    public static function playHistoryPageSize(): int
    {
        $size = (int) self::get('PLAY_HISTORY_PAGE_SIZE', '24');

        return max(1, min(48, $size));
    }

    private static function get(string $key, string $default = ''): string
    {
        $value = getenv($key);
        if ($value === false || $value === '') {
            $fromEnv = $_ENV[$key] ?? $_SERVER[$key] ?? null;
            $value = is_string($fromEnv) ? $fromEnv : '';
        }

        return $value !== '' ? $value : $default;
    }
}
