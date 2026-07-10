<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Kidepik\Shared\Config;

final class SupabaseAuthService
{
    private Client $http;

    public function __construct(?Client $http = null)
    {
        $this->http = $http ?? new Client(['timeout' => 5.0]);
    }

    /** @return array{sub: string, role: string, email?: string|null} */
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

        if ($response->getStatusCode() !== 200) {
            throw new AuthException('Invalid token: Supabase auth rejected');
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
        ];
    }
}
