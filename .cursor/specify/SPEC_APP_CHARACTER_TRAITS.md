# Spec: Definición de personaje (rasgos textuales + ayuda IA)

> Estado: **propuesta — pendiente de aprobación** (julio 2026)  
> Relacionado: [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [docs/kidepik.md](../../docs/kidepik.md) §4  
> MVP: **solo texto** (sin avatar 3D). Post-MVP: visual.

## Contexto

Tras elegir **mundo**, **nombre** y **edad**, y **antes del examen**, el explorador define **quién es** en el viaje: especie/criatura, colores y rasgos narrativos. Un agente IA **ayuda** (sugiere, pregunta, confirma); no impone un personaje cerrado de golpe.

Esto alimenta:

- Prompts de toda la aventura (`PlayerState.traits`).
- Sugerencias de zona tras el examen.
- Logros narrativos posteriores (se añaden a la ficha).

## Objetivo

1. Insertar paso `choose_character` en first-run.
2. Modelo de datos `child_traits`.
3. Flujo conversacional de co-creación (opciones + texto).
4. Effects tipados y validación.

---

## 1. Orden en first-run (delta)

```
pending_entry → choose_world → choose_name → choose_age
    → choose_character   ← NUEVO
    → placement → complete
```

| Campo | Valor |
| --- | --- |
| `onboarding_step` | `choose_character` |
| `flow_id` | sigue `first_run` (sub-agente `character_coach`) o sub-flow `character` anidado — **decisión:** mismo `flow_id=first_run`, `meta.phase=character` |
| Visual | Ya aplica tipografía/iconos del `world_theme` |

Actualizar [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md) al aprobar este documento.

---

## 2. Modelo de rasgos (MVP)

```ts
interface ChildTraits {
  species: string;       // 2–40 chars; "explorador spot", "dragón de niebla"
  palette: string;       // color(es) principales; "verde neón", "violeta y plata"
  features: string[];    // 1–5 rasgos cortos; "ojos redondos", "piernas elásticas"
  vibe?: string;         // opcional; "valiente y curioso"
  achievements: string[]; // logros narrativos; vacío al crear; crece en aventura
}
```

Persistencia:

```sql
create table public.child_traits (
  child_id uuid primary key references public.children(id) on delete cascade,
  species text not null,
  palette text not null,
  features jsonb not null default '[]'::jsonb,
  vibe text null,
  achievements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
```

Representación para LLM / tutor (docs §4):

```
• Especie: …
• Color: …
• Rasgos: …
• Logros narrativos: … (si hay)
```

---

## 3. Flujo conversacional (`character_coach`)

Objetivo: 3–6 turnos; no alargar.

| Paso | `input_mode` | Qué hace el agente |
| --- | --- | --- |
| Intro | `continue` | Explica que inventarán juntos su forma en este mundo |
| Especie | `options_or_text` | 3 sugerencias temáticas + «escribe la tuya» |
| Color | `options_or_text` | 3 paletas + texto libre |
| Rasgos | `options_or_text` | chips multi-select simulados (2–3 clicks) o texto «ojos…, cola…» |
| Confirmación | `options_only` | Resume ficha; opciones `confirm` / `tweak_species` / `tweak_palette` / `tweak_features` |
| Cierre | `continue` | «Listo, {name}. La prueba de ingreso te espera.» → advance `placement` |

### 3.1 Sugerencias

- Generadas por IA **o** banco estático por mundo (MVP puede mezclar: banco + IA para variar).
- Deben ser **no humanas** en espíritu (docs): criaturas, manchas, constructos, etc.; evitar hiperrealismo humano.
- Respetar `avoid_themes` y edad (`effective_age_band` aún = `age_band`).

### 3.2 Effects permitidos (amplían first_run)

| Effect | Payload |
| --- | --- |
| `set_traits` | `{ species, palette, features, vibe? }` |
| `patch_traits` | parcial |
| `advance_onboarding` | `to: "placement"` |

El cliente no inventa traits; solo muestra lo que el servidor persistió.

---

## 4. Validación servidor

| Campo | Regla |
| --- | --- |
| `species`, `palette` | 2–40 chars; strip HTML; sin URLs |
| `features` | 1–5 ítems; cada uno 2–48 chars |
| `vibe` | opcional; ≤ 80 chars |
| Contenido | filtro tono infantil; re-prompt si falla |

Tutor puede editar traits después en Tripulación (Fase B UI); no regenera historial narrativo automáticamente.

---

## 5. API

Vía diálogo genérico ([SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md)).

Lectura en crew DTO:

```json
"traits": {
  "species": "explorador spot",
  "palette": "verde neón",
  "features": ["ojos redondos", "piernas elásticas"],
  "vibe": "curioso",
  "achievements": []
}
```

---

## 6. Evolución posterior (aventura)

| Evento | Efecto en traits |
| --- | --- |
| Quest de zona completada | `achievements` += frase corta canónica |
| Subida de rango | opcional achievement |
| Contratiempo narrativo | no borra traits; puede añadir “superó la niebla en…” |

No hay Materia Evolutiva cosmética en MVP (docs post-MVP).

---

## 7. Criterios de aceptación

1. No se entra a placement sin fila `child_traits` válida.
2. Tras mundo fantasy, sugerencias usan léxico fantasy.
3. Confirmación resume y permite retocar.
4. Reanudar mid-character no pierde borrador (estado en sesión + parcial persistido o `meta.draft_traits`).
5. Tests: validación longitud; effect `set_traits`; ownership.

## Aprobación

- [ ] Paso `choose_character` entre edad y examen
- [ ] Traits textuales MVP + tabla
- [ ] Coach IA con opciones/texto y confirmación
- [ ] Achievements crecen con el viaje
