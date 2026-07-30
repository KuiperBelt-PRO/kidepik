#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Rellena datos de demostración en tripulantes locales (sin tocar el perfil tutor).
 * Uso: docker compose exec php php /var/www/api/bin/seed-crew-demo.php
 */

use Kidepik\Api\Services\CrewService;
use Kidepik\Api\Services\ParentAccountService;
use Kidepik\Shared\Config;
use Kidepik\Shared\Database\PdoFactory;

$repoRoot = dirname(__DIR__, 2);
require $repoRoot . '/api/vendor/autoload.php';

$envFile = $repoRoot . DIRECTORY_SEPARATOR . '.env.poc';
if (is_readable($envFile)) {
    Config::load($envFile);
} else {
    Config::load();
}

if (Config::appEnv() !== 'local') {
    fwrite(STDERR, "seed-crew-demo: solo disponible con APP_ENV=local\n");
    exit(1);
}

$url = Config::databaseUrl();
if ($url === null) {
    fwrite(STDERR, "seed-crew-demo: DATABASE_URL no configurada\n");
    exit(1);
}

$pdo = PdoFactory::sharedFromDatabaseUrl($url);
$parents = new ParentAccountService($pdo);
$crew = new CrewService($pdo, $parents);

/** @var list<array{display_name: string, world_theme: string|null, age_years: int|null, tutor_label: string|null, onboarding_step: string, placement_status: string, status: string}> */
$presets = [
    [
        'display_name' => 'Nora',
        'world_theme' => 'fantasy',
        'age_years' => 8,
        'tutor_label' => 'La mayor del grupo',
        'onboarding_step' => 'complete',
        'placement_status' => 'completed',
        'status' => 'active',
    ],
    [
        'display_name' => 'Leo',
        'world_theme' => 'sci-fi',
        'age_years' => 10,
        'tutor_label' => 'Le encantan los robots',
        'onboarding_step' => 'complete',
        'placement_status' => 'completed',
        'status' => 'active',
    ],
    [
        'display_name' => 'Marta',
        'world_theme' => 'fantasy',
        'age_years' => 7,
        'tutor_label' => 'Curiosa y valiente',
        'onboarding_step' => 'pending_entry',
        'placement_status' => 'not_started',
        'status' => 'active',
    ],
    [
        'display_name' => 'Kai',
        'world_theme' => null,
        'age_years' => null,
        'tutor_label' => 'En examen de acceso',
        'onboarding_step' => 'placement',
        'placement_status' => 'in_progress',
        'status' => 'active',
    ],
    [
        'display_name' => 'Sofía',
        'world_theme' => 'sci-fi',
        'age_years' => 9,
        'tutor_label' => 'Descanso temporal',
        'onboarding_step' => 'complete',
        'placement_status' => 'completed',
        'status' => 'paused',
    ],
    [
        'display_name' => 'Hugo',
        'world_theme' => 'fantasy',
        'age_years' => 6,
        'tutor_label' => 'El peque de la casa',
        'onboarding_step' => 'complete',
        'placement_status' => 'completed',
        'status' => 'active',
    ],
];

$parentRows = $pdo->query(
    'select id, auth_user_id from public.parent_accounts order by created_at asc',
)->fetchAll(PDO::FETCH_ASSOC);

if (!is_array($parentRows) || $parentRows === []) {
    fwrite(STDOUT, "seed-crew-demo: no hay cuentas tutor\n");
    exit(0);
}

$update = $pdo->prepare(
    "update public.children
     set display_name = :display_name,
         world_theme = :world_theme,
         age_years = :age_years,
         age_band = :age_band,
         status = :status,
         onboarding_step = :onboarding_step,
         placement_status = :placement_status,
         settings = CAST(:settings AS jsonb),
         updated_at = now()
     where id = :id",
);

$selectChildren = $pdo->prepare(
    "select id, settings
     from public.children
     where parent_id = :parent_id and status <> 'deleted' and is_tutor_profile = false
     order by created_at asc",
);

$total = 0;
foreach ($parentRows as $parentRow) {
    if (!is_array($parentRow) || !isset($parentRow['id'], $parentRow['auth_user_id'])) {
        continue;
    }
    $authUserId = (string) $parentRow['auth_user_id'];
    $parentId = (string) $parentRow['id'];
    $crew->ensureTutorProfileForAuthUser($authUserId);

    $selectChildren->execute(['parent_id' => $parentId]);
    $children = $selectChildren->fetchAll(PDO::FETCH_ASSOC);
    if (!is_array($children)) {
        continue;
    }

    foreach ($children as $index => $child) {
        if (!is_array($child) || !isset($child['id'])) {
            continue;
        }
        $preset = $presets[$index % count($presets)];
        $settings = [];
        if (isset($child['settings'])) {
            if (is_string($child['settings'])) {
                $decoded = json_decode($child['settings'], true);
                $settings = is_array($decoded) ? $decoded : [];
            } elseif (is_array($child['settings'])) {
                $settings = $child['settings'];
            }
        }
        if ($preset['tutor_label'] !== null) {
            $settings['tutor_label'] = $preset['tutor_label'];
        }
        $ageYears = $preset['age_years'];
        $ageBand = is_int($ageYears) ? ($ageYears <= 8 ? 'age_7' : 'age_9') : null;

        $update->execute([
            'id' => (string) $child['id'],
            'display_name' => $preset['display_name'],
            'world_theme' => $preset['world_theme'],
            'age_years' => $ageYears,
            'age_band' => $ageBand,
            'status' => $preset['status'],
            'onboarding_step' => $preset['onboarding_step'],
            'placement_status' => $preset['placement_status'],
            'settings' => json_encode($settings, JSON_THROW_ON_ERROR),
        ]);
        $total++;
    }
}

fwrite(STDOUT, "seed-crew-demo: OK — {$total} tripulante(s) actualizado(s)\n");
exit(0);
