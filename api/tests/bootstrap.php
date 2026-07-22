<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use Kidepik\Shared\Config;

$repoRoot = dirname(__DIR__, 2);
$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}
