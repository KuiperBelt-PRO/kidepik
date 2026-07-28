<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use InvalidArgumentException;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

class CrewService
{
    public const MEMBER_LIMIT = 4;

    public function __construct(
        private readonly ?PDO $pdo = null,
        private readonly ?ParentAccountService $parents = null,
        private readonly ?ParentSettingsRepository $settingsRepo = null,
    ) {
    }

    /**
     * @return array{members: list<array<string, mixed>>, member_count: int, member_limit: int}
     */
    public function listForAuthUser(string $authUserId): array
    {
        $parentId = $this->requireParentId($authUserId);
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            "select c.id, c.display_name, c.age_years, c.age_band, c.world_theme, c.status,
                    c.onboarding_step, c.placement_status, c.settings, c.updated_at
             from public.children c
             where c.parent_id = :parent_id and c.status <> 'deleted'
             order by c.created_at asc",
        );
        $stmt->execute(['parent_id' => $parentId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $members = [];
        foreach ($rows as $row) {
            $members[] = $this->mapListItem($row);
        }

        return [
            'members' => $members,
            'member_count' => count($members),
            'member_limit' => self::MEMBER_LIMIT,
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function createForAuthUser(string $authUserId, array $payload = []): array
    {
        $parentId = $this->requireParentId($authUserId);
        $list = $this->listForAuthUser($authUserId);
        if ($list['member_count'] >= self::MEMBER_LIMIT) {
            throw new InvalidArgumentException('Crew member limit reached');
        }

        $tutorLabel = null;
        if (array_key_exists('tutor_label', $payload)) {
            $tutorLabel = $this->normalizeTutorLabel($payload['tutor_label']);
        }

        $settings = ['tutor_label' => $tutorLabel];
        $defaults = ($this->settingsRepo ?? new ParentSettingsRepository($this->pdo))
            ->getMergedSettingsForParentId($parentId);
        /** @var array<string, mixed> $crewDefaults */
        $crewDefaults = is_array($defaults['crew_defaults'] ?? null) ? $defaults['crew_defaults'] : [];

        $pdo = $this->resolvePdo();
        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare(
                'insert into public.children (parent_id, settings)
                 values (:parent_id, CAST(:settings AS jsonb))
                 returning id',
            );
            $insert->execute([
                'parent_id' => $parentId,
                'settings' => json_encode($settings, JSON_THROW_ON_ERROR),
            ]);
            $created = $insert->fetch(PDO::FETCH_ASSOC);
            if (!is_array($created) || !isset($created['id'])) {
                throw new RuntimeException('Failed to create crew member');
            }
            $childId = (string) $created['id'];

            $perm = $pdo->prepare(
                'insert into public.child_permissions (
                    child_id, allow_solo_start, require_exit_pin, session_limit_per_day,
                    max_session_minutes, can_choose_story_branch, lock_world_theme, font_scale_play
                 ) values (
                    :child_id,
                    CAST(:allow_solo_start AS boolean),
                    CAST(:require_exit_pin AS boolean),
                    :session_limit_per_day,
                    :max_session_minutes,
                    true,
                    CAST(:lock_world_theme AS boolean),
                    :font_scale_play
                 )',
            );
            $perm->execute([
                'child_id' => $childId,
                'allow_solo_start' => self::pgBool($crewDefaults['allow_solo_start'] ?? true),
                'require_exit_pin' => self::pgBool($crewDefaults['require_exit_pin'] ?? false),
                'session_limit_per_day' => $crewDefaults['session_limit_per_day'] ?? 3,
                'max_session_minutes' => $crewDefaults['max_session_minutes'] ?? 10,
                'lock_world_theme' => self::pgBool($crewDefaults['lock_world_theme'] ?? true),
                'font_scale_play' => $crewDefaults['font_scale_play'] ?? 'md',
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return $this->getForAuthUser($authUserId, $childId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getForAuthUser(string $authUserId, string $childId): array
    {
        $parentId = $this->requireParentId($authUserId);
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            "select c.*, p.allow_solo_start, p.require_exit_pin, p.exit_pin_hash,
                    p.session_limit_per_day, p.max_session_minutes, p.allowed_hours,
                    p.can_choose_story_branch, p.lock_world_theme, p.font_scale_play,
                    p.learning_overrides
             from public.children c
             join public.child_permissions p on p.child_id = c.id
             where c.id = :id and c.parent_id = :parent_id and c.status <> 'deleted'
             limit 1",
        );
        $stmt->execute(['id' => $childId, 'parent_id' => $parentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new RuntimeException('Crew member not found');
        }

        return $this->mapDetail($row);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updateProfileForAuthUser(string $authUserId, string $childId, array $payload): array
    {
        $detail = $this->getForAuthUser($authUserId, $childId);
        $pdo = $this->resolvePdo();

        $fields = [];
        $params = ['id' => $childId];

        if (array_key_exists('display_name', $payload)) {
            $fields[] = 'display_name = :display_name';
            $params['display_name'] = $this->normalizeDisplayName($payload['display_name']);
        }
        if (array_key_exists('age_years', $payload)) {
            $age = $payload['age_years'];
            if ($age !== null && (!is_int($age) || $age < 5 || $age > 14)) {
                throw new InvalidArgumentException('age_years invalid');
            }
            $fields[] = 'age_years = :age_years';
            $params['age_years'] = $age;
            if (is_int($age)) {
                $fields[] = 'age_band = :age_band';
                $params['age_band'] = $age <= 8 ? 'age_7' : 'age_9';
            }
        }
        if (array_key_exists('status', $payload)) {
            $status = $payload['status'];
            if (!in_array($status, ['active', 'paused'], true)) {
                throw new InvalidArgumentException('status invalid');
            }
            $fields[] = 'status = :status';
            $params['status'] = $status;
        }
        if (array_key_exists('world_theme', $payload)) {
            $theme = $payload['world_theme'];
            if ($theme !== null && !in_array($theme, ['fantasy', 'sci-fi'], true)) {
                throw new InvalidArgumentException('world_theme invalid');
            }
            $locked = (bool) ($detail['permissions']['lock_world_theme'] ?? true);
            $unlock = ($payload['unlock_world'] ?? false) === true;
            if ($locked && !$unlock && $theme !== ($detail['world_theme'] ?? null)) {
                throw new InvalidArgumentException('world_theme locked');
            }
            $fields[] = 'world_theme = :world_theme';
            $params['world_theme'] = $theme;
        }
        if (array_key_exists('tutor_label', $payload)) {
            $settings = is_array($detail['settings'] ?? null) ? $detail['settings'] : [];
            $settings['tutor_label'] = $this->normalizeTutorLabel($payload['tutor_label']);
            $fields[] = 'settings = CAST(:settings AS jsonb)';
            $params['settings'] = json_encode($settings, JSON_THROW_ON_ERROR);
        }

        if ($fields === []) {
            throw new InvalidArgumentException('No updatable fields');
        }

        $fields[] = 'updated_at = now()';
        $sql = 'update public.children set ' . implode(', ', $fields)
            . ' where id = :id and status <> \'deleted\'';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $this->getForAuthUser($authUserId, $childId);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function updatePermissionsForAuthUser(string $authUserId, string $childId, array $payload): array
    {
        $this->getForAuthUser($authUserId, $childId);
        $pdo = $this->resolvePdo();

        $fields = [];
        $params = ['child_id' => $childId];

        foreach (
            [
                'allow_solo_start' => 'bool',
                'require_exit_pin' => 'bool',
                'can_choose_story_branch' => 'bool',
                'lock_world_theme' => 'bool',
            ] as $key => $_type
        ) {
            if (array_key_exists($key, $payload)) {
                if (!is_bool($payload[$key])) {
                    throw new InvalidArgumentException($key . ' invalid');
                }
                $fields[] = $key . ' = CAST(:' . $key . ' AS boolean)';
                $params[$key] = self::pgBool($payload[$key]);
            }
        }

        if (array_key_exists('session_limit_per_day', $payload)) {
            $limit = $payload['session_limit_per_day'];
            if ($limit !== null && (!is_int($limit) || $limit < 1 || $limit > 12)) {
                throw new InvalidArgumentException('session_limit_per_day invalid');
            }
            $fields[] = 'session_limit_per_day = :session_limit_per_day';
            $params['session_limit_per_day'] = $limit;
        }

        if (array_key_exists('max_session_minutes', $payload)) {
            $mins = $payload['max_session_minutes'];
            if (!is_numeric($mins)) {
                throw new InvalidArgumentException('max_session_minutes invalid');
            }
            $mins = (int) $mins;
            if ($mins < 5 || $mins > 120 || $mins % 5 !== 0) {
                throw new InvalidArgumentException('max_session_minutes invalid');
            }
            $fields[] = 'max_session_minutes = :max_session_minutes';
            $params['max_session_minutes'] = $mins;
        }

        if (array_key_exists('font_scale_play', $payload)) {
            $scale = $payload['font_scale_play'];
            if (!in_array($scale, ['md', 'lg', 'xl'], true)) {
                throw new InvalidArgumentException('font_scale_play invalid');
            }
            $fields[] = 'font_scale_play = :font_scale_play';
            $params['font_scale_play'] = $scale;
        }

        if (array_key_exists('exit_pin', $payload)) {
            $pin = $payload['exit_pin'];
            if ($pin === null) {
                $fields[] = 'exit_pin_hash = null';
            } elseif (!is_string($pin) || preg_match('/^\d{4}$/', $pin) !== 1) {
                throw new InvalidArgumentException('exit_pin invalid');
            } else {
                $fields[] = 'exit_pin_hash = :exit_pin_hash';
                $params['exit_pin_hash'] = password_hash($pin, PASSWORD_DEFAULT);
            }
        }

        if ($fields === []) {
            throw new InvalidArgumentException('No updatable fields');
        }

        $fields[] = 'updated_at = now()';
        $sql = 'update public.child_permissions set ' . implode(', ', $fields)
            . ' where child_id = :child_id';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        return $this->getForAuthUser($authUserId, $childId);
    }

    /**
     * @return array{deleted: bool}
     */
    public function softDeleteForAuthUser(string $authUserId, string $childId, bool $confirm): array
    {
        if (!$confirm) {
            throw new InvalidArgumentException('confirm required');
        }
        $this->getForAuthUser($authUserId, $childId);
        $pdo = $this->resolvePdo();
        $stmt = $pdo->prepare(
            "update public.children
             set status = 'deleted', deleted_at = now(), updated_at = now()
             where id = :id",
        );
        $stmt->execute(['id' => $childId]);

        return ['deleted' => true];
    }

    private function requireParentId(string $authUserId): string
    {
        $parents = $this->parents ?? new ParentAccountService($this->pdo);
        $row = $parents->findByAuthUserId($authUserId);
        if ($row === null) {
            throw new RuntimeException('Parent account not found');
        }

        return $row['parent_id'];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapListItem(array $row): array
    {
        $settings = $this->decodeJson($row['settings'] ?? null);

        return [
            'id' => (string) $row['id'],
            'display_name' => $this->nullableString($row['display_name'] ?? null),
            'age_years' => isset($row['age_years']) ? (int) $row['age_years'] : null,
            'age_band' => $this->nullableString($row['age_band'] ?? null),
            'world_theme' => $this->nullableString($row['world_theme'] ?? null),
            'status' => (string) $row['status'],
            'onboarding_step' => (string) $row['onboarding_step'],
            'placement_status' => (string) $row['placement_status'],
            'tutor_label' => is_array($settings) ? $this->nullableString($settings['tutor_label'] ?? null) : null,
            'updated_at' => isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapDetail(array $row): array
    {
        $settings = $this->decodeJson($row['settings'] ?? null) ?? [];
        $learning = $this->decodeJson($row['learning_overrides'] ?? null) ?? [];
        $hours = $this->decodeJson($row['allowed_hours'] ?? null);

        return [
            'id' => (string) $row['id'],
            'display_name' => $this->nullableString($row['display_name'] ?? null),
            'age_years' => isset($row['age_years']) ? (int) $row['age_years'] : null,
            'age_band' => $this->nullableString($row['age_band'] ?? null),
            'effective_age_band' => $this->nullableString($row['effective_age_band'] ?? null),
            'birth_year' => isset($row['birth_year']) ? (int) $row['birth_year'] : null,
            'world_theme' => $this->nullableString($row['world_theme'] ?? null),
            'locale' => (string) ($row['locale'] ?? 'es-ES'),
            'status' => (string) $row['status'],
            'onboarding_step' => (string) $row['onboarding_step'],
            'placement_status' => (string) $row['placement_status'],
            'settings' => $settings,
            'permissions' => [
                'allow_solo_start' => $this->toBool($row['allow_solo_start'] ?? true),
                'require_exit_pin' => $this->toBool($row['require_exit_pin'] ?? false),
                'exit_pin_set' => isset($row['exit_pin_hash']) && is_string($row['exit_pin_hash']) && $row['exit_pin_hash'] !== '',
                'session_limit_per_day' => isset($row['session_limit_per_day']) ? (int) $row['session_limit_per_day'] : null,
                'max_session_minutes' => (int) ($row['max_session_minutes'] ?? 10),
                'allowed_hours' => $hours,
                'can_choose_story_branch' => $this->toBool($row['can_choose_story_branch'] ?? true),
                'lock_world_theme' => $this->toBool($row['lock_world_theme'] ?? true),
                'font_scale_play' => (string) ($row['font_scale_play'] ?? 'md'),
                'learning_overrides' => $learning,
            ],
            'traits' => [],
            'created_at' => isset($row['created_at']) ? (string) $row['created_at'] : null,
            'updated_at' => isset($row['updated_at']) ? (string) $row['updated_at'] : null,
        ];
    }

    private function normalizeTutorLabel(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value)) {
            throw new InvalidArgumentException('tutor_label invalid');
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        if (mb_strlen($trimmed) > 40) {
            throw new InvalidArgumentException('tutor_label too long');
        }

        return $trimmed;
    }

    private function normalizeDisplayName(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value)) {
            throw new InvalidArgumentException('display_name invalid');
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }
        if (mb_strlen($trimmed) > 24) {
            throw new InvalidArgumentException('display_name too long');
        }
        if (preg_match("/^[\\p{L}\\p{N} '\\-]+$/u", $trimmed) !== 1) {
            throw new InvalidArgumentException('display_name invalid characters');
        }

        return $trimmed;
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if ($value === 't' || $value === 'true' || $value === '1' || $value === 1) {
            return true;
        }

        return false;
    }

    /** PDO pgsql serializa false como "" — usar literales SQL. */
    private static function pgBool(mixed $value): string
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN) ? 'true' : 'false';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJson(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || $value === '') {
            return null;
        }
        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
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
