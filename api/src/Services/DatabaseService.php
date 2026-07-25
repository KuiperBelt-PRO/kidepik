<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Database\PdoFactory;
use Kidepik\Shared\Config;
use PDO;
use PDOException;

final class DatabaseService
{
    public function pdo(): ?PDO
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return null;
        }

        try {
            return PdoFactory::sharedFromDatabaseUrl($url);
        } catch (PDOException) {
            return null;
        }
    }

    public function pocHealthMessage(): ?string
    {
        $pdo = $this->pdo();
        if ($pdo === null) {
            return null;
        }

        try {
            $stmt = $pdo->query('SELECT message FROM public.poc_health LIMIT 1');
            $row = $stmt !== false ? $stmt->fetch(PDO::FETCH_ASSOC) : false;

            return is_array($row) ? (string) ($row['message'] ?? '') : null;
        } catch (PDOException) {
            return null;
        }
    }

    public function isReachable(): bool
    {
        return $this->pdo() !== null;
    }

    /**
     * @return array{slug: string, version: int, title: string, body_markdown: string, published_at: string}|null
     */
    public function latestLegalDocument(string $slug): ?array
    {
        $pdo = $this->pdo();
        if ($pdo === null) {
            return null;
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT slug, version, title, body_markdown, published_at
                 FROM public.legal_documents
                 WHERE slug = :slug
                 ORDER BY version DESC
                 LIMIT 1',
            );
            $stmt->execute(['slug' => $slug]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($row)) {
                return null;
            }

            return [
                'slug' => (string) $row['slug'],
                'version' => (int) $row['version'],
                'title' => (string) $row['title'],
                'body_markdown' => (string) $row['body_markdown'],
                'published_at' => (string) $row['published_at'],
            ];
        } catch (PDOException) {
            return null;
        }
    }
}
