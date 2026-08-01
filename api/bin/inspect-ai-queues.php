<?php
declare(strict_types=1);

require '/var/www/api/vendor/autoload.php';
\Kidepik\Shared\Config::load('/var/www/.env.poc');

$pdo = \Kidepik\Shared\Database\PdoFactory::fromConfig();
if (!$pdo) {
    fwrite(STDERR, "no pdo\n");
    exit(1);
}

$migration = '/var/www/supabase/migrations/20260801002000_expand_free_model_queues.sql';
if (is_readable($migration)) {
    $sql = file_get_contents($migration);
    if (is_string($sql) && trim($sql) !== '') {
        $pdo->exec($sql);
        echo "migration applied\n";
    }
}

$stmt = $pdo->query(
    "select purpose, model_id, position, enabled
     from ai_purpose_model_queues
     order by purpose, position"
);
$rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
echo "queue_rows=" . count($rows) . "\n";
foreach ($rows as $r) {
    echo sprintf(
        "%s\t%s\t%d\t%s\n",
        $r['purpose'],
        $r['model_id'],
        (int) $r['position'],
        !empty($r['enabled']) ? 'on' : 'off'
    );
}

$cd = $pdo->query(
    "select purpose, model_id, error_class, http_status, failure_count, expires_at
     from ai_model_cooldowns
     where expires_at > now()
     order by expires_at asc
     limit 30"
);
echo "--- ai_model_cooldowns (active) ---\n";
if ($cd) {
    while ($row = $cd->fetch(PDO::FETCH_ASSOC)) {
        echo sprintf(
            "%s\t%s\t%s\t%s\t%d\t%s\n",
            $row['purpose'],
            $row['model_id'],
            $row['error_class'],
            $row['http_status'] ?? '-',
            (int) $row['failure_count'],
            $row['expires_at'],
        );
    }
}

$usage = $pdo->query(
    "select purpose, model, count(*) as n, max(created_at) as last_at
     from api_usage
     where created_at > now() - interval '2 days'
     group by 1,2
     order by last_at desc nulls last
     limit 30"
);
if ($usage) {
    echo "--- api_usage last 2d ---\n";
    foreach ($usage->fetchAll(PDO::FETCH_ASSOC) as $u) {
        echo sprintf(
            "%s\t%s\t%s\t%s\n",
            $u['purpose'] ?? '',
            $u['model'] ?? '',
            $u['n'] ?? '',
            $u['last_at'] ?? ''
        );
    }
}

$attempts = $pdo->query(
    "select purpose, model_id, ok, http_status, error_class, error_brief, latency_ms, created_at
     from ai_call_attempts
     where purpose = 'placement_exam_composer'
     order by created_at desc
     limit 20"
);
if ($attempts) {
    echo "--- ai_call_attempts placement_exam_composer ---\n";
    foreach ($attempts->fetchAll(PDO::FETCH_ASSOC) as $a) {
        echo sprintf(
            "%s\t%s\t%s\t%s\t%s\t%sms\t%s\n",
            $a['ok'] ? 'ok' : 'FAIL',
            $a['model_id'] ?? '',
            $a['http_status'] ?? '-',
            $a['error_class'] ?? '-',
            mb_substr((string) ($a['error_brief'] ?? ''), 0, 80),
            $a['latency_ms'] ?? '-',
            $a['created_at'] ?? ''
        );
    }
}

echo "AI_ENABLED=" . (\Kidepik\Shared\Config::aiEnabled() ? '1' : '0') . "\n";
echo "AI_MOCK=" . (\Kidepik\Shared\Config::aiMock() ? '1' : '0') . "\n";
echo "AI_MAX_MODEL_ATTEMPTS=" . \Kidepik\Shared\Config::aiMaxModelAttempts() . "\n";
echo "OPENROUTER_KEY=" . (\Kidepik\Shared\Config::openRouterApiKey() !== '' ? 'set' : 'missing') . "\n";
