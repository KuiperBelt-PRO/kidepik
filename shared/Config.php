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
