# Spec: Glosario en capas y composición (ingredientes + referencias)

> Estado: **aprobada** (9 ago 2026) — P0–P3 implementados  
> Relacionado: [SPEC_APP_WORLD_GLOSSARY.md](SPEC_APP_WORLD_GLOSSARY.md), [SPEC_APP_MENTOR_PROSE_CLARITY.md](SPEC_APP_MENTOR_PROSE_CLARITY.md), [SPEC_AI_CENTRAL_ORCHESTRATOR.md](SPEC_AI_CENTRAL_ORCHESTRATOR.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md)  
> Supersede parcial: uso literal de `term` compuesto como plantilla de chip/prosa (G3 de WORLD_GLOSSARY se mantiene; cambia el **contrato de consumo**)

## Contexto

El glosario actual (`data/glossary/*.jsonl`) guarda **términos tipológicos compuestos** (`claro de cristales`, `puente de niebla`, `piedra rúnica`). Los agentes los reciben vía `glossary_search` y tienden a **copiarlos al pie de la letra** en prosa y en chips de arquetipo.

Eso produce:

- Repetición entre turnos del mismo viaje («Puente de Niebla» en varias burbujas).
- Sensación de catálogo cerrado en lugar de mundo vivo.
- Confusión entre **vocabulario de inspiración** y **nombres diegéticos obligatorios**.

La mitigación actual (anti-repetición por ledger + `exclude_terms` + validación) es un **parche operativo**. Esta spec define el **modelo de datos y de consumo** que evita el problema en origen.

## Objetivo

1. Separar **ingredientes composables** de **ejemplos canónicos** y de **nombres propios puntuales**.
2. Permitir que el LLM **componga** lugares, roles y atmósferas sin pegar frases del JSONL.
3. Mantener JSONL versionado, DuckDB y `glossary_search` como base; añadir composición explícita.
4. No atomizar en palabras sueltas (`puente` + `niebla`); usar **slots semánticos** con restricciones de tono.

---

## 1. Principio de diseño

| Capa | Rol | ¿Copiable literal en UI? | Ejemplo |
| --- | --- | --- | --- |
| **L1 — Ingredientes** | Bloques por slot (`forma`, `ambiente`, `rol`, `tono`…) | **No** — solo combinar | `pasarela` + `vapor tenue` + `paciencia` |
| **L2 — Referencias** | Frases compuestas que ilustran estilo y función narrativa | **No** — inspirar, parafrasear | «puente de niebla» → pasarela vaporosa entre riscos |
| **L3 — Canónicos** | Lugares/objetos icónicos del mundo (pocos, deliberados) | **Sí**, con moderación y sin repetir en el mismo capítulo | «La Puerta de los Susurros» (futuro, si se define) |

**Regla de oro:** el LLM nunca debe recibir L1/L2 como lista de nombres para chips. Recibe **slots + restricciones + 0–2 referencias de estilo** (no copiables).

---

## 2. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| GC1 | No atomizar palabras | Prohibido glosario de tokens sueltos tipo `niebla`, `puente` sin slot |
| GC2 | Slots | Enum cerrado por mundo; ver §3 |
| GC3 | Formato | Sigue siendo **JSONL**; nuevos `kind` y `layer` |
| GC4 | Tool principal | `glossary_compose` (nuevo) + `glossary_search` (legacy / búsqueda puntual) |
| GC5 | Compatibilidad | Migración gradual: entradas actuales → `layer: reference` |
| GC6 | Anti-repetición | Sigue activa ([ledger + validación](../backend/app/services/mentor_prose.py)); aplica a **salida compuesta**, no solo a `term` del JSONL |
| GC7 | Chips de arquetipo | Labels generados por **composición**; referencias L2 solo en prompt como «ejemplo de tono, no uses esta frase» |

---

## 3. Esquema de línea JSONL (v2)

Campos heredados de [SPEC_APP_WORLD_GLOSSARY](SPEC_APP_WORLD_GLOSSARY.md) §3, más:

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `layer` | `ingredient` \| `reference` \| `canonical` | sí (v2) | Default implícito `reference` si falta (compat) |
| `slot` | string? | sí si `layer=ingredient` | Ver catálogo §3.1 |
| `composes_with` | string[]? | no | Slots compatibles (p. ej. `place_form` + `place_mood`) |
| `copy_policy` | `forbid_literal` \| `allow_canonical` | sí (v2) | L1/L2 → `forbid_literal`; L3 → `allow_canonical` |
| `example_surface` | string? | no | Solo L2: frase ilustrativa (puede coincidir con `term` legacy) |

### 3.1 Catálogo de slots (fantasy — seed)

| `slot` | Descripción | Ejemplos de ingrediente (`term`) |
| --- | --- | --- |
| `place_form` | Morfología del lugar | pasarela, claro, torre, arboleda, gruta |
| `place_mood` | Atmósfera sensorial | vapor tenue, cristal luminoso, musgo húmedo, silencio profundo |
| `place_lesson` | Función narrativa pedagógica | equilibrio, paciencia, observación, cooperación |
| `role_archetype` | Rol del explorador (chips) | explorador, artesano, cartógrafo, guardián |
| `species` | Especie no humana | elfo, orco, enano, zorro de brasas |
| `tone` | Registro de prosa | maravilla calmada, aventura suave, misterio amable |

Sci-fi: slots análogos (`sector_form`, `signal_mood`, `crew_role`, `synthetic_species`, …) en `sci-fi.jsonl`.

### 3.2 Ejemplos de líneas

**Ingrediente (L1):**

```json
{
  "id": "fx_slot_passerelle",
  "world": "fantasy",
  "layer": "ingredient",
  "slot": "place_form",
  "kind": "place_type",
  "term": "pasarela",
  "definition": "Camino estrecho entre dos alturas; invita a ir despacio.",
  "tags": ["viaje", "altura"],
  "tone_notes": "aventura suave",
  "copy_policy": "forbid_literal"
}
```

**Referencia (L2) — migración de entrada actual:**

```json
{
  "id": "fx_sky_bridge",
  "world": "fantasy",
  "layer": "reference",
  "slot": null,
  "kind": "place_type",
  "term": "puente de niebla",
  "example_surface": "puente de niebla",
  "definition": "Pasarela vaporosa entre riscos; enseña equilibrio y paciencia.",
  "tags": ["viaje", "naturaleza"],
  "tone_notes": "aventura suave",
  "copy_policy": "forbid_literal",
  "composes_with": ["place_form", "place_mood", "place_lesson"]
}
```

**Canónico (L3) — reservado, fuera de seed MVP:**

```json
{
  "id": "fx_whisper_gate",
  "world": "fantasy",
  "layer": "canonical",
  "kind": "place_name",
  "term": "Puerta de los Susurros",
  "definition": "Umbral legendario del mundo fantasy; aparece como hito de capítulo.",
  "copy_policy": "allow_canonical"
}
```

---

## 4. Layout de ficheros

```
data/glossary/
  fantasy.jsonl          # mezcla L1+L2 (+ L3 futuro); migración in-place
  sci-fi.jsonl
  shared.jsonl
  slots/
    fantasy.slots.json   # opcional: metadatos de slots (descripción, límites por edad)
    sci-fi.slots.json
```

`slots/*.json` es opcional en fase 1; los slots pueden inferirse del campo `slot` en JSONL.

---

## 5. Tools

### 5.1 `glossary_compose` (nuevo)

```python
def glossary_compose(
    world: Literal["fantasy", "sci-fi"],
    *,
    purpose: Literal["mentor_prose", "species_chip", "zone_pitch"],
    slots: dict[str, int] | None = None,  # p.ej. {"place_form": 1, "place_mood": 1}
    exclude_terms: list[str] | None = None,
    rotate_seed: int | None = None,
    age_band: str | None = None,
) -> GlossaryComposeResult:
    """
    Devuelve un paquete de ingredientes + 0–2 referencias de estilo (no copiables).
    """
```

**`GlossaryComposeResult`:**

| Campo | Contenido |
| --- | --- |
| `ingredients` | Lista de `{slot, term, definition, tone_notes}` |
| `style_refs` | Lista de `{id, paraphrase_hint}` — **sin** `term` literal en prompt de salida |
| `compose_hint` | Texto fijo: «Combina ingredientes; no uses las referencias como nombres propios» |

**Comportamiento por `purpose`:**

| `purpose` | Slots típicos | Límite L2 |
| --- | --- | --- |
| `species_chip` | `species`, `role_archetype`, `place_form` o `place_mood` | 0–1 |
| `mentor_prose` | `place_form`, `place_mood`, `place_lesson` | 0–1 |
| `zone_pitch` | `place_form`, `place_mood`, `tone` | 1–2 |

### 5.2 `glossary_search` (existente)

- Sigue para búsqueda por `kind`/`tags`/`query`.
- En fase 2: filtro por `layer` (default excluir `reference` del top-N automático del orquestador).
- Parámetros ya implementados: `exclude_terms`, `rotate_seed`.

### 5.3 Orquestador

Sustituir en `_tool_context` el bloque plano de glosario por:

1. `glossary_compose(...)` según `phase` / `purpose`.
2. Lista `ledger_recent_avoid_phrases` (ya implementada).
3. Instrucción explícita en skill `mentor-prose-clarity`: **ingredientes sí, referencias no literal**.

---

## 6. Contrato de consumo por superficie

| Superficie | Fuente | Regla |
| --- | --- | --- |
| Prosa mentor (`agent_text`) | `glossary_compose` + canon mundo | Componer lugar con 1 forma + 1 mood; no repetir frase L2 |
| Chips arquetipo (`options[].label`) | `glossary_compose` + `character-traits` skill | Título narrativo; especie visible si no humano; **sin** pegar `example_surface` |
| Pitches de zona | `zone_pitch` compose + zone bible | L3 canónico solo si el capítulo lo requiere |
| Validación (`validate_mentor_prose`) | `avoid_phrases` + muletillas | Falla si repite L2 del viaje o copia `example_surface` |

---

## 7. Migración desde glosario actual

| Paso | Acción |
| --- | --- |
| M1 | Script `backend/app/scripts/glossary_migrate_layers.py` (dry-run): añade `layer: reference`, `copy_policy: forbid_literal` a entradas compuestas existentes |
| M2 | Descomponer manualmente 5–8 entradas frecuentes en L1 (p. ej. `fx_sky_bridge` → ingredientes `pasarela`, `vapor tenue`, `paciencia`) |
| M3 | Orquestador: feature flag `GLOSSARY_COMPOSE_ENABLED=true` (settings) para activar `glossary_compose` por fases |
| M4 | Tests de regresión: chips y prosa no contienen `example_surface` de referencias inyectadas en el mismo turno |

**No borrar** entradas L2 de inmediato: sirven como referencia de tono y para migración gradual.

---

## 8. Criterios de aceptación

1. **Datos:** ≥ 6 ingredientes L1 por slot mínimo (`place_form`, `place_mood`, `role_archetype`, `species`) en fantasy y sci-fi.
2. **Tool:** `glossary_compose` con tests unitarios (exclusión, rotación, slots vacíos).
3. **Orquestador:** en `choose_character_species`, el prompt incluye ingredientes y **no** lista plana de 18 `term` compuestos.
4. **Calidad:** en prueba manual de onboarding (edad 10, fantasy), 3 turnos consecutivos sin repetir la misma frase L2 (p. ej. «puente de niebla») en prosa ni chips.
5. **Compat:** `glossary_search` sin `layer` sigue funcionando; líneas sin `layer` se tratan como `reference`.
6. **Validación:** `validate_avoid_repetition` cubre términos L2 usados en el viaje (comportamiento actual extendido a `example_surface`).

---

## 9. Fases de implementación

| Fase | Alcance | Entregable |
| --- | --- | --- |
| **P0** (hecho) | Anti-repetición ledger + exclude + validación | Código actual en `tools.py`, `orchestrator.py`, `mentor_prose.py` |
| **P1** | Esquema v2 + migración script + seeds L1 fantasy | JSONL + tests datos |
| **P2** | `glossary_compose` + orquestador detrás de flag | Tool + tests |
| **P3** | Sustituir bloque glosario en `choose_character_species` y mentor onboarding | Integración play |
| **P4** | Zone pitches + L3 canónicos (si producto lo pide) | Extensión zone bible |

---

## 10. Fuera de alcance

- CMS de tutor para editar slots (backlog [SPEC_APP_PRODUCT_BACKLOG_AGO2026](SPEC_APP_PRODUCT_BACKLOG_AGO2026.md)).
- Generación masiva de glosario por LLM sin revisión humana.
- Traducción multiidioma del glosario.
- Atomización léxica (`puente` / `niebla` como entradas independientes sin slot).

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Combinaciones absurdas (`torre` + `musgo` + `cooperación`) | `composes_with` + validación post-LLM; retry con otro `rotate_seed` |
| Pérdida de identidad de mundo | `tone_notes` por ingrediente; skill `world-canon` sigue mandando |
| Complejidad de migración | Flag + convivencia L2 legacy durante P1–P3 |
| Más tokens en prompt | Paquete compose acotado (≤ 5 ingredientes + 1 ref) |

---

## 12. Referencias de código (estado P0)

| Módulo | Responsabilidad |
| --- | --- |
| `backend/app/ai/orchestrator/tools.py` | `glossary_search`, `_all_glossary_terms`, `ledger_recent_avoid_phrases` |
| `backend/app/ai/orchestrator/orchestrator.py` | `_tool_context` |
| `backend/app/services/mentor_prose.py` | `validate_avoid_repetition` |
| `backend/skills/mentor-prose-clarity/SKILL.md` | Reglas de no copia literal |
| `data/glossary/fantasy.jsonl` | Seed actual (L2 implícito) |
