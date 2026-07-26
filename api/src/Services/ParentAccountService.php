<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
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
        $row = $this->findByAuthUserId($authUserId);
        if ($row !== null) {
            return [
                'parent_id' => $row['parent_id'],
                'auth_user_id' => $authUserId,
                'email' => $email,
                'created' => false,
            ];
        }

        $pdo = $this->resolvePdo();
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

        $again = $this->findByAuthUserId($authUserId);
        if ($again === null) {
            throw new RuntimeException('Failed to bootstrap parent account');
        }

        return [
            'parent_id' => $again['parent_id'],
            'auth_user_id' => $authUserId,
            'email' => $email,
            'created' => false,
        ];
    }

    /**
     * @return array{
     *   parent_id: string,
     *   auth_user_id: string,
     *   email: string,
     *   display_name: string|null,
     *   avatar_url: string|null,
     *   provider: string
     * }
     */
    public function getOrBootstrap(
        string $authUserId,
        string $email,
        ?string $displayName = null,
        ?string $avatarUrl = null,
    ): array {
        $this->bootstrap($authUserId, $email, $displayName, $avatarUrl);
        $row = $this->findByAuthUserId($authUserId);
        if ($row === null) {
            throw new RuntimeException('Failed to load parent account');
        }

        return $row;
    }

    /**
     * @return array{
     *   parent_id: string,
     *   auth_user_id: string,
     *   email: string,
     *   display_name: string|null,
     *   avatar_url: string|null,
     *   provider: string
     * }
     */
    public function updateDisplayName(string $authUserId, ?string $displayName): array
    {
        $normalized = self::normalizeDisplayName($displayName);
        $pdo = $this->resolvePdo();

        $update = $pdo->prepare(
            'update public.parent_accounts
             set display_name = :display_name, updated_at = now()
             where auth_user_id = :auth_user_id',
        );
        $update->execute([
            'display_name' => $normalized,
            'auth_user_id' => $authUserId,
        ]);

        if ($update->rowCount() === 0) {
            throw new RuntimeException('Parent account not found');
        }

        $row = $this->findByAuthUserId($authUserId);
        if ($row === null) {
            throw new RuntimeException('Parent account not found');
        }

        return $row;
    }

    public function deleteAccount(string $authUserId): bool
    {
        $pdo = $this->resolvePdo();

        $deleteParent = $pdo->prepare(
            'delete from public.parent_accounts where auth_user_id = :auth_user_id',
        );
        $deleteParent->execute(['auth_user_id' => $authUserId]);

        // Cascada Auth: con DATABASE_URL de Postgres local/prod se elimina el usuario.
        // Si falla (sin permisos), el parent_accounts ya está borrado; el cliente hará signOut.
        try {
            $deleteAuth = $pdo->prepare('delete from auth.users where id = :auth_user_id');
            $deleteAuth->execute(['auth_user_id' => $authUserId]);
        } catch (PDOException) {
            // Sin acceso a auth.users: la fila de producto ya se eliminó.
        }

        return true;
    }

    /**
     * @return string|null nombre normalizado o null si vacío
     * @throws InvalidArgumentException
     */
    public static function normalizeDisplayName(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value)) {
            throw new InvalidArgumentException('display_name must be a string');
        }

        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (mb_strlen($trimmed) > 40) {
            throw new InvalidArgumentException('display_name too long');
        }

        // Letras Unicode, números, espacios, guion y apóstrofo.
        if (preg_match("/^[\\p{L}\\p{N} '\\-]+$/u", $trimmed) !== 1) {
            throw new InvalidArgumentException('display_name invalid characters');
        }

        return $trimmed;
    }

    /**
     * @return array{
     *   parent_id: string,
     *   auth_user_id: string,
     *   email: string,
     *   display_name: string|null,
     *   avatar_url: string|null,
     *   provider: string
     * }|null
     */
    public function findByAuthUserId(string $authUserId): ?array
    {
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            'select id, auth_user_id, email, display_name, avatar_url
             from public.parent_accounts
             where auth_user_id = :auth_user_id
             limit 1',
        );
        $stmt->execute(['auth_user_id' => $authUserId]);
        /** @var array{id?: string, auth_user_id?: string, email?: string, display_name?: string|null, avatar_url?: string|null}|false $row */
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row) || !isset($row['id'], $row['auth_user_id'], $row['email'])) {
            return null;
        }

        return [
            'parent_id' => (string) $row['id'],
            'auth_user_id' => (string) $row['auth_user_id'],
            'email' => (string) $row['email'],
            'display_name' => isset($row['display_name']) && is_string($row['display_name'])
                ? $row['display_name']
                : null,
            'avatar_url' => isset($row['avatar_url']) && is_string($row['avatar_url'])
                ? $row['avatar_url']
                : null,
            'provider' => 'google',
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
