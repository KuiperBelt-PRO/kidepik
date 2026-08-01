<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;
use RuntimeException;

/**
 * Persistencia de parent_accounts.settings.
 */
class ParentSettingsRepository
{
    public function __construct(
        private readonly ?PDO $pdo = null,
        private readonly ?ParentAccountService $parents = null,
    ) {
    }

    /**
     * @return array{settings: array<string, mixed>, crew_summary: array{member_count: int}}
     */
    public function getForAuthUser(
        string $authUserId,
        string $email,
        ?string $displayName = null,
        ?string $avatarUrl = null,
    ): array {
        $parents = $this->parents ?? new ParentAccountService($this->pdo);
        $account = $parents->getOrBootstrap($authUserId, $email, $displayName, $avatarUrl);
        $raw = $this->fetchSettingsJson($account['parent_id']);
        $settings = ParentSettingsService::mergeWithDefaults($raw);

        return [
            'settings' => $settings,
            'crew_summary' => [
                'member_count' => $this->countActiveChildren($account['parent_id']),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $patch
     * @return array{settings: array<string, mixed>, crew_summary: array{member_count: int}}
     */
    public function patchForAuthUser(
        string $authUserId,
        string $email,
        array $patch,
        ?string $displayName = null,
        ?string $avatarUrl = null,
    ): array {
        $parents = $this->parents ?? new ParentAccountService($this->pdo);
        $account = $parents->getOrBootstrap($authUserId, $email, $displayName, $avatarUrl);
        $current = ParentSettingsService::mergeWithDefaults($this->fetchSettingsJson($account['parent_id']));
        $next = ParentSettingsService::applyPatch($current, $patch);
        $this->saveSettingsJson($account['parent_id'], $next);

        return [
            'settings' => $next,
            'crew_summary' => [
                'member_count' => $this->countActiveChildren($account['parent_id']),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getMergedSettingsForParentId(string $parentId): array
    {
        return ParentSettingsService::mergeWithDefaults($this->fetchSettingsJson($parentId));
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fetchSettingsJson(string $parentId): ?array
    {
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            'select settings from public.parent_accounts where id = :id limit 1',
        );
        $stmt->execute(['id' => $parentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }
        $settings = $row['settings'] ?? null;
        if (is_string($settings)) {
            $decoded = json_decode($settings, true);

            return is_array($decoded) ? $decoded : null;
        }
        if (is_array($settings)) {
            return $settings;
        }

        return null;
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function saveSettingsJson(string $parentId, array $settings): void
    {
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            'update public.parent_accounts
             set settings = CAST(:settings AS jsonb), updated_at = now()
             where id = :id',
        );
        $stmt->execute([
            'settings' => json_encode($settings, JSON_THROW_ON_ERROR),
            'id' => $parentId,
        ]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Parent account not found');
        }
    }

    private function countActiveChildren(string $parentId): int
    {
        $pdo = $this->resolvePdo();
        try {
            $stmt = $pdo->prepare(
                "select count(*)::int as c from public.children
                 where parent_id = :parent_id and status <> 'deleted'
                   and coalesce(is_tutor_profile, false) = false",
            );
            $stmt->execute(['parent_id' => $parentId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                return 0;
            }

            return (int) ($row['c'] ?? 0);
        } catch (PDOException) {
            return 0;
        }
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
