# Spec: Primer acceso a la aventura (onboarding del explorador)

> Estado: **aprobada como contrato de producto** (julio 2026) — **delta propuesto** (personaje) pendiente de re-aprobación; **sin implementación** hasta Plan de play  
> Relacionado: [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [docs/kidepik.md](../../docs/kidepik.md) §5–6

## Contexto

Tras crear una **plaza** en Tripulación, el perfil narrativo está vacío. La primera vez que ese miembro **entra en su aventura**, un agente de IA da la bienvenida y recoge, en diálogo:

1. Mundo: **Ciencia ficción** o **Fantasía**
2. **Nombre de tripulación**
3. **Edad**
4. **Personaje** (rasgos textuales con ayuda IA) — [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md)
5. Luego el **examen de conocimientos** ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md))
6. Tras el examen, comienza la aventura propiamente dicha ([SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md))

En las entradas siguientes, si `onboarding_step === 'complete'`, se salta este flujo y se va a la sesión de aventura (o se reanuda placement si quedó a medias).

## Objetivo

Definir el flujo `flow_id = "first_run"`: pasos, persistencia en `children`, adaptación visual tras elegir mundo, y handoff al examen.

## Principios

| Principio | Decisión |
| --- | --- |
| El niño elige el mundo | El tutor no lo fija en el alta |
| Datos al perfil | Cada paso confirma y **escribe** en `children` |
| Una cosa por paso | No mezclar mundo + nombre en el mismo turno de decisión |
| Reanudable | Si corta a mitad, al volver sigue en `onboarding_step` |
| Sin puntuación visible | El examen posterior no muestra “nota” al niño |

---

## 1. Entrada a play

### 1.1 Ruta

`#/play/:childId`

Guards:

- Sesión tutor válida.
- Child pertenece al padre; `status === 'active'`.
- Permisos: horario, cupo diario, `allow_solo_start` / supervisión según spec de sesión.
- Si `onboarding_step !== 'complete'` → motor diálogo `first_run` (y luego `placement` si aplica).
- Si completo → `adventure` session.

### 1.2 Chrome

Distinto del shell de gestión: sin drawer de tutor; salir con PIN si aplica; indicador de mundo cuando exista.

---

## 2. Máquina de estados (`onboarding_step`)

```
pending_entry
    → (abre play) → choose_world
choose_world
    → (mundo persistido) → choose_name
choose_name
    → (display_name) → choose_age
choose_age
    → (age_years + age_band) → choose_gender
choose_gender
    → (explorer_gender) → choose_character
choose_character
    → (traits persistidos) → placement
placement
    → (examen OK) → complete
complete
    → handoff adventure
```

| Paso | `onboarding_step` | Qué pide el agente | Effect |
| --- | --- | --- | --- |
| Bienvenida | `pending_entry` → `choose_world` | Saludo; presenta la aventura | `advance_onboarding` |
| Mundo | `choose_world` | Elige CF o Fantasía (opciones claras) | `set_world_theme` + advance |
| Nombre | `choose_name` | Nombre de tripulación | `set_display_name` + advance |
| Edad | `choose_age` | Edad (opciones por rangos y/o texto numérico) | `set_age` + advance |
| Sexo | `choose_gender` | Chico/chica o hombre/mujer según edad ([SPEC_APP_EXPLORER_GENDER.md](SPEC_APP_EXPLORER_GENDER.md)) | `set_explorer_gender` + advance |
| Personaje | `choose_character` | Co-crea especie/color/rasgos ([SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md)) | `set_traits` + advance |
| Examen | `placement` | Delega en flow `placement` | ver exam spec |
| Listo | `complete` | Cierre narrativo breve | handoff |

---

## 3. Paso a paso (contenido)

### 3.1 Bienvenida

- Tono cálido, lenguaje 7–9 años, sin jerga técnica.
- Explica que va a elegir **cómo será su mundo**, su **nombre de explorador** y que habrá una **prueba de ingreso** contada como parte de la historia (academia / escuela según mundo — el marco concreto se fija **después** de elegir mundo).
- CTA Continuar → `choose_world`.

### 3.2 Elección de mundo

**Opciones canónicas (ids estables):**

| option_id | Label niño |
| --- | --- |
| `sci-fi` | Ciencia ficción |
| `fantasy` | Fantasía |

Cada opción incluye `description` breve (1–2 líneas) evocando el mundo — nave/galaxia vs reinos/magia — alineado a [docs/kidepik.md](../../docs/kidepik.md) §5. La UI muestra las descripciones **bajo la burbuja de bienvenida** (`.play-world-hints`); en el pie solo aparecen chips con el nombre del mundo.

Copy canónico (servidor):

| option_id | description |
| --- | --- |
| `sci-fi` | Naves, planetas y galaxias: serás cadete explorador en una misión por las estrellas. |
| `fantasy` | Magia, reinos y artefactos: tu camino pasa por bosques, montañas y castillos. |

Copy de apoyo (agente): breve evocación de cada mundo (nave/galaxia vs reinos/magia), alineado a [docs/kidepik.md](../../docs/kidepik.md) §5.

**Tras elegir:**

1. Persistir `children.world_theme`.
2. Cliente aplica tipografía + iconos del mundo ([SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) §1.2).
3. Turnos siguientes usan tono del mundo (cadete vs aprendiz).
4. `onboarding_step = choose_name`.
5. Si `lock_world_theme` (default), el niño no vuelve a este paso salvo reset tutor; al elegir mundo se fuerza `lock_world_theme` en permisos.

### 3.3 Nombre de tripulación

- Pregunta: cómo quiere que le llamen en la aventura.
- `input_mode`: `options_or_text` (sugerencias temáticas 2–3 según mundo si el texto libre no contiene un nombre claro).
- **Extracción inteligente:** si el niño escribe un párrafo («Quiero que mi personaje se llame: Vatardar…»), el servidor usa `DisplayNameExtractor` (`shared/Text/DisplayNameExtractor.php`) para localizar el nombre; si no hay candidato válido, repregunta con chips sin error crudo `display_name invalid`.
- Validación servidor: 1–24 caracteres; letras, números, espacios, apóstrofe y guión.
- Persistir `display_name`.
- Confirmación narrativa: «Encantado, {name}.»
- Errores de validación en cliente: toast glass ([SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md)), no texto inline en el log.

**Tras elegir mundo (§3.2):**

6. `lock_world_theme = true` en permisos (default ya true); ficha Tripulación muestra mundo en solo lectura hasta que el tutor desbloquee el checkbox «Bloquear cambio de mundo».

### 3.4 Edad

- Pregunta la edad.
- Preferible: opciones por **rangos de banda** + texto numérico libre.
- Persistir `age_years` (5–99).
- Derivar `age_band` según [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md) (no solo age_7/age_9).
- `effective_age_band` inicial = `age_band` (placement/rendimiento pueden ajustarla ±1 banda).
- Advance → `choose_gender`.

### 3.5 Sexo del explorador

- Detalle completo: [SPEC_APP_EXPLORER_GENDER.md](SPEC_APP_EXPLORER_GENDER.md).
- Tras edad: pregunta binaria (chico/chica o hombre/mujer según `age_band`).
- `input_mode`: `options_only` (2 chips).
- Persistir `explorer_gender` (`male` \| `female`).
- Advance → `choose_character`.

### 3.6 Personaje (rasgos)

- Tras edad, el coach de personaje co-crea la ficha textual (especie, color, rasgos) ya en el tono del mundo.
- Detalle completo: [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md).
- Sin traits válidos **no** se avanza a placement.

### 3.7 Handoff a examen

- El agente enmarca el examen como prueba de ingreso (Academia Espacial / Escuela de Magos / variante según mundo y traits).
- Abre o continúa `flow_id = "placement"` sin salir de la escena de diálogo.
- No mostrar “vas a hacer un test”.

### 3.8 Cierre first-run tras examen

- Mensaje narrativo de admisión (sin nota numérica).
- `onboarding_step = complete`.
- Transición a [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md).

---

## 4. Entradas siguientes (no primer acceso)

| Situación | Comportamiento |
| --- | --- |
| `onboarding_step` a mitad | Reanudar diálogo en ese paso (mismo session/flow) |
| `placement` a medias | Reanudar examen |
| `complete` | Ir a aventura; saludo breve opcional («¡Hola de nuevo, Nora!») |

---

## 5. API específica (además del diálogo genérico)

Los effects del diálogo bastan si el servicio de play aplica:

```ts
set_world_theme: "fantasy" | "sci-fi"
set_display_name: string
set_age: { age_years: number; age_band: AgeBand }  // SPEC_APP_AGE_BANDS
set_explorer_gender: "male" | "female"  // SPEC_APP_EXPLORER_GENDER
set_traits: { species: string; palette: string; features: string[]; vibe?: string }
set_mentor: { mentor_id: string }  // al fijar world_theme
advance_onboarding: OnboardingStep
```

Tras `set_world_theme`, el servidor asigna `mentor_id` canónico ([SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md)) y el host neutro cede la voz.
Endpoint de conveniencia opcional (tests / tutor force):

`POST /api/v1/play/{childId}/onboarding/reset` — solo tutor, confirmación; vuelve a `pending_entry` y limpia mundo/nombre/edad/placement **con warning** (spec destructiva; Fase B).

---

## 6. Reflejo en Tripulación

La ficha del tutor debe mostrar al refrescar:

- Nombre, edad, mundo.
- Badge de paso si incompleto.
- Niveles tras examen (cuando existan en DTO).

El tutor **puede corregir** nombre/edad/mundo (con unlock) sin rehacer el diálogo; eso no regenera el historial narrativo automáticamente (nota en UI).

---

## 7. Criterios de aceptación

1. Plaza nueva → play → bienvenida → elige fantasía → UI pasa a tipografía fantasy.
2. Nombre y edad persisten en `GET /api/v1/crew/{id}`.
3. Tras edad, entra flow placement sin romper escena.
4. Cortar app a mitad y volver reanuda el paso.
5. Segundo acceso con `complete` no repite elección de mundo.
6. Playwright (cuando exista play): flujo feliz first-run hasta handoff examen (mock LLM).

## Aprobación

- [x] Mundo elegido por el niño en primera aventura
- [x] Orden original: bienvenida → mundo → nombre → edad → examen → aventura
- [x] **Delta:** `choose_gender` entre edad y personaje ([SPEC_APP_EXPLORER_GENDER.md](SPEC_APP_EXPLORER_GENDER.md))
- [ ] **Delta:** insertar `choose_character` entre género y examen ([SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md))
- [ ] **Delta:** edades abiertas + bandas ([SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md))
- [ ] **Delta:** voz mentor canónico post-mundo ([SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md))
- [x] Persistencia en perfil del tripulante
- [x] Adaptación tipografía/iconos/tono al mundo
