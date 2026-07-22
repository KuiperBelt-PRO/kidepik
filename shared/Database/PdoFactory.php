<?php

declare(strict_types=1);

namespace Kidepik\Shared\Database;

use PDO;
use PDOException;

final class PdoFactory
{
    public static function fromDatabaseUrl(string $url): PDO
    {
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['host'], $parts['path'])) {
            throw new PDOException('DATABASE_URL inválida.');
        }

        $dbName = ltrim((string) $parts['path'], '/');
        if ($dbName === '') {
            throw new PDOException('DATABASE_URL sin nombre de base de datos.');
        }

        $host = (string) $parts['host'];
        $port = isset($parts['port']) ? (int) $parts['port'] : 5432;
        $user = isset($parts['user']) ? rawurldecode((string) $parts['user']) : null;
        $pass = isset($parts['pass']) ? rawurldecode((string) $parts['pass']) : null;

        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $host, $port, $dbName);

        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
}
