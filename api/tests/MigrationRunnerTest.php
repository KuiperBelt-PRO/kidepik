<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PDO;
use PHPUnit\Framework\TestCase;

final class MigrationRunnerTest extends TestCase
{
    public function testDiscoverFilesIgnoresInvalidNames(): void
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik_mig_' . bin2hex(random_bytes(4));
        mkdir($dir);
        try {
            file_put_contents($dir . '/20260720120000_ok_one.sql', '-- ok');
            file_put_contents($dir . '/bad_name.sql', '-- bad');
            file_put_contents($dir . '/20260720120001_ok_two.sql', '-- ok');

            $runner = new MigrationRunner(null, $dir);
            $discovered = $runner->discoverFiles();

            self::assertCount(2, $discovered['valid']);
            self::assertSame('20260720120000', $discovered['valid'][0]['version']);
            self::assertSame('ok_one', $discovered['valid'][0]['name']);
            self::assertSame(['bad_name.sql'], $discovered['invalid']);
        } finally {
            foreach (glob($dir . '/*') ?: [] as $f) {
                unlink($f);
            }
            rmdir($dir);
        }
    }

    public function testStatusWithoutPdoReportsSkippedAndPending(): void
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik_mig_' . bin2hex(random_bytes(4));
        mkdir($dir);
        try {
            file_put_contents($dir . '/20260720130000_demo.sql', 'select 1;');
            $runner = new MigrationRunner(null, $dir);
            $status = $runner->status();

            self::assertTrue($status['ok']);
            self::assertTrue($status['skipped'] ?? false);
            self::assertCount(1, $status['pending']);
            self::assertSame('demo', $status['pending'][0]['name']);
        } finally {
            foreach (glob($dir . '/*') ?: [] as $f) {
                unlink($f);
            }
            rmdir($dir);
        }
    }

    public function testEnsureAppliedIsIdempotentAgainstRealDatabase(): void
    {
        $pdo = $this->pdoOrSkip();
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kidepik_mig_' . bin2hex(random_bytes(4));
        mkdir($dir);
        $table = 'mig_probe_' . bin2hex(random_bytes(3));
        $version = '20990101000000';
        $sql = "create table if not exists public.{$table} (id int primary key);";
        file_put_contents($dir . "/{$version}_probe_table.sql", $sql);

        try {
            $runner = new MigrationRunner($pdo, $dir);
            $runner->ensureApplied();
            $runner->ensureApplied();

            $status = $runner->status();
            self::assertSame([], $status['pending']);
            $versions = array_column($status['applied'], 'version');
            self::assertContains($version, $versions);

            $exists = $pdo->query("select to_regclass('public.{$table}')")->fetchColumn();
            self::assertNotFalse($exists);
            self::assertNotNull($exists);
        } finally {
            $pdo->exec("drop table if exists public.{$table}");
            $pdo->exec(
                "delete from supabase_migrations.schema_migrations where version = " . $pdo->quote($version),
            );
            foreach (glob($dir . '/*') ?: [] as $f) {
                unlink($f);
            }
            rmdir($dir);
        }
    }

    private function pdoOrSkip(): PDO
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        try {
            return PdoFactory::fromDatabaseUrl($url);
        } catch (\PDOException $e) {
            self::markTestSkipped('Postgres no alcanzable: ' . $e->getMessage());
        }
    }
}
