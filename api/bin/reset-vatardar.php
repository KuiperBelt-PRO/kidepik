<?php
/**
 * Reset one-off de un viajero a handoff_placement (POC).
 * Ya no usa placement_exams como fuente; limpia child_world_progress + flags en children.
 */
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
    "DELETE FROM child_world_progress WHERE child_id = :id"
)->execute(['id' => $cid]);

$pdo->prepare(
    "DELETE FROM user_subject_levels WHERE child_id = :id"
)->execute(['id' => $cid]);

// Residuo legacy (tabla deprecada; no es fuente de verdad)
$pdo->prepare(
    "DELETE FROM placement_exams WHERE child_id = :id"
)->execute(['id' => $cid]);

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
           :sid, :cid, 'placement', 1, 'mentor', :text,
           NULL, 'continue', NULL, :meta::jsonb, NULL
         )"
    )->execute([
        'sid' => $sid,
        'cid' => $cid,
        'text' => $intro,
        'meta' => json_encode(['phase' => 'handoff_placement'], JSON_UNESCAPED_UNICODE),
    ]);
    $pdo->prepare(
        "UPDATE dialogue_sessions SET flow_id = 'placement', updated_at = now() WHERE id = :sid"
    )->execute(['sid' => $sid]);
}
$pdo->commit();
$check = $pdo->prepare('SELECT display_name, onboarding_step, placement_status FROM children WHERE id = :id');
$check->execute(['id' => $cid]);
echo json_encode($check->fetch(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE) . PHP_EOL;
