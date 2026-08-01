<?php
require '/var/www/api/vendor/autoload.php';
\Kidepik\Shared\Config::load('/var/www/.env.poc');
$pdo = \Kidepik\Shared\Database\PdoFactory::fromConfig();
if (!$pdo) {
    fwrite(STDERR, "no pdo\n");
    exit(1);
}
$cid = '5001ba88-cd97-4b40-a67c-496c081a987e';
$pdo->beginTransaction();
$pdo->prepare(
    "UPDATE children SET
      onboarding_step = 'placement',
      placement_status = 'not_started',
      general_level = NULL,
      effective_age_band = NULL,
      rank_id = NULL,
      rank_track = NULL,
      updated_at = now()
     WHERE id = :id"
)->execute(['id' => $cid]);

$pdo->prepare(
    "UPDATE placement_exams SET status = 'abandoned', completed_at = now()
     WHERE child_id = :id AND status = 'in_progress'"
)->execute(['id' => $cid]);

$pdo->exec(
    "DELETE FROM placement_answers WHERE exam_id IN (
       SELECT id FROM placement_exams
       WHERE child_id = '{$cid}' AND status = 'abandoned'
     )"
);

$stmt = $pdo->prepare(
    "SELECT id FROM dialogue_sessions
     WHERE child_id = :id AND status = 'open'
     ORDER BY updated_at DESC LIMIT 1"
);
$stmt->execute(['id' => $cid]);
$sid = $stmt->fetchColumn();
if (is_string($sid) && $sid !== '') {
    $pdo->prepare('DELETE FROM dialogue_turns WHERE session_id = :sid')->execute(['sid' => $sid]);
    $intro = 'Cuando quieras, abrimos la prueba de ingreso. No es un trámite: es el mapa de tu viaje.';
    $pdo->prepare(
        "INSERT INTO dialogue_turns (
           session_id, child_id, flow_id, sequence, role, text, options, input_mode, explorer_reply, meta, model_used
         ) VALUES (
           :sid, :cid, 'first_run', 1, 'mentor', :text,
           :options::jsonb, 'options_only', NULL, :meta::jsonb, NULL
         )"
    )->execute([
        'sid' => $sid,
        'cid' => $cid,
        'text' => $intro,
        'options' => json_encode([['id' => 'start_placement', 'label' => 'Comenzar prueba']], JSON_UNESCAPED_UNICODE),
        'meta' => json_encode(['phase' => 'handoff_placement'], JSON_UNESCAPED_UNICODE),
    ]);
    $pdo->prepare(
        "UPDATE dialogue_sessions SET flow_id = 'first_run', updated_at = now() WHERE id = :sid"
    )->execute(['sid' => $sid]);
}
$pdo->commit();
$check = $pdo->prepare('SELECT display_name, onboarding_step, placement_status FROM children WHERE id = :id');
$check->execute(['id' => $cid]);
echo json_encode($check->fetch(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE) . PHP_EOL;
