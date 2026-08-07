# Spec: Sección Tripulación (perfiles infantiles)

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md), [SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md), [SPEC_APP_ACCOUNT_SECTION.md](SPEC_APP_ACCOUNT_SECTION.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [docs/kidepik.md](../../docs/kidepik.md) §3–9

## Contexto

El drawer etiqueta **Tripulación** (`#/crew`). La cuenta es del **tutor**; los niños no tienen credenciales propias en el MVP. Cada niño es un **perfil / miembro** cuyo **mundo, nombre de tripulación, edad y niveles** se completan en el **primer acceso a la aventura** mediante diálogo con IA ([SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md)), no en un formulario largo del tutor.

Esta spec define la **gestión adulta**: listado, alta de *plaza*, ficha, permisos y borrado. El motor de diálogo, examen y aventura viven en specs hermanas.

## Objetivo

1. Rutas `#/crew`, `#/crew/new`, `#/crew/:id` con marco glass.
2. CRUD de plazas (`children`) bajo el padre autenticado (máx. **10**, provisional).
3. Alta mínima: crear plaza vacía + permisos desde `crew_defaults`; perfil narrativo pendiente.
4. Ficha: mostrar/editar datos cuando existan; permisos; estado de onboarding/placement.
5. Mundo de juego (`world_theme`) **nullable** hasta que el niño lo elija en la aventura.
6. Soft-delete; guardado explícito por bloque (perfil / permisos).

**No se implementa código de producto en este documento** (fase Specify cerrada; Implement solo tras Plan del encargo).

---

## Alcance

### Incluido

| Requisito | Detalle |
| --- | --- |
| Lista | Miembros + CTA añadir + badges de estado onboarding |
| Alta | Confirmación corta → plaza pendiente |
| Ficha | Perfil (lectura/edición tutor), mundo, permisos, aprendizaje, viaje, zona peligrosa |
| Permisos | Solo aquí (§5) |
| Defaults | Al crear, copiar `parent.settings.crew_defaults` |
| Resumen Ajustes | `member_count` |

### Excluido / delegado

| Tema | Dónde |
| --- | --- |
| Diálogo IA (opciones + texto) | [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) |
| Primer acceso: mundo, nombre, edad | [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md) |
| Examen de conocimientos | [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md) |
| Rangos / grados sci-fi y fantasía | [SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md) |
| Aventura post-examen | [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md) |
| Permisos en Ajustes | Excluido |

---

## Principios

| Principio | Decisión |
| --- | --- |
| Tutor abre la plaza | El adulto crea el hueco y los límites |
| Niño completa la identidad de juego | Mundo, nombre de tripulación y edad en primer play |
| Tema UI ≠ mundo juego | `ui_theme` tutor vs `world_theme` niño |
| Permisos en ficha | Nunca en Ajustes |
| Soft-delete | `status = 'deleted'` |
| Guardado explícito | Botón Guardar por bloque perfil / permisos / materias; busy + toast (ver SPEC_APP_GLASS_TOAST) |
| Extensible | Columnas tipadas + jsonb |

---

## Decisiones de producto (aprobadas)

| # | Decisión |
| --- | --- |
| 1 | Máximo **10** miembros por cuenta (provisional; antes 4) |
| 2 | El **mundo lo elige el niño** la primera vez que entra a su aventura (no el tutor en el alta) |
| 3 | Soft-delete |
| 4 | Guardado explícito por bloque |
| 5 | Materias por tripulante: [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §3; horarios: Fase B |
| 6 | Nombre de tripulación y edad: los aporta el niño en el primer acceso; el tutor puede corregir después en la ficha |

---

## 1. Navegación y anatomía

### 1.1 Rutas

| Ruta | Contenido |
| --- | --- |
| `#/crew` | Lista |
| `#/crew/new` | Confirmación de alta (plaza) |
| `#/crew/:childId` | Ficha |
| `#/play/:childId` | Entrada a aventura (specs play; no chrome de gestión completo) |

### 1.2 Lista

Grid responsive (**3 columnas máximo**) con **fichas tipo carta coleccionable** (contrato visual: [SPEC_APP_CREW_MEMBER_CARDS.md](SPEC_APP_CREW_MEMBER_CARDS.md)). Cada carta resume:

- Nombre de tripulación (o «Nuevo tripulante»)
- Caja de arte + marco según mundo del miembro
- Badge / gemelo de estado (pendiente / examen / listo / pausa)
- Línea de tipo: mundo, edad (o «Edad pendiente»)
- Caja de texto: nota tutor u onboarding
- Cupo restante en el CTA «Añadir tripulante (te queda espacio para N)» (fuera del grid, **encima** del grid)

```
┌─────────────────────────────────┐
│  (título «Tripulación» en cabecera del marco) │
│  [ + Añadir tripulante (N) ]    │
│                                 │
│  ┌╌╌ Carta ═════════════════┐  │
│  ║ NUEVO EXPLORADOR    [◆] ║  │
│  ║ ┌────────────────────┐  ║  │
│  ║ │      [arte ?]      │  ║  │
│  ║ └────────────────────┘  ║  │
│  ║ Sin mundo · Edad pend.  ║  │
│  ║ Completará perfil…      ║  │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
│  ┌╌╌ Carta ═════════════════┐  │
│  ║ NORA               [◆] ║  │
│  ║ ┌────────────────────┐  ║  │
│  ║ │   [arte fantasía]  │  ║  │
│  ║ └────────────────────┘  ║  │
│  ║ Fantasía · 8 años       ║  │
│  ║ Listo                   ║  │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘  │
└─────────────────────────────────┘
```

| Estado onboarding | Badge lista |
| --- | --- |
| `pending_entry` … antes de `complete` | «Pendiente de primera aventura» |
| `placement` in progress | «En examen de acceso» |
| `complete` | Mundo + edad; «Listo» / rango futuro |
| `paused` | «En pausa» |

Nombre mostrado: `display_name` si existe; si no, «Nuevo explorador».  
Mundo: label o «Sin mundo aún».

CTA añadir deshabilitado si `member_count >= 10`.

### 1.3 Ficha

> **Delta ago 2026:** anatomía completa en [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md) — pestañas **Viaje** | **Ajustes**, progreso L*+rango, mapa del viaje. Ajustes: [SPEC_APP_CREW_MEMBER_SETTINGS.md](SPEC_APP_CREW_MEMBER_SETTINGS.md). Progreso API: [SPEC_APP_CREW_PROGRESS.md](SPEC_APP_CREW_PROGRESS.md).

1. **Hero card** centrada (siempre visible) — [SPEC_APP_CREW_MEMBER_CARDS.md](SPEC_APP_CREW_MEMBER_CARDS.md) §4.2 + rango y L general.
2. **Pestaña Viaje** — identidad (nombre, edad, mundo, descripciones), progreso general y por materia, mapa viaje, resumen L2, diario.
3. **Pestaña Ajustes** — permisos, materias, zona peligrosa.

Bloques legacy (scroll único) quedan **obsoletos** tras implementar pestañas.

CTA «Entrar en la aventura» en pestaña Viaje (§2.4 CREW_MEMBER_DETAIL).

---

## 2. Alta de miembro (plaza)

### 2.1 Flujo

No hay wizard de mundo/nombre/edad.

1. Tutor pulsa «Añadir explorador».
2. Pantalla `#/crew/new`: explicación corta + confirmación.
3. `POST /api/v1/crew` sin perfil narrativo.
4. Toast «Plaza creada. La primera aventura completará su perfil.»
5. Navegar a `#/crew/:id` para revisar permisos.

**Copy de confirmación:**

> Se creará una plaza en tu tripulación (máximo 10).  
> El explorador elegirá su mundo (fantasía o ciencia ficción), su nombre y su edad la **primera vez** que entre en la aventura.  
> Aquí solo configuras límites y permisos.

### 2.2 Body de creación

```json
{}
```

o opcional:

```json
{ "tutor_label": "El de Marta" }
```

`tutor_label` (opcional, 1–40): nota **solo para el tutor**, no es el nombre de tripulación del juego. Se guarda en `settings.tutor_label`.

### 2.3 Efectos servidor

1. Cupo ≤ 10.
2. Insert `children` con campos de perfil **null** / pasos pendientes.
3. Insert `child_permissions` desde `crew_defaults`.
4. `onboarding_step = 'pending_entry'`, `placement_status = 'not_started'`.

---

## 3. Modelo de datos

### 3.1 Tabla `children`

```sql
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parent_accounts(id) on delete cascade,
  display_name text null,                    -- nombre de tripulación (lo elige el niño)
  age_years int null check (age_years is null or (age_years between 5 and 14)),
  age_band text null check (age_band is null or age_band in ('age_7', 'age_9')),
  effective_age_band text null
    check (effective_age_band is null or effective_age_band in ('age_7', 'age_9')),
  birth_year int null,
  world_theme text null check (world_theme is null or world_theme in ('fantasy', 'sci-fi')),
  locale text not null default 'es-ES',
  status text not null default 'active'
    check (status in ('active', 'paused', 'deleted')),
  onboarding_step text not null default 'pending_entry'
    check (onboarding_step in (
      'pending_entry', 'choose_world', 'choose_name', 'choose_age',
      'placement', 'complete'
    )),
  placement_status text not null default 'not_started'
    check (placement_status in ('not_started', 'in_progress', 'completed')),
  settings jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_parent_id_idx on public.children (parent_id)
  where status <> 'deleted';
```

| Campo | Quién lo rellena primero |
| --- | --- |
| `display_name` | Niño (diálogo primer acceso) |
| `age_years` / `age_band` | Niño (diálogo); `age_band` derivado de años o elección |
| `effective_age_band` | Sistema tras examen / progresión ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md)) |
| `world_theme` | Niño (diálogo primer acceso) |
| `tutor_label` en settings | Tutor opcional en alta |

**Soft-delete:** `status='deleted'`, `deleted_at=now()`; fuera de listados.

### 3.2 `child_permissions`

Igual que en la propuesta previa (allow_solo_start, PIN, límites, hours, branches, lock_world_theme, font_scale_play, learning_overrides).  
`lock_world_theme` default **true**: una vez elegido el mundo en primer acceso, el niño no lo cambia solo; el tutor puede desbloquear en ficha.

### 3.3 Tablas relacionadas

`child_traits`, y futuras `user_subject_levels`, `placement_exams`, `learning_sessions`, `story_beats` — FK `child_id`, cascada al purge.

---

## 4. Contratos API

### 4.1 Listar — `GET /api/v1/crew`

Incluye `display_name` (nullable), `world_theme` (nullable), `onboarding_step`, `placement_status`, `age_years`, `tutor_label` opcional.

### 4.2 Crear — `POST /api/v1/crew`

Body vacío o `{ "tutor_label": "…" }`. Respuesta DTO completo con permisos.

### 4.3 GET/PATCH perfil / permissions / DELETE / verify-exit-pin

Como en la propuesta previa, con campos nullable y:

- `PATCH` puede corregir `display_name`, `age_years`, `world_theme` (respetando lock) y `character_summary` (solo exploradores; persiste en `child_traits.character_summary`).
- Endpoints de **play/onboarding** (escribir mundo/nombre/edad desde el diálogo) viven en [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md) — autenticados con JWT del **tutor** (el dispositivo está en sesión adulta; el niño no tiene token propio).

### 4.4 apply-defaults

Sin cambios respecto a Ajustes.

---

## 5. Permisos y límites

Sin cambios de catálogo respecto a la propuesta aprobada conceptualmente:

| Clave | Label |
| --- | --- |
| `allow_solo_start` | Puede empezar solo |
| `require_exit_pin` / PIN | Pedir PIN antes de continuar con la aventura |
| `session_limit_per_day` | Sesiones al día |
| `max_session_minutes` | Duración máxima (5–120 min, step 5; UI slider) |
| `allowed_hours` | Horario (Fase B) |
| `can_choose_story_branch` | Elige caminos de historia |
| `lock_world_theme` | Bloquear cambio de mundo |
| `font_scale_play` | Texto en aventuras |

Guardado explícito: «Guardar permisos». Durante el PATCH el botón muestra icono `pending` y «Guardando…»; al terminar, toast de éxito o error ([SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md)).

---

## 5.1 Materias de aprendizaje (por tripulante)

Contrato detallado: [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §3 — **aprobado** 31 jul 2026; **implementación bloqueada** hasta OK del titular.

| Aspecto | Decisión |
| --- | --- |
| Ubicación | Bloque en ficha `#/crew/:id`, entre Permisos y Viaje |
| Campo | `children.settings.learning.active_subjects` (string[]) |
| UI | Checklist agrupada por familia (Fundamentales, Humanidades, Sociedad, Expresión, Vida práctica) |
| Mínimo | ≥1 materia activa |
| Edad | **No** bloquea materias; el tutor puede activar cualquier id del catálogo |
| Dificultad en juego | Siempre según `age_band` del explorador, no según la materia |
| Sugerencia | Al fijar edad en first-run, merge de materias base de banda + defaults del hogar |
| Aviso | Si >10 materias activas: banner «examen largo, reanudable» |
| Guardado | Botón «Guardar materias»; `PATCH` perfil; busy + toast al confirmar |
| Placement en curso | Cambios aplican al siguiente examen o retake confirmado |

**Copy helper en ficha:**

> Las materias activas se usan en el examen de acceso y en la aventura. El nivel de cada reto se adapta a la edad del explorador, no a la materia elegida.

---

## 6. Sincronización con primer acceso

Cuando el play complete pasos ([SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md)):

| Evento play | Efecto en `children` |
| --- | --- |
| Elige mundo | `world_theme` set; `onboarding_step → choose_name` |
| Nombre tripulación | `display_name` set; `→ choose_age` |
| Edad | `age_years` + `age_band` inicial; sugerencia `active_subjects` ([SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §2.1); `→ placement` |
| Examen terminado | `placement_status=completed`; niveles; `effective_age_band`; `onboarding_step=complete` |

La ficha de Tripulación **refleja** esos datos al recargar; no duplica el diálogo.

---

## 7. Pausar y eliminar

- Pausar: no seleccionable para jugar.
- Eliminar: modal con pérdida de progreso, viaje y datos del examen; soft-delete.

---

## 8. Copy (extracto)

| ID | Texto |
| --- | --- |
| `crew.title` | Tripulación |
| `crew.empty` | Tu tripulación espera al primer miembro. |
| `crew.add` | Añadir tripulante (te queda espacio para {n}) |
| `crew.new.title` | Nuevo tripulante |
| `crew.new.body` | El tripulante elegirá mundo, nombre y edad en su primera aventura. Aquí configurarás límites y permisos. |
| `crew.new.confirm` | Crear tripulante |
| `crew.pending` | Pendiente de primera aventura |
| `crew.placeholderName` | Nuevo tripulante |
| `crew.noWorld` | Sin mundo aún |
| `crew.profile.helper` | Estos datos los rellena la aventura la primera vez; puedes corregirlos aquí. |
| `crew.limit` | Has alcanzado el máximo de {n} tripulantes. |
| `crew.delete.title` | ¿Eliminar a {name} de la tripulación? |

---

## 9. Criterios de aceptación (gestión)

1. Alta crea plaza ≤ 10 sin mundo/nombre/edad obligatorios.
2. Lista muestra placeholder y badge pendiente.
3. Ficha permite permisos aunque el perfil narrativo esté vacío.
4. Tras simular/completar first-run (cuando exista), la ficha muestra mundo, nombre y edad.
5. Soft-delete; cupo; PIN hash; apply-defaults; Playwright lista/alta/permisos.
6. Eliminar tripulante abre modal glass de confirmación con aviso de no-undo (no `window.confirm`).

---

## 10. Módulos previstos

`crew.js`, `crew-new.js`, `crew-detail.js`, `crew-api.js`, `CrewController`, `CrewService`, migraciones `children` + `child_permissions`, tests PHPUnit + web + Playwright.

---

## 11. Relación con specs

| Spec | Relación |
| --- | --- |
| SETTINGS | Defaults + resumen |
| PLAY_FIRST_RUN | Rellena perfil |
| ADVENTURE_DIALOGUE | Canal de interacción |
| PLACEMENT_EXAM | Niveles + effective_age_band |
| ADVENTURE_SESSION | Post-examen |
| PROGRESSION_RANKS | Sensación de progreso por mundo |
| CREW_MEMBER_CARDS | Presentación tipo carta TCG en lista y hero ficha |

## Aprobación

- [x] Límite 4; soft-delete; guardado explícito
- [x] Mundo / nombre / edad por el niño en primera aventura
- [x] Alta = plaza + permisos
- [x] Fase B horarios / learning overrides

Siguiente para **esta** sección de gestión: Plan → Implement cuando se encargue. Las specs de play/examen son contrato previo al motor de aventura.
