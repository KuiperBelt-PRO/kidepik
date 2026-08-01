<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Kidepik\Shared\Config;

class SupabaseAuthService
{
    private Client $http;

    public function __construct(?Client $http = null)
    {
        $this->http = $http ?? new Client([
            'timeout' => 5.0,
            // Distinguish HTTP 401 from transport errors (Guzzle throws on 4xx by default).
            'http_errors' => false,
        ]);
    }

    /** @return array{sub: string, role: string, email?: string|null, display_name?: string|null, avatar_url?: string|null} */
    public function validateBearer(?string $authorizationHeader): array
    {
        if ($authorizationHeader === null || !str_starts_with(strtolower($authorizationHeader), 'bearer ')) {
            throw new AuthException('Missing Bearer token');
        }

        $token = trim(substr($authorizationHeader, 7));
        if ($token === '') {
            throw new AuthException('Missing Bearer token');
        }

        try {
            $response = $this->http->get(Config::supabaseUrl() . '/auth/v1/user', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'apikey' => Config::supabaseAnonKey(),
                ],
            ]);
        } catch (GuzzleException $e) {
            throw new AuthException('Invalid token: Supabase auth unreachable', 0, $e);
        }

        $status = $response->getStatusCode();
        if ($status === 401 || $status === 403) {
            throw new AuthException('Invalid token: Supabase auth rejected');
        }
        if ($status !== 200) {
            throw new AuthException('Invalid token: Supabase auth unreachable');
        }

        /** @var array<string, mixed> $user */
        $user = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $userId = $user['id'] ?? null;
        if (!is_string($userId) || $userId === '') {
            throw new AuthException('Invalid token: missing user id');
        }

        return [
            'sub' => $userId,
            'role' => 'authenticated',
            'email' => isset($user['email']) ? (string) $user['email'] : null,
            'display_name' => self::extractDisplayName($user),
            'avatar_url' => self::extractAvatarUrl($user),
        ];
    }

    /** @param array<string, mixed> $user */
    private static function extractDisplayName(array $user): ?string
    {
        $meta = $user['user_metadata'] ?? null;
        if (!is_array($meta)) {
            return null;
        }

        foreach (['full_name', 'name'] as $key) {
            if (isset($meta[$key]) && is_string($meta[$key]) && $meta[$key] !== '') {
                return $meta[$key];
            }
        }

        return null;
    }

    /** @param array<string, mixed> $user */
    private static function extractAvatarUrl(array $user): ?string
    {
        $meta = $user['user_metadata'] ?? null;
        if (!is_array($meta)) {
            return null;
        }

        foreach (['avatar_url', 'picture'] as $key) {
            if (isset($meta[$key]) && is_string($meta[$key]) && $meta[$key] !== '') {
                return $meta[$key];
            }
        }

        return null;
    }
}
