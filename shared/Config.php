<?php

declare(strict_types=1);

namespace Kidepik\Shared;

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
        return filter_var(self::get('AI_MOCK', 'false'), FILTER_VALIDATE_BOOL);
    }

    public static function aiAllowPaid(): bool
    {
        return filter_var(self::get('AI_ALLOW_PAID', 'false'), FILTER_VALIDATE_BOOL);
    }

    public static function openRouterApiKey(): string
    {
        return self::get('OPENROUTER_API_KEY', '');
    }

    public static function openRouterBaseUrl(): string
    {
        return rtrim(self::get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'), '/');
    }

    /** @return list<string> */
    public static function aiModelPreference(): array
    {
        $raw = self::get('AI_MODEL_PREFERENCE', '');
        if ($raw === '') {
            $raw = self::get('OPENROUTER_MODELS', '');
        }
        if ($raw === '') {
            $raw = 'google/gemma-3-27b-it:free,meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-30b-a3b:free';
        }

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
        return max(1, (int) self::get('AI_MAX_MODEL_ATTEMPTS', '8'));
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
