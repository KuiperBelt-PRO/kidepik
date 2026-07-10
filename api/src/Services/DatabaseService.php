<?php

declare(strict_types=1);

namespace Kidepik\Api\Services;

use Kidepik\Shared\Config;
use PDO;
use PDOException;

final class DatabaseService
{
    public function pocHealthMessage(): ?string
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return null;
        }

        try {
            $pdo = new PDO($url);
            $stmt = $pdo->query("SELECT message FROM public.poc_health LIMIT 1");
            $row = $stmt !== false ? $stmt->fetch(PDO::FETCH_ASSOC) : false;

            return is_array($row) ? (string) ($row['message'] ?? '') : null;
        } catch (PDOException) {
            return null;
        }
    }

    public function isReachable(): bool
    {
        $url = Config::databaseUrl();
        if ($url === null) {
            return false;
        }

        try {
            new PDO($url);

            return true;
        } catch (PDOException) {
            return false;
        }
    }
}
