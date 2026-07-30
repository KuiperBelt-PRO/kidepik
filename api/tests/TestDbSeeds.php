<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;
use PDO;

final class TestDbSeeds
{
    public static function restorePocHealth(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return;
        }

        PdoFactory::resetSharedForTests();
        $pdo = PdoFactory::fromDatabaseUrl($url);
        $pdo->exec(
            'create table if not exists public.poc_health (
                id int primary key default 1 check (id = 1),
                message text not null default \'ok\',
                updated_at timestamptz not null default now()
            )',
        );
        $pdo->exec(
            "insert into public.poc_health (id, message)
             values (1, 'poc ready')
             on conflict (id) do update set message = excluded.message, updated_at = now()",
        );
    }

    public static function restoreLegalDocumentsTable(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return;
        }

        PdoFactory::resetSharedForTests();
        $pdo = PdoFactory::fromDatabaseUrl($url);
        $migration = dirname(__DIR__, 2)
            . '/supabase/migrations/20260720163000_create_legal_documents.sql';
        if (is_readable($migration)) {
            $pdo->exec((string) file_get_contents($migration));
        }
        $seedV2 = dirname(__DIR__, 2)
            . '/supabase/migrations/20260725140000_seed_legal_documents_v2.sql';
        if (is_readable($seedV2)) {
            $pdo->exec((string) file_get_contents($seedV2));
        }
    }

    public static function restoreLegalPrivacySeed(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return;
        }

        PdoFactory::resetSharedForTests();
        $pdo = PdoFactory::fromDatabaseUrl($url);
        $pdo->prepare(
            "insert into public.legal_documents (slug, version, title, body_markdown)
             values ('privacy', 1, 'Privacidad', '# Privacidad')
             on conflict (slug, version) do update set
               title = excluded.title,
               body_markdown = excluded.body_markdown",
        )->execute();
    }
}
