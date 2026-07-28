# Spec: Sección Ajustes (tutor)

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md), [SPEC_APP_ACCOUNT_SECTION.md](SPEC_APP_ACCOUNT_SECTION.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md), [docs/kidepik.md](../../docs/kidepik.md) §3–9

## Contexto

Tras shell, marco de sección y Cuenta, el ítem del drawer **Ajustes** (`#/settings`) sigue siendo stub. El tutor necesita un panel de **preferencias del adulto** (UI de gestión, tipografía, animaciones, privacidad, defaults del hogar) distinto de:

- **Cuenta** → identidad Google, alias, borrado.
- **Tripulación** → perfiles infantiles, mundo de juego y **permisos por miembro**.

El FAB de tema del shell ya alterna `uiTheme`; Ajustes es el lugar donde ese estado se **explica**, se **edita con contexto** y se **sincroniza** con el servidor.

## Objetivo

Definir la sección **Ajustes** autenticada del tutor:

1. Layout según [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md).
2. Grupos de preferencias del hogar / UI de gestión.
3. Modelo de persistencia `parent_accounts.settings` (jsonb) + sincronía con `localStorage`.
4. Resumen de tripulación con enlaces a Tripulación (sin editar permisos aquí).
5. Reservas claras para aprendizaje, IA y notificaciones cuando existan esas capas.

**No se implementa código de producto hasta aprobación explícita.**

---

## Alcance

### Incluido

| Requisito | Detalle |
| --- | --- |
| Ruta | `#/settings` (deja de ser stub) |
| Guard | Sin sesión → `#/loader` |
| Shell | Montado; drawer «Ajustes» navega aquí |
| Marco | `mountSectionFrame` + contenido de ajustes |
| Tema UI tutor | Control + estado visible; sync bidireccional con FAB shell |
| Tipografía | Presets de tamaño (gestión + reserva aventuras) |
| Animaciones / mundo | Reducir motion, intensidad del fondo |
| Resumen tripulación | Conteo + enlace a `#/crew` (solo lectura de resumen) |
| Defaults del hogar | Plantillas aplicadas al **crear** un miembro (no editan miembros existentes aquí) |
| Privacidad / datos | Enlaces legal; export / retención como contrato (faseable) |
| Avanzado | Versión app, limpiar caché UI local |
| Persistencia | `GET/PATCH /api/v1/parents/me/settings` + `localStorage` inmediato |
| Tema UI | Tipografía/iconos según `uiTheme` sticky |

### Excluido

| Tema | Notas |
| --- | --- |
| Permisos por niño | Solo en [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md) |
| Mundo sci-fi/fantasía del niño | Lo elige el niño en el primer acceso a la aventura ([SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md)); la ficha de Tripulación lo muestra/edita después |
| Edición de perfil infantil | Tripulación |
| HUD de sesión de juego | Distinto del chrome de gestión |
| Co-tutores / multi-adulto | Post-MVP |
| Notificaciones push reales | Reserva de UI; implementación post-MVP |
| Motor IA / cuotas en vivo | Reserva + contrato de datos; wire cuando exista `api_usage` |

---

## Principios

| Principio | Decisión |
| --- | --- |
| Ajustes = tutor | Copy y controles orientados al adulto responsable |
| Tripulación = niños | Cualquier regla por miembro se gestiona allí |
| Defaults ≠ permisos vivos | Los defaults del hogar solo aplican al **alta** de un miembro (salvo «Aplicar a toda la tripulación», que es acción explícita y confirmada) |
| FAB ↔ Ajustes | Misma fuente de verdad de `ui_theme`; cambiar uno actualiza el otro al instante |
| Presets, no sliders continuos | Tamaños de fuente = Normal / Grande / Muy grande (móvil 390×844) |
| Server + local | Escritura optimista en `localStorage`; sync API; conflicto → gana servidor al rehidratar |
| Una columna | Scroll interno del marco; secciones con cabecera sticky opcional |
| Touch ≥ 48 px | Controles, filas, toggles |
| Reduced motion | Respetar OS + override explícito en Ajustes |

---

## Decisiones de producto (aprobadas)

| # | Decisión |
| --- | --- |
| 1 | Ajustes del **tutor**; ajustes del niño en Tripulación por perfil. Resumen de tripulación **sí** en Ajustes. |
| 2 | Tamaños de fuente con **presets** md/lg/xl (factors **1 / 1.12 / 1.24**); no slider continuo. |
| 3 | Permisos de miembros **solo** en Tripulación. |
| 4 | Persistencia en `parent_accounts.settings` jsonb + `localStorage` como caché inmediata. |
| 5 | Horarios / learning overrides de crew y export / uso IA: **Fase B** aceptable. |

---

## 1. Anatomía de la sección

Dentro del marco glass:

```
┌─────────────────────────────────┐
│         [ logo K pequeño ]      │
│─────────────────────────────────│
│  Ajustes                        │  ← título
│  Preferencias de la cuenta      │  ← subtítulo
│  de gestión                     │
│                                 │
│  ── Apariencia ───────────────  │
│  Tema de interfaz               │
│  (○ Fantasía  ● Ciencia ficción)│  ← segmentado + estado
│  [preview tipografía / icono]   │
│                                 │
│  Texto de gestión               │
│  [ Normal | Grande | Muy grande]│
│                                 │
│  Texto de aventuras             │
│  [ Normal | Grande | Muy grande]│  ← afecta sesiones niño
│                                 │
│  Animaciones                    │
│  [✓] Reducir animaciones        │
│  Intensidad del mundo           │
│  [ Tranquilo | Vivo ]           │
│                                 │
│  ── Tripulación (resumen) ────  │
│  N miembros · Ver tripulación → │
│  Defaults al crear miembro …    │
│                                 │
│  ── Aprendizaje (hogar) ──────  │
│  Adaptación por defecto …       │
│  Materias activas por defecto … │
│                                 │
│  ── Historia e IA ────────────  │
│  Creatividad / temas a evitar … │
│  Uso de IA hoy (si disponible)  │
│                                 │
│  ── Privacidad y datos ───────  │
│  Exportar · Retención · Legal   │
│                                 │
│  ── Avanzado ─────────────────  │
│  Versión · Limpiar caché UI     │
└─────────────────────────────────┘
```

Orden vertical fijo. Grupos colapsables (accordion glass) opcionales si la altura supera ~2 viewports; por defecto **Apariencia** y **Tripulación (resumen)** abiertos; el resto colapsado en primer paint móvil.

---

## 2. Grupos de ajustes

### 2.1 Apariencia

#### 2.1.1 Tema de interfaz (`ui_theme`)

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `ui_theme` | enum | `"fantasy"` \| `"sci-fi"` | `"fantasy"` |

**UI:**

- Control segmentado de 2 opciones con labels «Fantasía» / «Ciencia ficción».
- Texto de estado: «Ahora: Fantasía» / «Ahora: Ciencia ficción».
- Helper: «Afecta menús y pantallas de gestión. No cambia el mundo de juego de cada miembro de la tripulación.»
- Mini preview: muestra un icono procedural (`settings` o `home`) + muestra de tipografía display del tema.

**Comportamiento:**

1. Al cambiar → actualizar `document.documentElement.dataset.shellTheme`, regenerar iconos shell, persistir `localStorage` (`kidepik.shell.uiTheme`) **y** `settings.ui_theme` vía API.
2. Si el usuario cambia el FAB del shell estando en otra ruta, al entrar en Ajustes el segmentado refleja el valor actual.
3. No altera capas procedurales del mundo dual ni `children.world_theme`.

#### 2.1.2 Tamaño de texto — gestión (`font_scale_ui`)

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `font_scale_ui` | enum | `"md"` \| `"lg"` \| `"xl"` | `"md"` |

| Preset | Factor CSS aprox. | Uso |
| --- | --- | --- |
| Normal (`md`) | `1` | Baseline actual |
| Grande (`lg`) | `1.12` | Labels, drawer, formularios |
| Muy grande (`xl`) | `1.24` | Accesibilidad tutor |

Aplicar vía `document.documentElement.dataset.fontScaleUi` y tokens CSS `--font-scale-ui`. Afecta chrome de gestión, drawer, marco de sección, legal autenticado tipografía de UI (no el cuerpo legal largo si compromete layout — el cuerpo legal puede usar factor acotado `min(scale, 1.12)`).

**UI:** tres chips/presets exclusivos (radio visual), no range input.

#### 2.1.3 Tamaño de texto — aventuras (`font_scale_play`)

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `font_scale_play` | enum | `"md"` \| `"lg"` \| `"xl"` | `"md"` |

Default del hogar para **sesiones de juego** de cualquier miembro, salvo override por perfil en Tripulación (`children.settings.font_scale_play`).

Helper: «Tamaño de la historia y los retos cuando un explorador juega. Puedes cambiarlo por miembro en Tripulación.»

Hasta que exista HUD de juego, el valor se **persiste** y se documenta; la UI de Ajustes ya lo muestra.

#### 2.1.4 Reducir animaciones (`reduce_motion`)

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `reduce_motion` | enum | `"system"` \| `"always"` \| `"never"` | `"system"` |

| Valor | Efecto |
| --- | --- |
| `system` | Respeta `prefers-reduced-motion` |
| `always` | Fuerza reduced (drawer, bandas, FX mundo acotados) |
| `never` | Animaciones normales salvo que el OS lo imponga de forma inaccesible — **no** anular accesibilidad crítica del navegador; si el OS pide reduce, ganar OS |

**UI:** select o tres presets; label «Animaciones».

#### 2.1.5 Intensidad del mundo (`world_intensity`)

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `world_intensity` | enum | `"calm"` \| `"lively"` | `"lively"` |

| Valor | Efecto (cuando el motor lo consuma) |
| --- | --- |
| `calm` | Menos meteoritos / FX / spawn rate; útil en pantallas de gestión |
| `lively` | Comportamiento actual del loader/mundo |

En fase de implementación temprana: persistir + aplicar flags al session del mundo si ya existen knobs; si no, no-op visual documentado hasta cablear FX.

---

### 2.2 Tripulación (resumen)

Solo lectura + navegación + **defaults de alta**.

#### 2.2.1 Resumen

| Dato | Origen |
| --- | --- |
| Número de miembros | `GET /api/v1/crew` → `members.length` (o endpoint ligero `summary`) |
| CTA | «Ver tripulación» → `#/crew` |
| Estado vacío | «Aún no hay exploradores. Añade el primero en Tripulación.» + mismo CTA |

No listar permisos ni editar niños aquí.

#### 2.2.2 Defaults al crear miembro (`crew_defaults`)

Objeto anidado en `settings`. Se copia al crear un `child` (ver Crew § alta). **No** muta miembros existentes salvo acción «Aplicar a toda la tripulación».

| Campo | Tipo | Valores | Default | Notas |
| --- | --- | --- | --- | --- |
| `crew_defaults.session_limit_per_day` | int \| null | `1`–`6` o `null` | `3` | `null` = sin límite |
| `crew_defaults.max_session_minutes` | int | 5–120, múltiplos de 5 | `10` | Tope por sesión (UI: slider) |
| `crew_defaults.require_exit_pin` | bool | | `false` | PIN para salir a gestión |
| `crew_defaults.allow_solo_start` | bool | | `true` | Iniciar aventura sin PIN de entrada |
| `crew_defaults.lock_world_theme` | bool | | `true` | Bloquear cambio de mundo tras alta |
| `crew_defaults.font_scale_play` | enum | md/lg/xl | hereda `font_scale_play` del hogar | Override inicial |

**UI:** formulario compacto bajo el resumen + botón secundario «Aplicar estos defaults a toda la tripulación» → modal de confirmación (lista de campos que se sobrescribirán) → `POST /api/v1/crew/apply-defaults`.

---

### 2.3 Aprendizaje (hogar)

Defaults pedagógicos del hogar. Overrides por niño en Tripulación cuando existan.

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `learning.adaptation_policy` | enum | `"balanced"` \| `"easier"` \| `"harder"` | `"balanced"` |
| `learning.active_subjects` | string[] | ids de catálogo (`math`, `language`, `science`, `logic`, …) | todos los del MVP curricular |
| `learning.show_levels_to_child` | bool | | `false` | Alineado con doc: sin puntuación numérica al niño |
| `learning.pause_adaptation` | bool | | `false` | Congela `difficulty_modifier` por defecto |

**UI:**

- Adaptación: tres presets con helper pedagógico corto.
- Materias: checklist; al menos **una** debe quedar activa (validación 422).
- Toggles de visibilidad / pausa con helpers.

Hasta existir motor de sesiones: **persistir** y exponer en API; sin efecto en juego aún.

---

### 2.4 Historia e IA

| Campo | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `narrative.creativity` | enum | `"conservative"` \| `"balanced"` | `"balanced"` |
| `narrative.avoid_themes` | string[] | ids controlados (ver tabla) | `[]` |
| `narrative.resume_mode` | enum | `"continue"` \| `"recap"` | `"continue"` |

**Temas evitables (catálogo cerrado):**

| id | Label UI |
| --- | --- |
| `fear` | Miedo intenso |
| `darkness` | Oscuridad / sombras amenazantes |
| `conflict` | Conflictos entre personajes |
| `peril` | Peligro físico explícito |

**Uso de IA hoy (solo lectura cuando exista backend):**

- Texto: «Hoy se han usado X de Y generaciones narrativas» o «Sin datos aún».
- Fuente: `GET /api/v1/parents/me/usage` (*futuro*); si 404/501, ocultar bloque o mostrar «Próximamente».

Helper global: «Estas preferencias guiarán la historia cuando el motor narrativo esté activo.»

---

### 2.5 Privacidad y datos

| Control | Comportamiento |
| --- | --- |
| Exportar datos del hogar | CTA → inicia export (JSON) vía `POST /api/v1/parents/me/export` (*faseable*); descarga o email cuando esté listo |
| Retención narrativo | Select: `full` \| `days_30` \| `days_90` → `privacy.story_retention` |
| Términos | Navega `#/legal/terminos` (sesión autenticada) |
| Privacidad | Navega `#/legal/privacidad` |
| Telemetría | Toggle `privacy.analytics_opt_in` default `false` |

Export y retención pueden implementarse en una tarea posterior **dentro** de esta spec (criterios de aceptación marcados como fase B); la UI puede mostrar «Próximamente» deshabilitado hasta el endpoint.

---

### 2.6 Avanzado

| Control | Comportamiento |
| --- | --- |
| Versión | Mostrar versión web (`import.meta` / `APP_VERSION` inyectado) + build hash corto si existe |
| Limpiar caché UI | Borra keys `localStorage` de preferencias UI **excepto** sesión auth; rehidrata desde servidor; toast «Caché local limpiada» |
| Diagnóstico | Solo builds no-prod: flag `?debug=1` o menú oculto — fuera de UI producción |

No incluir «Cerrar sesión» ni «Eliminar cuenta» (viven en drawer / Cuenta).

---

## 3. Modelo de datos

### 3.1 Columna

Migración nueva:

```sql
alter table public.parent_accounts
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.parent_accounts.settings is
  'Preferencias del tutor / hogar (ui_theme, tipografía, defaults crew, etc.)';
```

### 3.2 Schema JSON (`ParentSettings`)

```ts
type FontScale = "md" | "lg" | "xl";
type UiTheme = "fantasy" | "sci-fi";

interface ParentSettings {
  ui_theme: UiTheme;
  font_scale_ui: FontScale;
  font_scale_play: FontScale;
  reduce_motion: "system" | "always" | "never";
  world_intensity: "calm" | "lively";
  crew_defaults: {
    session_limit_per_day: number | null;
    max_session_minutes: number; // 5–120, step 5
    require_exit_pin: boolean;
    allow_solo_start: boolean;
    lock_world_theme: boolean;
    font_scale_play: FontScale;
  };
  learning: {
    adaptation_policy: "balanced" | "easier" | "harder";
    active_subjects: string[];
    show_levels_to_child: boolean;
    pause_adaptation: boolean;
  };
  narrative: {
    creativity: "conservative" | "balanced";
    avoid_themes: string[];
    resume_mode: "continue" | "recap";
  };
  privacy: {
    story_retention: "full" | "days_30" | "days_90";
    analytics_opt_in: boolean;
  };
  schema_version: 1;
}
```

**Merge:** al leer, el servidor (o cliente) aplica defaults sobre `{}` / claves ausentes → DTO siempre completo. `schema_version` permite migraciones futuras de forma.

### 3.3 localStorage

| Key | Contenido |
| --- | --- |
| `kidepik.shell.uiTheme` | Espejo de `ui_theme` (compat shell actual) |
| `kidepik.parent.settings` | Caché JSON completo (opcional; puede ser solo subset UI) |

Regla: al boot autenticado, `GET settings` → sobrescribe local. Escrituras UI → local inmediato + PATCH debounce **400 ms**.

---

## 4. Contratos API

### 4.1 Leer ajustes

`GET /api/v1/parents/me/settings`

**Auth:** Bearer JWT.

**Response 200:**

```json
{
  "settings": { "...ParentSettings...": true },
  "crew_summary": {
    "member_count": 2
  }
}
```

`crew_summary` puede omitirse si aún no existe tabla crew; entonces `member_count: 0`.

### 4.2 Actualizar ajustes (parcial)

`PATCH /api/v1/parents/me/settings`

**Body:** objeto parcial deep-merge (JSON Merge Patch semántico en servidor).

```json
{
  "ui_theme": "sci-fi",
  "font_scale_ui": "lg",
  "crew_defaults": { "max_session_minutes": 15 }
}
```

**Response 200:** settings completos tras merge + validación.

**Errores:**

| Código | Cuándo |
| --- | --- |
| 401 | Sin JWT |
| 422 | Enum inválido, materias vacías, minutos fuera de set |
| 503 / 500 | Infra |

### 4.3 Aplicar defaults a tripulación

`POST /api/v1/crew/apply-defaults`

**Body:**

```json
{ "confirm": true }
```

Copia `settings.crew_defaults` → cada `children.settings` / columnas de permisos (ver Crew). Requiere `confirm: true`.

**Response 200:** `{ "updated": N }`.

### 4.4 Export (fase B)

`POST /api/v1/parents/me/export` → 202 + job id, o 200 + attachment si síncrono y pequeño.

---

## 5. Copy (español de España)

| ID | Texto |
| --- | --- |
| `settings.title` | Ajustes |
| `settings.subtitle` | Preferencias de la cuenta de gestión |
| `settings.appearance` | Apariencia |
| `settings.theme.label` | Tema de interfaz |
| `settings.theme.helper` | Afecta menús y pantallas de gestión. No cambia el mundo de juego de cada miembro. |
| `settings.theme.fantasy` | Fantasía |
| `settings.theme.scifi` | Ciencia ficción |
| `settings.theme.now` | Ahora: {theme} |
| `settings.fontUi.label` | Texto de gestión |
| `settings.fontPlay.label` | Texto de aventuras |
| `settings.font.helperPlay` | Tamaño de la historia y los retos. Puedes cambiarlo por miembro en Tripulación. |
| `settings.font.md` | Normal |
| `settings.font.lg` | Grande |
| `settings.font.xl` | Muy grande |
| `settings.motion.label` | Animaciones |
| `settings.motion.system` | Como el sistema |
| `settings.motion.always` | Reducir siempre |
| `settings.motion.never` | Completas |
| `settings.world.label` | Intensidad del mundo |
| `settings.world.calm` | Tranquilo |
| `settings.world.lively` | Vivo |
| `settings.crew.summary` | Tripulación |
| `settings.crew.count` | {n} miembros |
| `settings.crew.empty` | Aún no hay exploradores. |
| `settings.crew.cta` | Ver tripulación |
| `settings.crew.defaults` | Valores por defecto al crear un miembro |
| `settings.crew.applyAll` | Aplicar estos defaults a toda la tripulación |
| `settings.crew.apply.title` | ¿Aplicar a toda la tripulación? |
| `settings.crew.apply.body` | Se sobrescribirán los límites y permisos básicos de todos los miembros con estos valores. |
| `settings.crew.apply.confirm` | Aplicar |
| `settings.crew.apply.cancel` | Cancelar |
| `settings.learning` | Aprendizaje |
| `settings.narrative` | Historia e IA |
| `settings.privacy` | Privacidad y datos |
| `settings.advanced` | Avanzado |
| `settings.cache.clear` | Limpiar caché de interfaz |
| `settings.cache.done` | Caché local limpiada |
| `settings.save.error` | No hemos podido guardar los ajustes. Inténtalo de nuevo. |
| `settings.load.error` | No hemos podido cargar los ajustes. |
| `settings.retry` | Reintentar |

---

## 6. Estilos e interacción

| Elemento | Spec |
| --- | --- |
| Cabeceras de grupo | Display font según `uiTheme`; tracking coherente shell |
| Segmentados / presets | Glass chips; selected = fondo `rgba(255,255,255,0.28)` + borde más opaco |
| Toggles | Hit ≥ 48 px; estado visible |
| Preview tema | Caja glass ~64–80 px con icono procedural regenerado al flip |
| Modales | Mismo patrón que borrado de cuenta (scrim + glass) |
| Toast / saved | Feedback breve ≤ 2 s tras PATCH OK (o indicador «Guardado» discreto) |
| Debounce | 400 ms en PATCH; flush al salir de la sección |

Motion: cambios de tema ≤ 200 ms; reduced-motion = instantáneo.

---

## 7. Módulos previstos

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/scenes/settings.js` | Escena `#/settings` |
| `web/js/components/settings-panel.js` | UI de grupos |
| `web/js/lib/parent-settings.js` | get/patch, merge local, debounce |
| `web/js/lib/shell-theme.js` | Extender: leer/escribir también desde settings API |
| `web/css/scenes/settings.css` | Estilos del panel |
| `api/src/Controllers/ParentSettingsController.php` | GET/PATCH settings |
| `api/src/Services/ParentSettingsService.php` | Merge, validate, defaults |
| `api/tests/ParentSettingsTest.php` | PHPUnit |
| `web/tests/parent-settings.test.js` | Merge, validación, debounce |
| `supabase/migrations/YYYYMMDDHHMMSS_parent_accounts_settings.sql` | Columna jsonb |

Router shell: registrar ruta real; drawer `settings` deja de ser stub.

---

## 8. Criterios de aceptación

### Fase A (núcleo UI + persistencia)

1. Con sesión, drawer «Ajustes» → `#/settings` con bandas compactas + marco glass + logo.
2. Tema segmentado refleja y cambia `uiTheme`; FAB shell se actualiza al instante y viceversa.
3. Helper aclara que no cambia el mundo del niño.
4. Presets de `font_scale_ui` aplican factor CSS en UI de gestión.
5. `font_scale_play`, motion, world_intensity, learning, narrative, privacy se guardan en jsonb aunque algunas no tengan efecto de juego aún.
6. Resumen muestra `member_count` (0 si no hay crew) y CTA a `#/crew`.
7. Defaults `crew_defaults` editables y persistidos.
8. Sin sesión, `#/settings` → loader.
9. Playwright 390×844: feliz (cambiar tema + preset fuente) + borde (PATCH 422 / offline + reintentar); capturas `tmp/playwright-output/settings-*.png`.

### Fase B (ampliaciones)

10. «Aplicar a toda la tripulación» con confirmación actualiza N miembros.
11. Export de datos (o CTA deshabilitado «Próximamente» documentado hasta endpoint).
12. Bloque uso IA si endpoint disponible; si no, oculto o «Próximamente».

---

## 9. Tests

| Capa | Casos |
| --- | --- |
| PHPUnit | GET settings merge defaults; PATCH parcial; 422 enums; 401 |
| PHPUnit | apply-defaults requiere confirm y actualiza N |
| Web unit | deep merge, debounce, espejo uiTheme ↔ localStorage |
| Playwright | §8 |

---

## 10. Relación con specs existentes

| Spec | Relación |
| --- | --- |
| SPEC_APP_SECTION_FRAME | Layout obligatorio |
| SPEC_APP_SHELL_CHROME | FAB tema + ítem drawer; stub → real |
| SPEC_APP_ACCOUNT_SECTION | Cuenta ≠ Ajustes; settings jsonb reservado allí se concreta aquí |
| SPEC_APP_CREW_SECTION | Resumen + defaults; permisos viven en Crew |
| docs/kidepik.md | Pedagogía, narrativa, límites IA |

---

## 11. Fases de implementación sugeridas (post-aprobación)

| Fase | Contenido |
| --- | --- |
| A1 | Migración `settings`, GET/PATCH, escena Apariencia (tema + fonts + motion) |
| A2 | Resumen crew + crew_defaults UI |
| A3 | Learning + narrative + privacy UI (persistencia) |
| B1 | apply-defaults + wire world_intensity / font_scale_play en juego |
| B2 | Export + usage IA |

---

## 12. Decisiones confirmadas

- [x] Anatomía y grupos §1–2
- [x] Presets de fuente (md/lg/xl) y factors 1 / 1.12 / 1.24
- [x] `reduce_motion`: system / always / never
- [x] Defaults de tripulación en Ajustes; permisos vivos solo en Crew
- [x] Deep-merge PATCH + debounce 400 ms
- [x] Export / usage IA como Fase B
- [x] Catálogo cerrado `avoid_themes`

## Aprobación

- [x] Usuario aprueba alcance tutor vs tripulación
- [x] Usuario aprueba modelo `ParentSettings` y APIs
- [x] Usuario aprueba copy y anatomía
- [x] Usuario aprueba fases A/B

Siguiente: Plan → Task → Implement (TDD) → Validate Playwright. **No implementar hasta plan acordado en el flujo SDD del encargo concreto.**
