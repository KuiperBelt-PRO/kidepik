# Spec: Narrativa de aventura generada por LLM (pitches, escenas, retos, esperas)

> Estado: **aprobada** (2 ago 2026) — delta tutor: **sin plantillas narrativas en ningún camino** (ni fallback)  
> Relacionado: [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md), [SPEC_APP_ADVENTURE_ZONE_BIBLE.md](SPEC_APP_ADVENTURE_ZONE_BIBLE.md), [SPEC_APP_MENTOR_PROSE_CLARITY.md](SPEC_APP_MENTOR_PROSE_CLARITY.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md)  
> Plan de ejecución: [tasks/AI_ADVENTURE_LLM_NARRATIVE_PLAN.md](../tasks/AI_ADVENTURE_LLM_NARRATIVE_PLAN.md)  
> Precedencia: **sustituye** el enfoque «plantilla PHP primero, LLM opcional» y **elimina** cualquier copy narrativo preescrito de aventura post-examen.

## Problema (feedback tutor ago 2026)

| Síntoma | Causa técnica actual |
| --- | --- |
| Siempre las mismas 3 zonas para Vatardar (Laberinto, Biblioteca, Bosque) | `AdventureService::zonePitches()` ordena por debilidad de materia de forma **determinista**; mismos niveles → mismo top-3 |
| Pitches, llegadas y retos suenan iguales entre sesiones | `ZoneNarrativeCatalog`, `challengePool`, `frameChallenge` — **plantillas PHP** |
| Reto en Laberinto habla de «sendero» | Vestido genérico de bosque, no coherencia de zona |
| Mensajes de espera recargados y repetitivos | Arrays estáticos en `web/js/scenes/play.js` (`thinkingLines`) sin LLM ni rotación por sesión |

**No es un fallo del modelo:** el producto **no llama al LLM** en esos beats; usa copy fijo.

## Objetivo

1. **Variedad:** cada sesión (o cada día) el viajero ve pitches, NPCs, retos y frases de espera **distintos** en tono y detalle, sin romper el canon.
2. **Coherencia:** vocabulario del **lugar activo** (espejos, biblioteca, bosque…), no metáforas de otra zona.
3. **Claridad:** español natural según `effective_age_band` y mundo — [SPEC_APP_MENTOR_PROSE_CLARITY.md](SPEC_APP_MENTOR_PROSE_CLARITY.md).
4. **Pedagogía segura:** el **motor PHP** sigue eligiendo materia, dificultad, `zone_id`, fase y respuesta canónica; el LLM **no puntúa ni cambia el plan**.

---

## 1. Principio rector: planificador PHP + prosa LLM

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│ Pedagogía + fases   │────►│ Agentes LLM (narrativa)  │────►│ Validador schema│
│ (PHP, determinista) │     │ pitches / escenas / retos  │     │ + tono + canon  │
└─────────────────────┘     └──────────────────────────┘     └────────┬────────┘
                                                                        ▼
                                                              Turnos + ledger + UI
```

| Capa | Responsable | Ejemplos |
| --- | --- | --- |
| **Plan** | PHP | `phase`, `zone_id`, `subject_id`, `gate_index`, `steps_total`, elegibilidad de zonas, `canonical_answer` |
| **Prosa** | LLM | `description`, `why_for_you`, llegada, NPC, vestido del reto, entre-retos, éxito/casi, copy de espera |
| **Ítem curricular** | PHP (determinista) | `canonical_answer`, tipo de ítem, dificultad — el LLM **redacta**, no inventa la respuesta |

**Prohibido (decisión de producto aprobada):** plantillas narrativas de aventura en **cualquier** camino — feliz, degradado o «mínimo». Incluye `ZoneNarrativeCatalog`, `zonePitches`/`whyForYou` PHP, `challengePool` con wrapper fijo, arrays `thinkingLines` en `play.js`, y ficheros `zone_narratives/*.es.md` usados como texto servido al niño.

**Permitido (no es narrativa de juego):** strings de **chrome UI** en fallo de compose (`play.error.compose_failed`, botón «Reintentar») — mensajes de sistema, no historia.

### 1.1 Política cero plantillas

| Superficie | Fuente única |
| --- | --- |
| Pitches, llegadas, NPCs, retos vestidos, entre-retos, cierres, esperas | LLM vía agentes §3 |
| Tests PHPUnit / Playwright | Gateway inyectado + fixtures JSON en `api/tests/fixtures/` — **no** catálogos narrativos PHP |
| Biblia de zona (`SPEC_APP_ADVENTURE_ZONE_BIBLE`) | **Constraint** en prompt + validador — no texto servido |

### 1.2 Fallo de compose (sin plantillas)

Si el LLM no produce un envelope válido tras agotar reintentos:

1. **Gateway:** recorrer cola de modelos free (existente).
2. **Validación:** re-prompt hasta **2** veces con feedback de error (schema, vocabulario, cupos).
3. **Agotado:** fase `compose_failed` — **no** avanzar el planificador ni servir copy narrativo sustituto.

```ts
interface ComposeFailedTurn {
  phase: 'compose_failed';
  error_code: 'ADVENTURE_COMPOSE_FAILED';
  compose_kind: 'pitch' | 'scene' | 'challenge' | 'waiting';
  retry_allowed: true;
  // Sin agent_text narrativo
}
```

| UX niño | Detalle |
| --- | --- |
| Mensaje | Chrome UI (i18n), p. ej. «No hemos podido preparar la escena.» — **no** historia inventada offline |
| CTA | «Reintentar» → mismo beat, nueva llamada compose |
| Esperas sin lote | Animación neutra (puntos / skeleton); **sin** líneas de texto preescritas |

Log: canal `compose` (`adventure_compose_failed` + `compose_kind`); canal `ai` (todos los intentos).

---

## 2. Superficies que pasan a LLM

### 2.1 Pitches de zona (post-examen y encrucijadas)

**Antes:** catálogo fijo en `AdventureService::zonePitches()` + `whyForYou()` por plantilla.

**Después:**

1. **PHP — `ZonePitchPlanner`:** elige **qué** `zone_id` ofrecer (2–3), excluyendo `zones_completed` y materias inactivas.
2. **LLM — `zone_pitch_writer`:** genera el pitch completo por zona elegida.
3. **PHP — validación:** ids estables del canon; longitudes; `why_for_you` distintos; sin `L1`–`L5`.

#### 2.1.1 Variabilidad de la terna (por qué Vatardar siempre ve lo mismo)

Reglas del planificador (sustituyen sort determinista puro):

| Regla | Detalle |
| --- | --- |
| Pool elegible | Todas las zonas con materia activa y no completadas |
| Candidatos pedagógicos | Las **4** materias con nivel más bajo (o empate ±1 rango) |
| Selección final | Elegir **3** con **semilla de sesión** `hash(child_id + session_id + date)` — shuffle ponderado, no siempre el mismo orden |
| Debilidad | Al menos **1** zona de la materia más débil; las otras 2 del pool candidato |
| Re-encrucijada C2 | Excluir zona activa recién completada; nueva semilla por sesión |

El LLM **no** elige `zone_id`; solo redacta pitches para los ids que PHP ya fijó.

#### 2.1.2 Envelope `ZonePitchBundle`

```ts
interface ZonePitchOption {
  id: string;              // zone_math | zone_logic | … (canon)
  label: string;           // canon fijo o variante corta aprobada por validador
  description: string;     // 1–2 frases: qué es el lugar + qué pasa
  why_for_you: string;     // motivo para este explorador, sin L*
}

interface ZonePitchBundle {
  mentor_bridge: string;   // 1–3 frases: celebra rango + remite a cartas (sin volcar description)
  options: ZonePitchOption[];  // 2–3
}
```

Prompt incluye: `PlayerState`, rasgos, materias débiles (sin niveles al niño), mundo, capítulo, zonas ya superadas, excerpt de biblia de zona.

### 2.2 Llegada a zona + NPCs

**Antes:** `ZoneNarrativeCatalog::arrivalText()` — 3 párrafos fijos.

**Después — `zone_scene_writer`:**

| Campo generado | Contenido |
| --- | --- |
| `agent_text` | Un turno (3 párrafos máx.): llegada sensorial + **NPC con nombre propio** dentro del arquetipo + problema concreto + CTA |
| `meta.npc_ids` | `zone_guardian` (+ opcional `companion`) |
| `meta.npc_display` | `{ archetype, name, one_line_voice }` — persistido en beat para coherencia en retos siguientes |

El mentor **narra** al NPC; no hay segundo chat. El NPC habla en estilo directo entre comillas, **español coloquial** acorde a la edad.

Invariantes: vocabulario de la zona activa; prohibido bosque/espejo cruzado; ver [SPEC_APP_ADVENTURE_ZONE_BIBLE.md](SPEC_APP_ADVENTURE_ZONE_BIBLE.md).

### 2.3 Retos (challenge intro + ítem)

**Antes:** `challengePool` PHP + `frameChallenge("El sendero exige saber…")`.

**Después — pipeline de dos pasos (como placement):**

1. **PHP — `ChallengePlanner`:** `subject_id`, `level_id`, `item_type`, `difficulty`, `canonical_answer` (banco mínimo o generador determinista).
2. **LLM — `challenge_writer`:** `ChallengeEnvelope` con `narrative_wrapper` + `prompt_text` vestidos en la zona y con el NPC ya presentado.

Ejemplo fantasy / `zone_logic`:

> El Vigía de los Espejos enciende un panel en el cristal (prueba 1 de 3). Las cifras parpadean en fila:
>
> Secuencia: 1, 2, 4, 8, … ¿Siguiente?

El validador rechaza si el wrapper menciona «sendero», «bosque» o «runa» en zona logic.

`success_beat_hint` / `fail_beat_hint` en el envelope → PHP los usa o pide línea corta al LLM en `challenge_result_writer` (mismo turno de scoring).

### 2.4 Entre-retos y cierre de quest

| Beat | Agente | Notas |
| --- | --- | --- |
| `zone_between` | `zone_scene_writer` | Avance diegético hacia el siguiente gate; menciona progreso (n de N) |
| `zone_quest_complete` | `zone_scene_writer` | Celebración breve + opciones de continuar / pausar |

Sin excepción: estos beats **solo** salen del LLM (o `compose_failed` §1.2).

### 2.5 Copy de espera (thinking / blocked)

**Antes:** `play.js` → `thinkingLines()`, `preparingExamLines()`, arrays estáticos por `age_band`.

**Después:**

| Aspecto | Decisión |
| --- | --- |
| Origen | **Servidor** genera lotes vía `waiting_copy_writer` |
| Cuándo | Al abrir sesión play; al cambiar de `phase` larga (placement compose, adventure LLM); **máx. 1 regeneración / 24 h / child** salvo force debug |
| Caché | `dialogue_sessions.meta.waiting_copy` o `children.settings.play_waiting_cache` |
| Cliente | `play.js` consume `waiting_lines[]` del API; si vacío o compose falló → animación neutra (§1.2), **sin** arrays estáticos de prosa |

#### Kinds de espera

| `kind` | Cuándo | Tono |
| --- | --- | --- |
| `preparing_exam` | Compose placement | Prueba de ingreso / umbral — sin «examen» ni «armar» |
| `adventure_compose` | Generando pitch/escena/reto | Breve, situado en el mundo |
| `evaluating_answer` | Tras responder reto | 1 línea |
| `general` | Otros | Neutral |

Reglas UX (heredan A2.7):

- Rotación cliente ≥ **8 s** en `preparing_exam`; ≥ **4,5 s** en otros.
- **4–8 líneas** por lote; cada línea ≤ **90 caracteres** display.
- Léxico según `effective_age_band` + `world_theme` + nombre del mentor.
- **Prohibido:** arcaísmos, muletillas en cadena («equilibrio tiembla»), párrafos densos.

#### Envelope `WaitingCopyBundle`

```ts
interface WaitingCopyBundle {
  kind: string;
  generated_at: string;       // ISO
  lines: string[];            // 4–8
  ttl_hours: number;            // default 24
}
```

---

## 3. Agentes y `purpose` gateway

| Agente | `purpose` sugerido | Temperatura | Salida |
| --- | --- | --- | --- |
| `zone_pitch_writer` | `adventure_pitch` | 0.6 | `ZonePitchBundle` |
| `zone_scene_writer` | `adventure_scene` | 0.6 | `DialogueEnvelope` + npc meta |
| `challenge_writer` | `adventure_challenge` | 0.4 | `ChallengeEnvelope` |
| `challenge_result_writer` | `adventure_challenge` | 0.5 | `{ success_text, near_miss_text }` |
| `waiting_copy_writer` | `adventure_waiting` | 0.7 | `WaitingCopyBundle` |

Todos cargan: `_mentor_prose_rules.es.md`, `_common_child_safety.es.md`, excerpt biblia de zona, `JourneyContextPack` L2+L3.

---

## 4. Validación post-LLM

Además del schema JSON:

| Check | Acción si falla |
| --- | --- |
| `zone_id` / `subject_id` ≠ plan PHP | Rechazar → re-prompt (hasta 2×) → `compose_failed` |
| Vocabulario de zona ajena (lista por `zone_id`) | Rechazar → re-prompt |
| Muletillas > cupo [SPEC_APP_MENTOR_PROSE_CLARITY.md](SPEC_APP_MENTOR_PROSE_CLARITY.md) §2 | `safety_rewriter` o re-prompt |
| Frase > límite caracteres / palabras por banda | Recortar o re-prompt |
| `why_for_you` duplicados entre opciones | Re-prompt solo pitches |
| `options` < 2 cuando `input_mode` lo exige | Re-prompt; si persiste → `compose_failed` |

Logs: canal `ai` (`llm_attempt`, `narrative_validation_failed`); canal `compose` si batch.

---

## 5. API (deltas)

### 5.1 `POST …/dialogue/session` y `POST …/dialogue/turn`

Respuesta incluye opcionalmente:

```ts
{
  waiting_lines?: string[];
  waiting_kind?: string;
  waiting_ttl_hours?: number;
}
```

### 5.2 Generación bajo demanda (interno)

No expone endpoint público nuevo en MVP: el `DialogueService` / `AdventureComposeService` invoca agentes en los mismos turnos que hoy emiten copy fijo (a eliminar).

### 5.3 Turno `compose_failed`

`POST …/dialogue/turn` con `action: retry_compose` cuando `phase=compose_failed` relanza el compose del `compose_kind` pendiente.

---

## 6. Migración y eliminación de plantillas

| Fase | Alcance | Criterio de cierre |
| --- | --- | --- |
| **L1** | Pitches post-examen + variabilidad planificador | 3 sesiones Vatardar → ternas o copy distintos en ≥2 de 3; **cero** llamadas a `zonePitches` plantilla |
| **L2** | Llegada + retos + resultados por zona | Laberinto sin «sendero»; `ZoneNarrativeCatalog` sin uso en runtime |
| **L3** | Entre-retos + quest complete | Flujo 3 gates completo con LLM |
| **L4** | Waiting copy servidor + cliente | Sin `thinkingLines` ni arrays estáticos en `play.js` |
| **L5** | **Eliminar** código y ficheros de plantillas narrativas | `ZoneNarrativeCatalog`, wrappers `challengePool` narrativos, `zone_narratives/*.es.md` servidos — borrados del repo |

En L1–L4 las plantillas legacy pueden coexistir **solo** hasta el PR que las sustituye; en el mismo PR o el siguiente **no** deben quedar rutas de código que las invoquen. L5 confirma borrado y tests sin referencias.

---

## 7. Criterios de aceptación

1. **Ningún** beat narrativo de aventura post-examen sale de plantilla PHP o arrays estáticos del cliente.
2. Tres resets post-examen del mismo niño (mismos niveles) producen **copy distinto** en pitches y/o orden de zonas ofrecidas en ≥2 ejecuciones.
3. Reto en `zone_logic` no contiene «sendero», «bosque», «runa» en el wrapper.
4. NPC de zona tiene nombre + una línea de voz reconocible; se reutiliza en retos de la misma quest.
5. Esperas: líneas **solo** desde API (LLM); rotación legible (≥8 s en placement compose).
6. Fallo LLM agotado: `compose_failed` + CTA reintentar — **sin** copy narrativo sustituto ni 500 al niño.
7. PHPUnit: validador vocabulario; planner semilla; gateway inyectado — **sin** assertions sobre plantillas legacy.
8. Playwright: flujo post-examen → elegir zona → primer reto — smoke con LLM real local.
9. L5: grep en repo sin referencias runtime a `ZoneNarrativeCatalog`, `thinkingLines`, `challengePool` narrativo.

---

## 8. Fuera de alcance

- Generar nuevos `zone_id` o materias fuera del canon.
- LLM libre sin `phase` (anti-hueco sigue vigente).
- Streaming token-a-token al cliente.
- Modelos de pago.

---

## Aprobación

- [x] Principio planificador PHP + prosa LLM (§1) — **2 ago 2026**
- [x] Pitches con variabilidad (§2.1)
- [x] Escenas, NPCs y retos LLM (§2.2–2.3)
- [x] Esperas servidor (§2.5)
- [x] **Sin plantillas narrativas** — ni fallback (§1.1, §1.2) — **delta tutor 2 ago 2026**
- [x] Fases de migración + eliminación L5 (§6)
- [x] Criterios §7 como puerta de implementación
