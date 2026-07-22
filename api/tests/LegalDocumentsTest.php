<?php

declare(strict_types=1);

namespace Kidepik\Api\Tests;

use Kidepik\Api\Router;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationRunner;
use Kidepik\Shared\Database\PdoFactory;
use PHPUnit\Framework\TestCase;

final class LegalDocumentsTest extends TestCase
{
    protected function setUp(): void
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            self::markTestSkipped('DATABASE_URL no configurada');
        }

        try {
            $pdo = PdoFactory::fromDatabaseUrl($url);
        } catch (\PDOException $e) {
            self::markTestSkipped('Postgres no alcanzable: ' . $e->getMessage());
        }

        $repoRoot = dirname(__DIR__, 2);
        MigrationRunner::fromEnv($repoRoot)->ensureApplied();
        unset($pdo);
    }

    public function testMigrationsStatusEndpoint(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/migrations/status');
        self::assertSame(200, $response->status);
        /** @var array<string, mixed> $body */
        $body = json_decode($response->body, true);
        self::assertTrue($body['ok']);
        self::assertIsArray($body['applied']);
        self::assertIsArray($body['pending']);
        self::assertSame([], $body['pending']);

        $names = array_column($body['applied'], 'name');
        self::assertContains('create_legal_documents', $names);
    }

    public function testLegalTermsAndPrivacyLatest(): void
    {
        foreach (['terms', 'terminos', 'privacy', 'privacidad'] as $slug) {
            $response = (new Router())->dispatch('GET', '/api/v1/legal/' . $slug);
            self::assertSame(200, $response->status, $slug);
            /** @var array<string, mixed> $body */
            $body = json_decode($response->body, true);
            self::assertArrayHasKey('body_markdown', $body);
            self::assertArrayHasKey('title', $body);
            self::assertGreaterThanOrEqual(1, (int) $body['version']);
            self::assertStringContainsString('#', (string) $body['body_markdown']);
        }
    }

    public function testUnknownLegalSlugReturns404(): void
    {
        $response = (new Router())->dispatch('GET', '/api/v1/legal/cookies');
        self::assertSame(404, $response->status);
    }

    public function testLatestVersionWins(): void
    {
        $pdo = PdoFactory::fromDatabaseUrl((string) Config::databaseUrl());
        $pdo->exec(
            "insert into public.legal_documents (slug, version, title, body_markdown)
             values ('terms', 999, 'Términos v999', '# Solo test v999')
             on conflict (slug, version) do update set
               title = excluded.title,
               body_markdown = excluded.body_markdown",
        );

        try {
            $response = (new Router())->dispatch('GET', '/api/v1/legal/terms');
            self::assertSame(200, $response->status);
            /** @var array<string, mixed> $body */
            $body = json_decode($response->body, true);
            self::assertSame(999, (int) $body['version']);
            self::assertStringContainsString('v999', (string) $body['body_markdown']);
        } finally {
            $pdo->exec("delete from public.legal_documents where slug = 'terms' and version = 999");
        }
    }
}
