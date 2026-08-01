#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Sincroniza modelos free descubiertos en colas BD (manual o entrypoint).
 */

use Kidepik\Shared\Config;
use Kidepik\Shared\Ai\FreeModelQueueSync;

$repoRoot = dirname(__DIR__, 2);
$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

$force = in_array('--force', $argv ?? [], true);
$sync = new FreeModelQueueSync();

if ($force) {
    $stats = $sync->sync();
    echo json_encode($stats, JSON_PRETTY_PRINT) . "\n";
    exit(0);
}

$ran = $sync->syncIfStale();
echo $ran ? "sync completed\n" : "sync skipped (not stale or disabled)\n";
