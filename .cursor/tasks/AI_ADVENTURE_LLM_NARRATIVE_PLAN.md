# Plan: Migración narrativa aventura → LLM (solo LLM, sin plantillas)

> Estado: **aprobado** (2 ago 2026)  
> Spec: [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](../specify/SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)  
> **Implementar** según fases L1→L5. Delta tutor: **cero plantillas narrativas**; fallo → `compose_failed` + reintentar.

## Resumen

Eliminar plantillas PHP (`ZoneNarrativeCatalog`, `zonePitches`, `challengePool` narrativo, `thinkingLines` en `play.js`) y servir **toda** la prosa jugable vía agentes LLM + planificador PHP. Tests con gateway inyectado + fixtures JSON.

## Fases

### L1 — Pitches y variabilidad (P0)

| Paso | Tarea |
| --- | --- |
| L1.1 | `ZonePitchPlanner` — pool 4 candidatos, shuffle con semilla sesión/fecha |
| L1.2 | `ZonePitchWriter` + prompt `shared/Ai/prompts/zone_pitch_writer.es.md` |
| L1.3 | Integrar en `PlacementService::finalize` y `DialogueService` admission_map |
| L1.4 | Validador: `why_for_you` únicos, longitudes, ids canon |
| L1.5 | `compose_failed` si agota reintentos |
| L1.6 | Tests: planner semilla; mock pitch bundle; 3 resets ≠ copy idéntico |
| L1.7 | Dejar de invocar `zonePitches` plantilla en runtime |

### L2 — Llegada y retos (P0)

| Paso | Tarea |
| --- | --- |
| L2.1 | `zone_scene_writer` — llegada unificada + NPC meta |
| L2.2 | `ChallengePlanner` + `challenge_writer` — wrapper + prompt |
| L2.3 | `challenge_result_writer` — éxito/casi por zona |
| L2.4 | Validador vocabulario por `zone_id` |
| L2.5 | Sustituir llamadas en `AdventureService::chooseZone`, `presentChallenge`, `resolveChallenge` |
| L2.6 | Tests: logic zone sin «sendero»; mock challenge envelope |

### L3 — Entre-retos y cierre (P1)

| Paso | Tarea |
| --- | --- |
| L3.1 | `zone_scene_writer` para `zone_between`, `zone_quest_complete` |
| L3.2 | Persistir `npc_display` en beats para coherencia |

### L4 — Esperas servidor (P1)

| Paso | Tarea |
| --- | --- |
| L4.1 | `WaitingCopyService` + `waiting_copy_writer` |
| L4.2 | Caché 24 h en sesión/niño |
| L4.3 | API: `waiting_lines` en open/turn |
| L4.4 | `play.js`: eliminar `thinkingLines` / arrays estáticos; animación neutra si sin lote |
| L4.5 | UI `compose_failed` + `retry_compose` |
| L4.6 | Regeneración por `kind` + `age_band` + mundo |

### L5 — Eliminación de plantillas (P0 al cerrar L2–L4)

| Paso | Tarea |
| --- | --- |
| L5.1 | Borrar `ZoneNarrativeCatalog.php` y usos |
| L5.2 | Borrar wrappers narrativos de `challengePool` / `frameChallenge` |
| L5.3 | Borrar o relegar `zone_narratives/*.es.md` a solo docs de constraint (no servidos) |
| L5.4 | Grep CI: sin referencias runtime a plantillas narrativas |
| L5.5 | Actualizar [AI_ADVENTURE_BACKLOG.md](AI_ADVENTURE_BACKLOG.md) |

## Archivos previstos (referencia)

| Nuevo / tocado | Rol |
| --- | --- |
| `api/src/Services/ZonePitchPlanner.php` | Selección zone_ids |
| `api/src/Services/AdventureComposeService.php` | Orquesta agentes aventura |
| `api/src/Services/WaitingCopyService.php` | Caché esperas |
| `shared/Ai/prompts/zone_pitch_writer.es.md` | Prompt pitches |
| `shared/Ai/prompts/zone_scene_writer.es.md` | Prompt escenas |
| `shared/Ai/prompts/challenge_writer.es.md` | Prompt retos (ampliar) |
| `shared/Ai/prompts/waiting_copy_writer.es.md` | Prompt esperas |
| `api/tests/fixtures/adventure/*.json` | Fixtures para tests con gateway inyectado |
| `api/tests/AdventureLlmNarrativeTest.php` | Validación + mocks |

## Validación

- PHPUnit por fase
- Playwright: post-examen → zona → reto (viewport 390×844)
- Manual: 3 resets Vatardar — comprobar variedad pitches
- Simular fallo LLM → `compose_failed` + reintentar (sin copy narrativo)
- Logs: `ai-*.log`, `compose-*.log`

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Latencia | Compose paralelo (patrón A2 placement); caché esperas |
| Alucinación respuesta correcta | PHP fija `canonical_answer`; LLM solo redacta |
| Coste cuota free | Batch waiting copy 1×/día; sticky winner modelos |
| LLM caído = bloqueo | `compose_failed` + reintentar; telemetría debug; no plantilla sustituta |
