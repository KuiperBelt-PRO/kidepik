# Spec: Sesión de aventura (post-examen) — contrato marco

> Estado: **aprobada como marco / placeholder normativo** (julio 2026) — el diseño fino de la aventura **se especificará en detalle más adelante** (compromiso del producto); este documento fija fronteras y handoffs  
> Relacionado: [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [docs/kidepik.md](../../docs/kidepik.md) §7–8

## Contexto

Cuando `onboarding_step === 'complete'` y el placement está hecho, el explorador **comienza la aventura**: viaje narrativo generativo con retos de aprendizaje integrados, elecciones con consecuencias y persistencia de beats ([docs/kidepik.md](../../docs/kidepik.md) §7).

El usuario de producto adelantará specs detalladas de ese tramo. Hasta entonces, el equipo necesita un **contrato** para no pintar mal los handoffs ni el modelo de datos.

## Objetivo

1. Definir cuándo empieza la aventura respecto al first-run y al examen.
2. Fijar que el canal sigue siendo el **diálogo IA** (opciones + texto).
3. Reservar entidades (`story_beats`, sesiones, quests).
4. Listar explícitamente lo **no** decidido aún (para una spec futura `SPEC_APP_ADVENTURE_SESSION_DETAIL` o ampliación de esta).

**No implementar** la lógica narrativa completa hasta esa ampliación + Plan.

---

## 1. Handoff

```
first_run (mundo, nombre, edad)
    → placement (niveles + rango inicial)
    → adventure session  ← ESTE DOCUMENTO
```

Entrada: `#/play/:childId` con perfil completo.

Salida de sesión: límites de Tripulación (minutos, cupo, PIN, horario); progreso persistido para reanudar.

---

## 2. Qué sí queda fijado ahora

| Tema | Decisión |
| --- | --- |
| Canal | [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) con `flow_id = "adventure"` |
| Contexto LLM | `PlayerState`: perfil, world_theme, levels, recent beats, journey summary |
| Persistencia | No regenerar beats ya guardados; resumen cada N beats |
| Pedagogía | Retos cortos 3–5 min; dificultad según niveles + `effective_age_band` |
| Tono | Mundo sci-fi o fantasy; respetar `narrative.avoid_themes` del hogar |
| UI niño | Sin niveles L* salvo setting explícito |
| Rango | Mostrar título de [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md) |
| Auth | JWT tutor + child_id |

### 2.1 Effects mínimos reservados

`append_story_beat`, `set_choice`, `update_quest`, `record_learning_result`, `update_subject_level` (post-sesión), `grant_rank_if_eligible`.

### 2.2 Tablas reservadas

Según docs: `story_beats`, `story_summaries`, `learning_sessions`, `session_answers`, `narrative_quests`. Migraciones cuando se implemente.

---

## 3. Qué queda para specs futuras (backlog explícito)

El detalle **se escribirá después** (petición de producto). Incluirá al menos:

1. Estructura de un “día” / sesión de aventura (cuántos beats, cuándo insertar reto curricular).
2. Mapa / zonas por materia (planetas vs reinos).
3. Arco trama base (Vacío / artefacto) y cómo el LLM lo respeta.
4. UI de mapa vs solo diálogo.
5. Píldoras de entretenimiento (post-MVP).
6. TTS, voz, minijuegos.
7. Reglas exactas de subida/bajada de nivel tras cada sesión.
8. Multiverso / cambio de mundo a largo plazo.

Hasta que existan, cualquier implementación debe limitarse a **stubs** (pantalla “Aventura próximamente” tras onboarding) **o** un vertical slice acordado en Plan — no inventar el arco completo.

---

## 4. Stub de producto aceptable (fase intermedia)

Si first-run + placement se implementan antes que la aventura rica:

1. Tras examen → pantalla/diálogo de cierre: «Tu aventura está por comenzar.»
2. Persistir `adventure_unlocked = true` en settings del child.
3. Siguiente entrada a play: stub o primer beat vertical-slice si ya hay Plan.

Tripulación muestra «Listo para aventurar» vs «Aventura en construcción» según flag de feature.

---

## 5. Criterios de aceptación del marco

1. Documento enlazado desde first-run y placement como siguiente paso.
2. Ninguna spec de gestión contradice el handoff.
3. Cuando llegue la spec detallada, **extiende** esta sin romper dialogue/effects reservados (versionar si hace falta).

## Aprobación

- [x] Aventura post-examen vía diálogo IA
- [x] Persistencia de viaje como requisito
- [x] Detalle de gameplay/narrativa **aplazado** a specs posteriores acordadas
- [x] Stub intermedio permitido
