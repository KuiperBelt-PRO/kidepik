# Spec: Pedagogía del dictado (banda, ficha tutor, mundo)

> Estado: **implementada** (6 sep 2026)  
> Relacionado: [SPEC_APP_DICTATION.md](SPEC_APP_DICTATION.md) (flujo, toggle, TTS, foto), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md](SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_PARALLEL_WORLDS.md](SPEC_APP_PARALLEL_WORLDS.md), [SPEC_AI_AGENT_SKILLS.md](SPEC_AI_AGENT_SKILLS.md)  
> **Diagrama:** [16-journey-mechanics-flows.md](../diagrams/16-journey-mechanics-flows.md) §3b

## Contexto

El dictado no es un párrafo genérico de ortografía. Tiene que **parecer del viaje** (fantasía o sci-fi) y a la vez ser **castellano escolar** corregible. El compositor debe leer la **ficha del tripulante** igual que `path_composer` lee notas y prioridades.

Esta spec es el contrato pedagógico. El flujo de fases, audio y foto vive en [SPEC_APP_DICTATION](SPEC_APP_DICTATION.md).

## Objetivo

1. Ajustar longitud, vocabulario y reglas a `effective_age_band` × **`orthography_level_id`** (independiente de la materia `language`).
2. Inyectar **todo** el foco de la ficha tutor (dictado + notas de lengua + nota general).
3. Envolver teoría, texto canónico y estilo TTS en el **mundo activo** (fantasy / sci-fi).
4. Prohibir que el viajero tenga que inventar la grafía de lore no enseñado.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| P1 | Tres ejes | **Banda** × **ficha tutor** × **mundo**. Los tres entran en cada compose. Ninguno es opcional. |
| P2 | Ortografía | Siempre castellano **ES-ES** escolar. El mundo es **envoltorio**, no un idioma inventado. |
| P3 | Lore | Nombres de zonas, NPCs y objetos del canon **no** son el núcleo a dictar (el viajero no tiene por qué saber escribir «Binar Star»). Sí: palabras reales vestidas de mensaje, bitácora, pergamino, recado. |
| P4 | Ficha | Misma familia de campos que [SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT](SPEC_APP_PATH_COMPOSER_TUTOR_CONTEXT.md): `focus_note` / `focus_tags` de dictado **más** `general_note` y `subject_notes` de `language`. |
| P5 | Mundo | `world_theme` activo. Fantasy y sci-fi tienen **marcos** distintos (teoría, canónico, TTS, carta debug). |
| P6 | Banda × ortografía | Longitud: marco de banda ([SPEC_APP_DICTATION](SPEC_APP_DICTATION.md) §4.3) recortado por `orthography_level_id` L1–L6 (~40 % de ventana). **No** usar L* de `language` para la longitud. |
| P7 | Debug / producto | El dictado lanzado por la 4.ª carta (producto o debug) usa **el mismo** pack pedagógico. No hay modo «texto de prueba Lorem». |

---

## 2. Eje banda de edad

Fuente: `children.effective_age_band` (si falta, `age_band` cronológica). `orthography_level_id` (L1–L6, en `learning.dictation`) mueve **dentro** del marco de banda, no lo rompe. No usar el L* de la materia `language`.

| Banda | Longitud | Qué practicar (orientativo) | Qué no |
| --- | --- | --- | --- |
| `band_early` | 8–15 palabras | Palabras frecuentes, mayúscula inicial, `m` antes de `p/b`, tildes en agudas muy claras | Párrafos, puntuación compleja, hiatos raros |
| `band_child` | 15–30 | Tildes agudas/llanas, b/v, h muda, `c/qu` | Subordinadas largas |
| `band_tween` | 30–50 | Diptongos/hiatos, g/j, r/rr, comas de enumeración | Ensayo |
| `band_teen` | 50–80 | Esdrújulas, tilde diacrítica, `c/z/s` según ES, puntuación | Anglicismos innecesarios |
| `band_adult` | 60–100 | Registro culto cotidiano, tildes diacríticas, precisión léxica | Jerga infantil |
| `band_senior` | 30–50 | Ritmo cómodo; mismas reglas que tween/teen según L* | Párrafo denso |

El compositor recibe `curriculum_hint` de `language` × banda (mismo espíritu que `path_composer`). Si el tutor pide un foco más avanzado que el suelo de banda (p. ej. tilde diacrítica en `band_early`), **bajar el foco** a un ejemplo de la banda y no forzar la regla adulta.

---

## 3. Eje ficha del tripulante

Pack inyectado en `dictation_composer` (bloque `## Contexto del tutor`):

| Fuente | Campo | Uso |
| --- | --- | --- |
| Dictado | `learning.dictation.focus_tags[]` | Prioridad 1: reglas a empaquetar en el canónico |
| Dictado | `learning.dictation.focus_note` | Prioridad 1: instrucciones libres («trabaja las esdrújulas») |
| Lengua | `learning.subject_notes[]` donde `subject_id = language` | Prioridad 2 |
| General | `learning.general_note` | Prioridad 3: solo si habla de escritura/ortografía; si es de mates, ignorar |
| Ledger | `weak_points[]` | Prioridad 2, junto a la nota de lengua |
| Viajero | nombre en `traveler.md` | Puede aparecer **una vez** si la grafía es trivial; no como trampa |

Si el tutor no ha puesto foco de dictado, seguir notas de `language` + weak_points; si todo vacío, regla por defecto de la banda (§2).

**Prohibido** contradecir un chip del tutor (si pidió `accentuation`, el canónico **debe** contener tildes relevantes).

---

## 4. Eje mundo

El viajero no oye «ejercicio 3 de ortografía». Oye una **misión de transcribir** propia del mundo.

### 4.1 Marcos (teoría + canónico + TTS)

| Mundo | Marco (rotar, no repetir el mismo en 5 dictados) | Tono TTS (`tts_instruction`) |
| --- | --- | --- |
| `sci-fi` | Comunicación interestelar, bitácora de puente, mensaje de baliza, parte de exploradores, transcripción de radio | Claro, pausado, «como un parte oficial»; sin vocoder ininteligible |
| `fantasy` | Recado del búho, eco de runas **traducido** a castellano, orden de la hermandad de escribas, verso del cronista, aviso del puente levadizo | Como un cronista o heraldo; pausas entre oraciones; sin canto |

La **teoría** usa el mismo marco («Antes de copiar el parte, recuerda la tilde…») y sigue [SPEC_APP_MENTOR](SPEC_APP_MENTOR.md) (El Guía / nombre del mundo).

El **canónico** es un mensaje breve **dentro** de ese marco (p. ej. sci-fi: «La nave espera en el puerto hasta las tres.» — palabras reales, tildes reales).

### 4.2 Ejemplos de marco (no son el canónico; el LLM genera otro)

**Sci-fi (teen, foco tildes):** teoría sobre agudas; canónico tipo parte: *«El capitán activó el motor detrás del satélite azul.»*

**Fantasy (child, foco b/v):** teoría sobre b/v; canónico tipo recado: *«La paloma volará sobre el valle si hay buen viento.»*

### 4.3 Anti-lore en el canónico

| Permitido | Prohibido |
| --- | --- |
| «nave», «puerto», «puente», «runa» como palabra española | Grafías únicas de zona/NPC del pack de caminos |
| Nombre del viajero si es corto y ya escrito en ficha | Inventar un topónimo para que falle la mayúscula |

---

## 5. Envelope (amplía dictado §4.3)

```ts
interface DictationComposeEnvelope {
  theory_mentor: string;
  canonical_text: string;
  world_frame: "beacon" | "log" | "radio" | "scroll" | "herald" | "owl" | "scribes" | string;
  focus_applied: string[];
  tutor_signals_used: string[];  // ids de nota / tag realmente aplicados
  weak_points_used: string[];
  tts_instruction: string;
  word_count: number;
  age_band: string;
  world_theme: "fantasy" | "sci-fi";
}
```

Rechazo estructural si faltan `canonical_text`, `theory_mentor`, `world_theme` o `word_count` fuera de la banda (±20 % de margen).

---

## 6. Criterios de aceptación

1. Compose con `band_early` nunca supera ~18 palabras (margen 20 % sobre 15).
2. Con `focus_tags: ["accentuation"]` el canónico contiene al menos 2 tildes (test con fixture / validador).
3. `world_theme=sci-fi` → `tts_instruction` y `theory_mentor` usan marco espacial/radio/bitácora; `fantasy` → pergamino/heraldo/escribas. Test de prompt: el pack incluye el bloque de mundo.
4. Nota tutor «esdrújulas» aparece en `tutor_signals_used`.
5. El canónico **no** incluye un `title` de camino del pack activo (anti-lore).
6. Debug y gate post-camino llaman al **mismo** composer.

## Fuera de alcance

- Dictar en otro idioma.
- Elegir marco a mano en la ficha (el sistema rota).
- Voz distinta por mentor más allá de `tts_instruction`.

## Aprobación

- [ ] Tres ejes obligatorios en cada compose
- [ ] Mundo = envoltorio; ortografía = ES-ES escolar
- [ ] Ficha tutor (dictado + lengua + nota general pertinente)
- [ ] Anti-lore de caminos en el canónico
