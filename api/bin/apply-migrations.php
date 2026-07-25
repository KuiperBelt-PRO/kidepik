#!/usr/bin/env php
<?php

declare(strict_types=1);

use Kidepik\Shared\Config;
use Kidepik\Shared\Database\MigrationException;
use Kidepik\Shared\Database\MigrationRunner;

$repoRoot = dirname(__DIR__, 2);
require $repoRoot . '/api/vendor/autoload.php';

$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

if (Config::databaseUrl() === null) {
    fwrite(STDERR, "apply-migrations: DATABASE_URL no configurada; omitido.\n");
    exit(0);
}

try {
    MigrationRunner::fromEnv($repoRoot)->ensureApplied();
    fwrite(STDOUT, "apply-migrations: OK\n");
    exit(0);
} catch (MigrationException $e) {
    fwrite(STDERR, 'apply-migrations: FAIL — ' . $e->getMessage() . "\n");
    if ($e->getPrevious() !== null) {
        fwrite(STDERR, $e->getPrevious()->getMessage() . "\n");
    }
    exit(1);
}
