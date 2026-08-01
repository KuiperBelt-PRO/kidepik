# Spec: Progreso del tripulante (vista tutor)

> Estado: **propuesta — pendiente de aprobación** (2 ago 2026)  
> Relacionado: [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md)

## Objetivo

Definir el **modelo de datos**, **fórmulas de progreso** y **DTO API** para que el tutor vea en la ficha:

1. Nivel general actual y avance hacia el siguiente `L`.
2. Rango narrativo actual y requisito del siguiente rango.
3. Por cada materia activa: nivel, barra hacia siguiente `L`, y estado de la zona vinculada.

El niño **no** ve los `L*` en play; el tutor **sí** ([SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md)).

---

## 1. Fuentes de verdad

| Dato | Tabla / campo |
| --- | --- |
| Nivel general | `children.general_level` (`L1`–`L5`) |
| Banda efectiva | `children.effective_age_band` |
| Rango | `children.rank_id`, `rank_track` + catálogo [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md) |
| Nivel por materia | `user_subject_levels.level_id` |
| Rolling precisión | `user_subject_levels.accuracy_rolling` (0–1, nullable) |
| Modificador dificultad | `user_subject_levels.difficulty_modifier` |
| Materias activas | `children.settings.learning.active_subjects` |
| Zonas superadas | `children.settings.journey.zones_completed` |
| Quest activa | `narrative_quests` |

---

## 2. DTO API

```ts
interface RankDto {
  id: string;
  track: "fantasy" | "sci-fi";
  tier: number;
  label_child: string;
  label_tutor: string;
}

interface LevelProgressDto {
  current: "L1" | "L2" | "L3" | "L4" | "L5";
  next: "L2" | "L3" | "L4" | "L5" | null;  // null si L5
  percent_to_next: number;                  // 0–100 entero
  hint_tutor: string;                       // 1 frase humana
}

interface SubjectProgressDto {
  subject_id: string;
  label: string;
  family: string;
  zone_id: string | null;
  zone_label: string | null;
  level_id: string | null;
  level_progress: LevelProgressDto | null;
  zone_status: "not_visited" | "in_progress" | "completed" | "not_evaluated";
  recent_attempts: number;                  // últimos 30 días o últimos 10 ítems
}

interface CrewProgressDto {
  general_level: string | null;
  general_progress: LevelProgressDto | null;
  rank: RankDto | null;
  rank_next: RankDto | null;                // siguiente tier si general_level lo permite algún día
  rank_eligible_now: boolean;               // general_level >= rank_next.min_general_level
  subjects: SubjectProgressDto[];
  placement_completed_at: string | null;
}

interface JourneyStateDto {
  chapter_id: string;
  chapter_label: string;
  active_zone_id: string | null;
  active_zone_label: string | null;
  fragments_restored: number;
  zones_completed: string[];
  zones_completed_labels: string[];
  pending_destinations: { id: string; label: string }[];
  active_quest: {
    id: string;
    zone_id: string;
    title_child: string;
    steps_done: number;
    steps_total: number;
  } | null;
}
```

Servicio PHP: `CrewProgressService::build(string $childId): CrewProgressDto`.

---

## 3. Fórmulas de barra «hacia siguiente L»

Reglas alineadas con [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md) §5.1:

### 3.1 Por materia

Para `level_id = Lk` con `k < 5`:

| Input | Uso |
| --- | --- |
| `accuracy_rolling` (default 0.5 si null) | Componente principal |
| Intentos recientes | Mínimo 1 para mostrar barra; si 0 intentos post-placement, `percent = 10` (semilla) |

```
threshold_up = 0.80   // subir nivel
threshold_down = 0.35 // no usado en barra; solo tutor hint si rolling bajo

percent_to_next = clamp(0, 100, round((accuracy_rolling / threshold_up) * 100))
```

Si `accuracy_rolling >= threshold_up` y `recent_attempts >= 4`: `hint_tutor` = «Cerca de subir a L{k+1} en {materia}.»
Si `accuracy_rolling < 0.5`: `hint_tutor` = «Convendría reforzar en la aventura.»

En `L5`: `next = null`, `percent_to_next = 100`, hint «Nivel máximo en esta materia.»

### 3.2 Nivel general

Recalcular con la **misma fórmula ponderada** del placement ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md) §3.3) sobre niveles actuales de materias **activas** con fila en `user_subject_levels`.

`percent_to_next` general = **media ponderada** de `percent_to_next` de materias activas evaluadas (pesos del catálogo).

Si alguna materia activa no evaluada: excluir del promedio y mostrar nota «{n} materias pendientes de examen».

### 3.3 Rango narrativo

`rank` = asignado en `children.rank_id` (placement + ceremonias).

`rank_next` = siguiente tier en catálogo del mismo `rank_track`.

`rank_eligible_now` = `levelIndex(general_level) >= levelIndex(rank_next.min_general_level)`.

UI: si elegible pero `rank_id` aún no actualizado → badge «Nuevo rango disponible en la aventura».

---

## 4. Estado de zona por materia

| `zone_status` | Condición |
| --- | --- |
| `not_evaluated` | Sin fila `user_subject_levels` para la materia |
| `not_visited` | Evaluada pero `zone_id` ∉ `zones_completed` y no es `active_zone_id` |
| `in_progress` | `active_zone_id` = zona de la materia o quest activa en esa zona |
| `completed` | `zone_id` ∈ `journey.zones_completed` |

Mapeo materia→zona: [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md) §3.

---

## 5. Labels tutor (copy)

| Situación | Texto ejemplo |
| --- | --- |
| Sin placement | «Completa el examen de acceso para ver niveles.» |
| General L3, 62 % | «Nivel general L3 — 62 % del camino hacia L4.» |
| Rango + siguiente | «Rango: Adepto del artefacto. Siguiente: Guardián del saber (a partir de L4).» |
| Materia math L2 | «Matemáticas · L2 · Bosque de los Números · En curso» |

**Prohibido** mostrar al tutor jerga interna (`zone_math`, `beat_kind`) en UI final.

---

## 6. Actualización y caché

- Recalcular en cada `GET /crew/:id` (datos pequeños).
- Tras `submitTurn` en play que emite `update_subject_level` / `grant_rank`, el tutor ve datos frescos al volver a crew (sin WebSocket MVP).
- Opcional Fase B: invalidar en cliente con evento `crew-progress-stale` tras cerrar play.

---

## 7. Tests

| Test | Assert |
| --- | --- |
| `CrewProgressServiceTest::generalFromSubjects` | Ponderación = placement |
| `percentAt80Rolling` | `percent_to_next === 100` |
| `zoneStatusCompleted` | `zones_completed` → `completed` |
| `unevaluatedSubject` | `not_evaluated`, sin barra |

---

## 8. Criterios de aceptación

1. DTO expuesto en `GET /crew/:id` tras placement.
2. Barras coherentes con `accuracy_rolling` de prueba.
3. Rango + `rank_next` correctos para fantasy L3.
4. Tutor nunca ve `L*` en respuestas de play API del niño (solo crew).

## Aprobación

- [ ] Fórmulas §3 aceptadas
- [ ] DTO §2 aceptado
- [ ] Servicio `CrewProgressService` autorizado
