# Spec: Sexo del explorador (first-run + ficha tutor)

> Estado: **implementada** (ago 2026)  
> Relacionado: [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_AI_JOURNEY_FILE_LEDGER.md](SPEC_AI_JOURNEY_FILE_LEDGER.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md)

## Contexto

El mentor habla en segunda y tercera persona sobre el tripulante («eres el explorador…», «{name} está lista»). En español eso exige concordancia de género. Hoy el sistema asume masculino («explorador», «listo», «bienvenido») porque no hay dato de sexo en `children` ni en `PlayerState`.

La edad ya está disponible al final de `choose_age`; sirve para formular la pregunta con registro adecuado (chico/chica vs hombre/mujer) sin infantilizar a adultos ([SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md)).

## Objetivo

1. Recoger sexo declarado del tripulante en diálogo, **justo después de la edad**.
2. Persistir en Postgres y reflejar en `traveler.md` / `PlayerState`.
3. Inyectar reglas de concordancia al mentor y agentes posteriores.
4. Mostrar en la **ficha tutor** y permitir corrección con `PATCH`.

## Alcance POC

| Incluido | Excluido (futuro) |
| --- | --- |
| Paso `choose_gender` en first-run | Identidades no binarias / «prefiero no decir» |
| Valores `male` \| `female` | Pronombres neutros (`elle`) |
| Copy por `age_band` | Avatar visual por género |
| Chips `options_only` | Inferencia por nombre |
| Legacy sin dato → tratar como `male` | Repregunta automática a legacy en play |
| Ficha tutor: ver y editar | — |

---

## 1. Máquina de estados (delta first-run)

```
… → choose_age → choose_gender → choose_character → placement → complete
```

| Paso | `onboarding_step` | Effect principal |
| --- | --- | --- |
| Edad | `choose_age` | `set_age` → advance a `choose_gender` |
| **Sexo** | **`choose_gender`** | **`set_explorer_gender`** → advance a `choose_character` |
| Personaje | `choose_character` | `set_traits` (sin cambio) |

Actualizar diagrama `11-child-adventure-pipeline.md` al implementar.

---

## 2. Modelo de datos

```sql
-- Migración: public.children
explorer_gender text null
  check (explorer_gender is null or explorer_gender in ('male', 'female'));
```

Añadir `'choose_gender'` al check de `onboarding_step`.

```ts
type ExplorerGender = "male" | "female";

// Effect de diálogo
set_explorer_gender: ExplorerGender
```

### 2.1 Resolución efectiva (runtime)

| `explorer_gender` en BD | Valor usado por IA / copy |
| --- | --- |
| `male` | `male` |
| `female` | `female` |
| `null` (legacy) | **`male`** (decisión POC; no repreguntar en play) |

Función canónica: `resolve_explorer_gender(child) → "male" | "female"`.

### 2.2 `traveler.md` (front matter YAML)

```yaml
explorer_gender: female   # siempre valor resuelto (nunca null en fichero)
```

---

## 3. Copy adaptado por edad

El servidor fija chips y plantilla base; el LLM puede envolverla en prosa del mundo sin cambiar el significado.

### 3.1 Matriz por `age_band`

Tres **modos de enmarcado** (escalera de copy); la pregunta canónica es la que el servidor inyecta al mentor — el LLM solo puede añadir saludo o marco del mundo sin cambiar el significado ni los chips.

| Modo | Bandas | Idea |
| --- | --- | --- |
| **Aventura** | `band_early`, `band_child` | «En la aventura…» — corto, concreto, sin sonar a formulario |
| **Propósito narrativo** | `band_tween` | Explica *para qué* (contar la historia bien) |
| **Trato / autonomía** | `band_teen` … `band_senior` | «Prefieres que te trate de…» — respetuoso; hombre/mujer desde 18 |

| `age_band` | Edad | Pregunta canónica | Chips (`option_id` → label) |
| --- | --- | --- | --- |
| `band_early` | 5–7 | «En la aventura, ¿**chico** o **chica**?» | `male`→Chico · `female`→Chica |
| `band_child` | 8–10 | «En la aventura, ¿eres **chico** o **chica**?» | Chico · Chica |
| `band_tween` | 11–13 | «Para contarte la aventura como toca, ¿eres **chico** o **chica**?» | Chico · Chica |
| `band_teen` | 14–17 | «¿Prefieres que te trate de **chico** o de **chica**?» | Chico · Chica |
| `band_adult` | 18–64 | «¿Prefieres que te trate de **hombre** o de **mujer**?» | `male`→Hombre · `female`→Mujer |
| `band_senior` | 65–99 | Igual que `band_adult` | Hombre · Mujer |

Tono sci-fi vs fantasy: misma pregunta canónica; el mentor añade marco («cadete», «aprendiz») **antes o después**, sin sustituir la pregunta ni los labels de chip.

#### 3.1.1 Por banda — qué evitar y por qué

| Banda | Evitar | Por qué la canónica |
| --- | --- | --- |
| `band_early` | «¿Eres un niño o una niña?» (largo); «identificas» | Lectura en voz alta: mínimas palabras; «aventura» sitúa el juego |
| `band_child` | Repetir solo «¿chico o chica?» sin marco | A los 8–10 el marco narrativo sigue ayudando; una frase más que early |
| `band_tween` | «¿Te identificas como…?» | Suena a formulario; el **propósito** («contarte como toca») basta |
| `band_teen` | «¿Eres chico o chica?» a secas | Infantiliza; el marco de **trato** encaja con el mentor en 2.ª persona |
| `band_adult` | «¿Eres hombre o mujer?» a secas | Parece censo; paralelo con teen mantiene coherencia de producto |
| `band_senior` | Tuteo condescendiente o «¿Es usted…?» en la pregunta | Misma pregunta que adulto; el **tono** (paciente, claro) va en la prosa del mentor, no en cambiar a usted ni acortar chips |

Variantes aceptables si el LLM envuelve en prosa (mismo significado, mismos chips):

- Early fantasy: «Antes de seguir, en la aventura: ¿chico o chica?»
- Child sci-fi: «Cadete, en la misión: ¿eres chico o chica?»
- Tween sci-fi: «Para orientar la misión: ¿chico o chica?» (equivale a la canónica tween)
- Senior: no acortar a «¿Hombre o mujer?» sin marco de trato — pierde el patrón 14+

**Prohibido en cualquier banda:** cambiar chips a roles narrativos («explorador / exploradora», «aprendiz / aprendiza») — los ids siguen siendo `male` / `female`.

### 3.2 Reglas de redacción

- Frases cortas en `band_early` / `band_child` (skill `audience-language`).
- **No** usar la palabra «sexo» ni «identificas» en la burbuja.
- Tras elegir, confirmación breve con concordancia:
  - `female`, 6 años: «Vale. **Chica** en la aventura. ¡Seguimos!»
  - `male`, 8 años: «Perfecto, {name}. **Listo** para seguir.»
  - `female`, 12 años: «Genial. **Lista** — sigamos con tu personaje.»
  - `male`, 16 años: «De acuerdo. Te hablaré en masculino. Vamos con tu personaje.»
  - `female`, 35 años: «Perfecto. Te trataré en femenino. Siguiente paso: tu personaje.»
  - `male`, 70 años: «De acuerdo. Seguimos con tu personaje.» (tono claro; sin infantilizar)
- El turno `choose_character` recibe `explorer_gender` ya resuelto en contexto.

### 3.3 `input_mode`

| Fase (`meta.phase`) | `input_mode` |
| --- | --- |
| `choose_gender` | `options_only` — exactamente 2 opciones; sin texto libre ni `continue` |

Actualizar skill `backend/skills/onboarding-flow/SKILL.md`.

---

## 4. Uso en IA (concordancia)

### 4.1 `PlayerState` (delta SPEC_AI_PLAY_ORCHESTRATION)

```ts
child: {
  // …existente…
  explorer_gender: "male" | "female";  // siempre resuelto (legacy → male)
}
```

### 4.2 Bloque de prompt

```
explorer_gender: female
Reglas ES: segunda persona femenina (exploradora, lista, bienvenida);
tercera persona femenina si hablas de {display_name}.
No uses formas masculinas por defecto.
```

Valores `male`: simétrico con masculino.

### 4.3 Skills afectadas

| Skill | Delta |
| --- | --- |
| `audience-language` | § concordancia de género |
| `mentor-prose-clarity` | Formas acordes a `explorer_gender` |
| `character-traits` | «Eres una…» / «Eres un…» según género |
| `onboarding-flow` | Fila `choose_gender` |

### 4.4 Validación post-LLM (Fase B, opcional)

Heurística en `mentor_prose`: si `explorer_gender=female` y segunda persona usa «explorador» sin «exploradora» → warning / re-prompt.

---

## 5. API y diálogo

**Tras `set_age`:** avanzar a `choose_gender` (no directamente a `choose_character`).

**Fase `_phase_choose_gender`:**

- Acepta solo `option_id` `male` | `female`.
- Texto libre u opción inválida → repregunta amable (mismas 2 chips).
- Persiste `explorer_gender`.
- Effects: `set_explorer_gender`, `advance_onboarding` → `choose_character`.
- Genera turno mentor hacia `choose_character_species`.

**DTO crew** (`GET /api/v1/crew/{id}`): `explorer_gender: "male" | "female" | null` (valor crudo de BD).

**PATCH tutor** (`PATCH /api/v1/crew/{id}`): body `{ "explorer_gender": "male" | "female" }`; validación enum; no regenera historial narrativo.

---

## 6. UI tutor (ficha tripulante)

Superficie: pestaña **Viaje** de `#/crew/:id` ([SPEC_APP_CREW_MEMBER_DETAIL.md](SPEC_APP_CREW_MEMBER_DETAIL.md) §2.1 Identidad).

| Campo UI | Valor mostrado | Editable |
| --- | --- | --- |
| Sexo | «Chico» / «Chica» si `age_years` ≤ 17; «Hombre» / «Mujer» si ≥ 18; «—» si edad null y género null | Sí |
| Legacy `null` en BD | Mostrar **«Chico»** (equivale a `male` resuelto) | Sí — al guardar persiste `male` o `female` explícito |

Control: select glass o par de chips (`Chico`/`Chica` o `Hombre`/`Mujer` según edad del miembro).

**Línea de tipo** (lista + hero carta): incluir género cuando exista edad, p. ej. «Fantasía · Chica · 8 años».

Guardado: `runGlassButtonAction` + `showGlassToast` ([SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md)).

---

## 7. Rebobinado debug

[SPEC_APP_DEBUG_JOURNEY_REWIND.md](SPEC_APP_DEBUG_JOURNEY_REWIND.md): insertar `choose_gender` entre `choose_age` y `choose_character`; al rebobinar antes de este turno, `explorer_gender = null` en BD (en play siguiente se resolverá como `male` hasta que el explorador o tutor fije valor).

---

## 8. Reset onboarding tutor

`POST …/onboarding/reset` limpia `explorer_gender` junto con mundo, nombre y edad.

---

## 9. Criterios de aceptación

1. Tras edad 8, pregunta chico/chica con 2 chips; sin campo de texto.
2. Elegir «Chica» persiste `explorer_gender=female` en API.
3. Turno de personaje usa concordancia femenina en prosa (test con stub o LLM).
4. Edad 30 → pregunta hombre/mujer.
5. Reanudar en `choose_gender` no pierde edad.
6. Ficha tutor muestra sexo; `PATCH` actualiza y play posterior refleja cambio.
7. Tripulante legacy con `explorer_gender=null` → mentor usa masculino; ficha muestra «Chico» hasta que el tutor edite.
8. pytest: `_phase_choose_gender` válido/inválido; `resolve_explorer_gender(null)==male`.
9. `traveler.md` incluye `explorer_gender` resuelto tras completar personaje.

## Aprobación

- [x] Paso `choose_gender` entre edad y personaje
- [x] Binario `male`/`female` con labels por `age_band`
- [x] `options_only` sin texto libre
- [x] Legacy `null` → masculino en runtime; sin repregunta automática
- [x] Visible y editable en ficha tutor
- [x] Fuera de POC: no binario / neutro
