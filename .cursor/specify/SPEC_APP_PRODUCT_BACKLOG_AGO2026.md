# Spec: Backlog producto UI + mecánicas (ago 2026)

> Estado: **aprobada — en implementación** (ago 2026)  
> Fuente: notas Downloads (`especificaciones_kidepik.md`) + gap post-sprint orquestador/datos  
> Relacionado: [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md), [SPEC_APP_CREW_MEMBER_CARDS.md](SPEC_APP_CREW_MEMBER_CARDS.md), [SPEC_APP_CREW_MEMBER_SETTINGS.md](SPEC_APP_CREW_MEMBER_SETTINGS.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_PARALLEL_WORLDS.md](SPEC_APP_PARALLEL_WORLDS.md), [SPEC_APP_WAITING_PHRASES.md](SPEC_APP_WAITING_PHRASES.md), [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md)  
> **No incluye:** Parquet / `.duckdb` persistente / ETL (aplazado).

## Contexto

El sprint de capas de datos + orquestador + play JSONL cerró la **tubería backend**. Quedan cambios de **producto visibles** (Tripulación, PIN, informes, pulido play) que el usuario confirma como deseables.

## Objetivo

Contrato único del backlog pendiente, priorizado en cortes implementables.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| B1 | Waiting phrases | JSONL ([SPEC_APP_WAITING_PHRASES](SPEC_APP_WAITING_PHRASES.md)) |
| B2 | Parquet / DuckDB persistente / ETL | **No** en este horizonte |
| B3 | Ficha `#/crew/:id` | Tabs: **Viaje** · **Equipaje** · **Ajustes** (+ **Detalles** cuando exista el corte 3→4 tabs del backlog visual) |
| B4 | Materias en ficha | Grid de tarjetas con progreso + switch ON/OFF |
| B5 | Niveles en UI tutor | Copy en castellano (evitar solo `L3`); barra con nivel actual → siguiente |
| B6 | Descripción personaje | Fix bug cursor/caracteres al editar |
| B7 | Controles booleanos | Componente **switch** glass (además de checkbox legacy) |
| B8 | Lista `#/crew` | CTA «Continuar aventura» en carta |
| B9 | PIN | Modal teclado 3×3 (dígitos) antes de play si `require_exit_pin` |
| B10 | Informes tutor | Solicitar generación informe evaluación (`.md` + vista) |
| B11 | Puntos flojos | Tutor indica materia y/o foco (ej. «Divisiones de 2 cifras») → entra en prompt de caminos |
| B12 | Cambio de mundo | UI para cambiar `active_world_theme` (respeta `lock_world_theme`) |
| B13 | Play — fallo examen | Mensaje + reintentar compose |
| B14 | Play — fallo camino | Regenerar **solo** el camino fallido; reutilizar los otros dos |
| B15 | Play — mentor | Prosa breve (ya M1); aplicar límites duros en prompts/agents |
| B16 | Play — post-rango | Informe `.md` tutor + felicitación breve al viajero |

---

## 2. Ficha tripulante (tabs)

Amplía [SPEC_APP_CREW_MEMBER_DETAIL](SPEC_APP_CREW_MEMBER_DETAIL.md):

| Tab | Contenido |
| --- | --- |
| **Detalles** | Hero + perfil (nombre, edad, mundo, descripción) + progreso general + grid materias |
| **Viaje** | Diario / timeline / summaries L2 (antes embebido en scroll) |
| **Equipaje** | Moneda + grid de hallazgos — [SPEC_APP_CREW_BAGGAGE_TAB](SPEC_APP_CREW_BAGGAGE_TAB.md) |
| **Ajustes** | Permisos, PIN, límites, peligro |

### Grid materias

- Cada materia activa: tarjeta con label, barra % hacia siguiente nivel, switch activar/desactivar.
- Copy nivel: p. ej. «Nivel 3 → 4» o leyenda info; no solo `L3` crudo sin contexto.

### Descripción editable

- Corregir re-render que mueve el cursor / inserta caracteres (controlled input / debounce sin remount).

---

## 3. Tripulación (lista)

Amplía [SPEC_APP_CREW_MEMBER_CARDS](SPEC_APP_CREW_MEMBER_CARDS.md):

- En cada carta (no tutor): acción primaria **Continuar aventura** → `#/play/:childId` (o flujo PIN primero).
- Tap resto de carta → ficha detalle (comportamiento actual).

---

## 4. Modal PIN (play)

Nuevo contrato UI (viewport 390×844):

```
┌─────────────────────┐
│ Introduce el PIN    │
│      • • • •        │
│  1  2  3            │
│  4  5  6            │
│  7  8  9            │
│     0   ⌫           │
└─────────────────────┘
```

- Solo si `require_exit_pin` y hay hash configurado.
- Verificar vía API existente de permisos/PIN (sin exponer hash).
- Fallo: feedback glass; sin revelar si el PIN es corto/largo de más allá de 4 dígitos.

---

## 5. Tutor: informes y puntos flojos

| Capacidad | Comportamiento |
| --- | --- |
| Generar informe | CTA en ficha → job/agente `journey_summarizer` (o purpose informe) → `.md` en ledger + preview |
| Puntos flojos | Campo por materia o nota libre en settings learning → `learning.weak_spots[]` → inyectado en `path_composer` |

---

## 6. Mundos en paralelo (UI)

- Control en Detalles/Ajustes: cambiar mundo activo fantasy ↔ sci-fi.
- Si `lock_world_theme`: solo tutor con unlock, o bloquear con helper.
- Tras cambio: tema play/UI niño sigue activo; progreso desde `child_world_progress`.

---

## 7. Mecánicas play pendientes

Ya normativas en [SPEC_APP_JOURNEY_MECHANICS](SPEC_APP_JOURNEY_MECHANICS.md); este backlog exige **cableado UI/flujo**:

1. Fail examen → mensaje + reintento compose (no callejón sin salida).
2. Fail pack de camino → regenerar 1 camino; chips siguen mostrando 3.
3. Límites de longitud mentor en agents `.md` + skills.
4. Al subir rango/nivel: escribir informe tutor + turno felicitación.

---

## 8. Criterios de aceptación (global)

1. Specs actualizadas (esta + waiting JSONL + storage D9 + detail/cards deltas).
2. Plan de tareas con cortes 0…N y orden.
3. **Sin** implementación de Parquet/ETL.
4. Cada corte cierra con Playwright 390×844 en la superficie tocada.

## Fuera de alcance

- Admin CMS de frases/glosario.
- Compactación Parquet / fichero `.duckdb` persistente.
- Rediseño visual v3 completo (ilustraciones TCG finales).
