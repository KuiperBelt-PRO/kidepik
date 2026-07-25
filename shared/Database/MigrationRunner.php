<?php

declare(strict_types=1);

namespace Kidepik\Shared\Database;

use Kidepik\Shared\Config;
use PDO;
use PDOException;
use Throwable;

/**
 * Aplica migraciones SQL desde supabase/migrations/ y registra en
 * supabase_migrations.schema_migrations (historial compartido con el CLI).
 */
final class MigrationRunner
{
    private const ADVISORY_LOCK_KEY = 42420107;

    private const FILE_PATTERN = '/^(\d{14})_([a-z0-9_]+)\.sql$/';

    /** @var string|null Clave rápida (ficheros + historial) cuando no hay pendientes. */
    private static ?string $ensuredStateKey = null;

    public function __construct(
        private readonly ?PDO $pdo,
        private readonly string $migrationsDir,
    ) {
    }

    public static function fromEnv(?string $repoRoot = null): self
    {
        $root = $repoRoot ?? dirname(__DIR__, 2);
        $dir = $root . DIRECTORY_SEPARATOR . 'supabase' . DIRECTORY_SEPARATOR . 'migrations';
        $url = Config::databaseUrl();
        $pdo = null;
        if ($url !== null) {
            try {
                $pdo = PdoFactory::sharedFromDatabaseUrl($url);
            } catch (PDOException) {
                $pdo = null;
            }
        }

        return new self($pdo, $dir);
    }

    /**
     * Aplica migraciones pendientes. No-op si no hay PDO.
     *
     * @throws MigrationException
     */
    public function ensureApplied(): void
    {
        if ($this->pdo === null) {
            return;
        }

        $stateKey = $this->migrationStateKey();
        if (self::$ensuredStateKey === $stateKey) {
            return;
        }

        $this->ensureHistoryTable();
        $this->pdo->exec('SELECT pg_advisory_lock(' . self::ADVISORY_LOCK_KEY . ')');

        try {
            $discovered = $this->discoverFiles();
            $appliedVersions = $this->appliedVersions();

            foreach ($discovered['valid'] as $migration) {
                if (isset($appliedVersions[$migration['version']])) {
                    continue;
                }
                $this->applyOne($migration);
            }
        } finally {
            try {
                $this->pdo->exec('SELECT pg_advisory_unlock(' . self::ADVISORY_LOCK_KEY . ')');
            } catch (Throwable) {
                // ignore unlock errors
            }
        }

        self::$ensuredStateKey = $this->migrationStateKey();
    }

    /** Solo tests: invalida la caché en memoria del worker PHP. */
    public static function resetEnsureCacheForTests(): void
    {
        self::$ensuredStateKey = null;
    }

    private function migrationsFingerprint(): string
    {
        if (!is_dir($this->migrationsDir)) {
            return '';
        }

        $files = glob($this->migrationsDir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        $parts = [];
        foreach ($files as $path) {
            $mtime = @filemtime($path);
            $parts[] = basename($path) . ':' . ($mtime !== false ? (string) $mtime : '0');
        }
        sort($parts);

        return hash('sha256', implode("\n", $parts));
    }

    private function migrationStateKey(): string
    {
        assert($this->pdo instanceof PDO);

        $fingerprint = $this->migrationsFingerprint();
        try {
            $stmt = $this->pdo->query(
                'SELECT count(*)::text, coalesce(max(version), \'\')
                 FROM supabase_migrations.schema_migrations',
            );
            $row = $stmt !== false ? $stmt->fetch(PDO::FETCH_NUM) : false;
            $count = is_array($row) ? (string) ($row[0] ?? '0') : '0';
            $maxVersion = is_array($row) ? (string) ($row[1] ?? '') : '';

            return $fingerprint . ':' . $count . ':' . $maxVersion;
        } catch (Throwable) {
            return $fingerprint . ':error';
        }
    }

    /**
     * Estado de migraciones (solo lectura; no aplica).
     *
     * @return array{
     *   ok: bool,
     *   directory: string,
     *   skipped?: bool,
     *   error?: string,
     *   applied: list<array{version: string, name: string, applied_at: ?string}>,
     *   pending: list<array{version: string, name: string, file: string}>,
     *   invalid_files: list<string>
     * }
     */
    public function status(): array
    {
        $relative = 'supabase/migrations';
        if (!is_dir($this->migrationsDir)) {
            return [
                'ok' => false,
                'directory' => $relative,
                'error' => 'migrations_dir_missing',
                'applied' => [],
                'pending' => [],
                'invalid_files' => [],
            ];
        }

        $discovered = $this->discoverFiles();

        if ($this->pdo === null) {
            $pending = array_map(
                static fn(array $m): array => [
                    'version' => $m['version'],
                    'name' => $m['name'],
                    'file' => $m['file'],
                ],
                $discovered['valid'],
            );

            return [
                'ok' => true,
                'directory' => $relative,
                'skipped' => true,
                'applied' => [],
                'pending' => $pending,
                'invalid_files' => $discovered['invalid'],
            ];
        }

        try {
            $this->ensureHistoryTable();
            $appliedMap = $this->appliedRows();
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'directory' => $relative,
                'error' => $e->getMessage(),
                'applied' => [],
                'pending' => [],
                'invalid_files' => $discovered['invalid'],
            ];
        }

        $pending = [];
        foreach ($discovered['valid'] as $migration) {
            if (!isset($appliedMap[$migration['version']])) {
                $pending[] = [
                    'version' => $migration['version'],
                    'name' => $migration['name'],
                    'file' => $migration['file'],
                ];
            }
        }

        return [
            'ok' => true,
            'directory' => $relative,
            'applied' => array_values($appliedMap),
            'pending' => $pending,
            'invalid_files' => $discovered['invalid'],
        ];
    }

    /**
     * @return array{valid: list<array{version: string, name: string, file: string, path: string}>, invalid: list<string>}
     */
    public function discoverFiles(): array
    {
        $valid = [];
        $invalid = [];

        if (!is_dir($this->migrationsDir)) {
            return ['valid' => [], 'invalid' => []];
        }

        $files = glob($this->migrationsDir . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        foreach ($files as $path) {
            $base = basename($path);
            if (!preg_match(self::FILE_PATTERN, $base, $matches)) {
                $invalid[] = $base;
                continue;
            }
            $valid[] = [
                'version' => $matches[1],
                'name' => $matches[2],
                'file' => $base,
                'path' => $path,
            ];
        }

        usort(
            $valid,
            static fn(array $a, array $b): int => strcmp($a['version'], $b['version']),
        );

        return ['valid' => $valid, 'invalid' => $invalid];
    }

    private function ensureHistoryTable(): void
    {
        assert($this->pdo instanceof PDO);

        $this->pdo->exec('CREATE SCHEMA IF NOT EXISTS supabase_migrations');
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
                version text PRIMARY KEY
            )',
        );
        $this->pdo->exec(
            'ALTER TABLE supabase_migrations.schema_migrations
             ADD COLUMN IF NOT EXISTS name text',
        );
        $this->pdo->exec(
            'ALTER TABLE supabase_migrations.schema_migrations
             ADD COLUMN IF NOT EXISTS applied_at timestamptz NOT NULL DEFAULT now()',
        );
    }

    /** @return array<string, true> */
    private function appliedVersions(): array
    {
        $rows = $this->appliedRows();
        $map = [];
        foreach ($rows as $version => $_row) {
            $map[$version] = true;
        }

        return $map;
    }

    /**
     * @return array<string, array{version: string, name: string, applied_at: ?string}>
     */
    private function appliedRows(): array
    {
        assert($this->pdo instanceof PDO);

        $stmt = $this->pdo->query(
            'SELECT version, name, applied_at
             FROM supabase_migrations.schema_migrations
             ORDER BY version ASC',
        );
        if ($stmt === false) {
            return [];
        }

        $map = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $version = (string) ($row['version'] ?? '');
            if ($version === '') {
                continue;
            }
            $appliedAt = $row['applied_at'] ?? null;
            $map[$version] = [
                'version' => $version,
                'name' => (string) ($row['name'] ?? ''),
                'applied_at' => $appliedAt !== null ? (string) $appliedAt : null,
            ];
        }

        return $map;
    }

    /** @param array{version: string, name: string, file: string, path: string} $migration */
    private function applyOne(array $migration): void
    {
        assert($this->pdo instanceof PDO);

        $sql = file_get_contents($migration['path']);
        if ($sql === false) {
            throw new MigrationException(
                'No se pudo leer la migración: ' . $migration['file'],
                $migration['version'],
            );
        }

        try {
            $this->pdo->beginTransaction();
            $this->pdo->exec($sql);

            $insert = $this->pdo->prepare(
                'INSERT INTO supabase_migrations.schema_migrations (version, name)
                 VALUES (:version, :name)
                 ON CONFLICT (version) DO NOTHING',
            );
            $insert->execute([
                'version' => $migration['version'],
                'name' => $migration['name'],
            ]);

            if ($this->pdo->inTransaction()) {
                $this->pdo->commit();
            }
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw new MigrationException(
                'Migration failed: ' . $migration['version'],
                $migration['version'],
                $e,
            );
        }
    }
}
