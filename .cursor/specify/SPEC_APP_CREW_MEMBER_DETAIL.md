# Spec: Ficha del tripulante — Viaje y progreso (panel tutor)

> Estado: **propuesta — pendiente de aprobación** (delta ago 2026)  
> Relacionado: [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_CREW_MEMBER_CARDS.md](SPEC_APP_CREW_MEMBER_CARDS.md), [SPEC_APP_CREW_MEMBER_SETTINGS.md](SPEC_APP_CREW_MEMBER_SETTINGS.md), [SPEC_APP_PRODUCT_BACKLOG_AGO2026.md](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md), [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md)

## Contexto

La ficha `#/crew/:childId` ([SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md) §1.3) mezcla hoy en un **scroll largo**:

- Hero carta TCG
- Perfil editable
- Permisos, materias, CTA play
- Diario del viaje (timeline)
- Zona peligrosa

**Gaps observados (ago 2026):**

| Gap | Detalle |
| --- | --- |
| Tabs insuficientes | Hace falta **Detalles / Viaje / Ajustes** (diario = tab Viaje) |
| Materias densas | Pasar a **grid de tarjetas** + switch + barra progreso |
| Niveles `L*` | Poco claros en castellano; leyenda + «Nivel N → N+1» en barra |
| Descripción editable | Bug cursor / caracteres al escribir |
| Sin niveles en API crew (histórico) | Progreso ya parcialmente expuesto; completar UX |
| Viaje = solo timeline embebido | Mover diario a tab propia |

## Objetivo

1. Reorganizar la ficha en **tres pestañas**: **Detalles** · **Viaje** (diario) · **Ajustes**.
2. Grid de materias con progreso + activación.
3. Fix descripción editable; switches glass para booleanos de ajustes.
4. Exponer progresión legible al tutor (rango + nivel + %).

---

## 1. Navegación y layout

### 1.1 Pestañas (viewport 390×844)

```
┌─────────────────────────────────┐
│  [←]  Tripulación · Nombre       │
├─────────────────────────────────┤
│      [ Hero crew-card ]         │
├─────────────────────────────────┤
│ [Detalles] [Viaje] [Ajustes]    │
├─────────────────────────────────┤
│  (contenido de pestaña activa)   │
└─────────────────────────────────┘
```

| Tab | Contenido |
| --- | --- |
| **Detalles** | Perfil editable, progreso general, **grid materias** (switch + barra) |
| **Viaje** | Diario / timeline / summaries (antes en scroll largo) |
| **Ajustes** | Permisos, PIN, límites, materias peligrosas / zona peligrosa |

> Delta ago 2026: sustituye el modelo de 2 tabs Viaje|Ajustes. Ver [SPEC_APP_PRODUCT_BACKLOG_AGO2026](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md).

| Pestaña | `data-crew-tab` | Contenido |
| --- | --- | --- |
| **Viaje** | `journey` | Identidad, progreso, mapa viaje, diario — **default** si `placement_status=completed` |
| **Ajustes** | `settings` | Permisos, materias, zona peligrosa — **default** si onboarding incompleto |

Persistir última pestaña en `sessionStorage` (`crew-tab:{childId}`) para la sesión del navegador.

### 1.2 Hero card (siempre visible)

Contrato [SPEC_APP_CREW_MEMBER_CARDS.md](SPEC_APP_CREW_MEMBER_CARDS.md) ampliado:

| Zona | Contenido nuevo |
| --- | --- |
| Esquina rango | `rank.label_child` o «—» si sin placement |
| Línea de tipo | Mundo · edad · **`L3` general** (tutor) |
| Caja de texto | `tutor_label` o frase de estado onboarding |

---

## 2. Pestaña Viaje — bloques

Orden vertical (scroll dentro del marco):

### 2.1 Identidad del explorador

| Campo | Fuente | Editable tutor |
| --- | --- | --- |
| Nombre de tripulación | `display_name` | Sí (`PATCH` perfil) |
| Edad | `age_years` + banda | Sí |
| Mundo | `world_theme` | Sí (con lock) |
| Descripción tutor | `settings.tutor_label` | Sí |
| Descripción del personaje | `traits.character_summary` | Sí |
| Rasgos estructurados | `traits.species`, `palette`, `features`, `vibe` | Lectura MVP; edición Fase B |
| Logros narrativos | `traits.achievements[]` | Lectura; append solo vía aventura |

**Helper:** «La aventura puede actualizar la descripción y los logros; puedes corregirlos aquí.»

**Sincronización aventura → ficha:**

| Evento play | Efecto en ficha |
| --- | --- |
| `append_achievement` | Nueva línea en lista logros + opcional snippet en resumen |
| `story_summaries` L2 nuevo | Bloque «Resumen del viaje» (§2.4) se refresca al volver a crew |
| Fin placement | `general_level`, `rank`, materias evaluadas |

### 2.2 Progreso general y rango

Bloque **«Tu explorador en el viaje»** — ver [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md).

Resumen visual:

```
Rango: Adepto del artefacto          Nivel general: L3
[████████░░░░] 62 % hacia L4
Próximo rango narrativo: Guardián del saber (requiere L4)
```

- El tutor ve **rango + L*** (decisión de producto aprobada).
- El niño en play sigue viendo sobre todo el **rango**; los `L*` no se muestran en diálogo ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)).

### 2.3 Progreso por materia

Lista de **materias activas** (`settings.learning.active_subjects`) con fila por materia:

| Columna | Contenido |
| --- | --- |
| Nombre | Label del catálogo + icono familia |
| Zona vinculada | Nombre del lugar (`zone_*`) si existe en canon |
| Nivel | `L2` … `L5` o «Sin evaluar aún» |
| Barra | % hacia siguiente `L` (fórmula §3 de CREW_PROGRESS) |
| Estado zona | «No visitada» / «En curso» / «Superada» (quest intro `completed`) |

Materias activas sin fila en `user_subject_levels` tras examen abandonado: badge «Pendiente de examen».

### 2.4 Mapa y estado del viaje

Bloque **«Dónde está ahora»** (`settings.journey` + quests):

| Campo UI | Fuente |
| --- | --- |
| Capítulo | `journey.chapter_id` → label humano (`C1_first_zone` → «Primer territorio») |
| Zona activa | `journey.active_zone_id` → label zona o «En encrucijada» |
| Fragmentos / balizas | `journey.fragments_restored` |
| Zonas superadas | `journey.zones_completed[]` — chips verdes |
| Destinos pendientes | Último `choices_discarded` o `zones_offered_pending` ([SPEC_APP_ADVENTURE_TURN_PACKAGING.md](SPEC_APP_ADVENTURE_TURN_PACKAGING.md)) |
| Misión activa | `narrative_quests` `status=active`: título + `steps_done/steps_total` |

CTA primario: **«Entrar en la aventura»** → `#/play/:id` (si no pausado y permisos OK).

### 2.5 Resumen narrativo (L2)

- Párrafo corto desde último `story_summaries` `kind=condensed_full`.
- Si no existe: «Aún no hay resumen; el diario muestra los hitos.»
- Enlace «Ver diario completo» hace scroll al bloque §2.6 en la misma pestaña.

### 2.6 Diario del viaje

Mismo contrato que hoy ([SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md) §1.4):

- Resumen una línea + timeline paginado + «Ver más».
- Segundos visibles en timestamps.
- Eventos `decision` muestran label humano de zona.

**Estados de carga (ago 2026):**

| Momento | UI |
| --- | --- |
| Carga inicial | Skeleton `lines` en resumen + 3 filas skeleton tipo timeline en la lista |
| «Ver más» | Añadir 3 filas skeleton al final de la lista; **sin** texto «Cargando más…» |
| Error | Toast `error`; resumen con copy de vacío/error según contexto |

Helpers: `fillGlassSkeleton`, `mountTimelineSkeletonItems` — [DESIGN.md](../DESIGN.md) §11.

**Guardados en ficha (Viaje + Ajustes):** ver [SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md) — `runGlassButtonAction` + toast.

---

## 3. Pestaña Ajustes

Contenido movido desde scroll actual — contrato detallado en [SPEC_APP_CREW_MEMBER_SETTINGS.md](SPEC_APP_CREW_MEMBER_SETTINGS.md):

1. Permisos y límites (guardar explícito)
2. Materias de aprendizaje (guardar explícito)
3. Zona peligrosa (pausar / eliminar)

**No** incluir en Ajustes: nombre, edad, descripción personaje (permanecen en Viaje §2.1).

---

## 4. API

### 4.1 Ampliar `GET /api/v1/crew/:id`

Añadir objeto `progress` (o campos top-level) — ver DTO en [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md).

Campos mínimos nuevos en respuesta:

```ts
interface CrewMemberDetail {
  // …existente…
  general_level: string | null;       // "L3"
  rank: RankDto | null;
  progress: CrewProgressDto;
  journey: JourneyStateDto;
  traits: ChildTraitsDto | null;
}
```

### 4.2 Nuevo endpoint opcional (alternativa)

`GET /api/v1/crew/:id/progress` — solo si el payload de detalle crece demasiado. **Preferencia MVP:** embebido en `GET :id` con una query `?fields=progress` opcional para lista vs ficha.

### 4.3 Timeline

Sin cambio de ruta: `GET /api/v1/play/:id/journey/timeline` (solo desde ficha con JWT tutor).

---

## 5. Estados vacíos y onboarding

| Estado | Pestaña default | Viaje muestra |
| --- | --- | --- |
| `pending_entry` | Ajustes | Hero + mensaje «Completará su perfil en la primera aventura» |
| `placement` in progress | Ajustes | Badge examen; progreso oculto |
| `complete` | Viaje | Progreso completo §2.2–2.6 |
| `paused` | Viaje | Banner «En pausa» + Ajustes para reactivar |

---

## 6. UI / CSS

| Componente | Propuesta |
| --- | --- |
| Tabs | `crew-panel__tabs` — reutilizar patrón segment de permisos |
| Barras progreso | `crew-progress-bar` — glass, acento `world_theme` del niño |
| Chips zona | `crew-journey-chip` — superada / activa / pendiente |
| Materias | `crew-subject-row` — grid 2 líneas en móvil |

Importar estilos en `web/css/components/crew-progress.css` (nuevo).

---

## 7. Criterios de aceptación

1. Ficha tiene pestañas **Viaje** y **Ajustes**; hero siempre visible.
2. Tras placement completado, Viaje muestra rango + `L3` (ej.) + barra hacia `L4`.
3. Cada materia activa muestra nivel y barra de progreso hacia siguiente `L`.
4. Mapa de viaje refleja zona activa y zonas superadas.
5. `character_summary` y logros visibles; resumen L2 si existe.
6. Diario del viaje funciona como hoy, dentro de pestaña Viaje.
7. Ajustes conserva guardado explícito permisos/materias.
8. PHPUnit: DTO `CrewProgressService` con fixtures `user_subject_levels`.
9. Playwright 390×844: cambio pestañas, progreso visible post-placement.

---

## 8. Fases de entrega

| Fase | Entregable |
| --- | --- |
| **B1** | API `progress` + pestañas + reordenar bloques |
| **B2** | Barras progreso + hero rango/L* |
| **B3** | Mapa viaje + destinos pendientes + sync resumen L2 |
| **B4** | Rasgos estructurados lectura + logros expandibles |

---

## 9. Relación con specs hermanas

| Spec | Cambio |
| --- | --- |
| CREW_SECTION | §1.3 sustituido por referencia a esta spec + SETTINGS |
| CREW_MEMBER_CARDS | Hero Fase B obligatoria con rango + L general |
| CREW_PROGRESS | DTO y fórmulas de barras |
| CREW_MEMBER_SETTINGS | Contenido pestaña Ajustes |
| PROGRESSION_RANKS | Labels tutor en progreso |
| JOURNEY_MEMORY | Resumen L2 en ficha |

## Aprobación

- [ ] Pestañas Viaje / Ajustes
- [ ] Tutor ve rango + L* + barras
- [ ] API progress embebida en crew detail
- [ ] Mapa viaje + zonas superadas
