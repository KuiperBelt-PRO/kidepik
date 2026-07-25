<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;
use RuntimeException;

class ParentAccountService
{
    public function __construct(private readonly ?PDO $pdo = null)
    {
    }

    /**
     * Crea la fila padre si no existe (idempotente).
     *
     * @return array{parent_id: string, auth_user_id: string, email: string, created: bool}
     */
    public function bootstrap(
        string $authUserId,
        string $email,
        ?string $displayName = null,
        ?string $avatarUrl = null,
    ): array {
        $pdo = $this->resolvePdo();

        $existing = $pdo->prepare(
            'select id from public.parent_accounts where auth_user_id = :auth_user_id limit 1',
        );
        $existing->execute(['auth_user_id' => $authUserId]);
        /** @var array{id?: string}|false $row */
        $row = $existing->fetch(PDO::FETCH_ASSOC);
        if (is_array($row) && isset($row['id'])) {
            return [
                'parent_id' => (string) $row['id'],
                'auth_user_id' => $authUserId,
                'email' => $email,
                'created' => false,
            ];
        }

        $insert = $pdo->prepare(
            'insert into public.parent_accounts (auth_user_id, email, display_name, avatar_url)
             values (:auth_user_id, :email, :display_name, :avatar_url)
             on conflict (auth_user_id) do nothing
             returning id',
        );
        $insert->execute([
            'auth_user_id' => $authUserId,
            'email' => $email,
            'display_name' => $displayName,
            'avatar_url' => $avatarUrl,
        ]);
        /** @var array{id?: string}|false $inserted */
        $inserted = $insert->fetch(PDO::FETCH_ASSOC);
        if (is_array($inserted) && isset($inserted['id'])) {
            return [
                'parent_id' => (string) $inserted['id'],
                'auth_user_id' => $authUserId,
                'email' => $email,
                'created' => true,
            ];
        }

        $again = $pdo->prepare(
            'select id from public.parent_accounts where auth_user_id = :auth_user_id limit 1',
        );
        $again->execute(['auth_user_id' => $authUserId]);
        /** @var array{id?: string}|false $race */
        $race = $again->fetch(PDO::FETCH_ASSOC);
        if (!is_array($race) || !isset($race['id'])) {
            throw new RuntimeException('Failed to bootstrap parent account');
        }

        return [
            'parent_id' => (string) $race['id'],
            'auth_user_id' => $authUserId,
            'email' => $email,
            'created' => false,
        ];
    }

    private function resolvePdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $url = Config::databaseUrl();
        if ($url === null) {
            throw new RuntimeException('DATABASE_URL not configured');
        }

        try {
            return PdoFactory::sharedFromDatabaseUrl($url);
        } catch (PDOException $e) {
            throw new RuntimeException('Database unavailable', 0, $e);
        }
    }
}
