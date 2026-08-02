# Spec: Claridad de prosa del mentor (aventura y placement)

> Estado: **propuesta — pendiente de aprobación** (1 ago 2026); **ampliada** (2 ago 2026) por [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md)  
> Relacionado: [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_ADVENTURE_ZONE_BIBLE.md](SPEC_APP_ADVENTURE_ZONE_BIBLE.md), [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md)  
> Archivo operativo: `shared/Ai/prompts/_mentor_prose_rules.es.md`

## Problema

Feedback de tutor adulto (supervisión): el mentor es **difícil de seguir** — demasiadas metáforas encadenadas («equilibrio tiembla», «chispa», «fragmentos», «niebla»), léxico rebuscado, y frases que no dicen **qué pasa** ni **qué hacer**.

El niño puede disfrutar la fantasía; el producto debe ser **legible** para quien acompaña y **comprensible** para el explorador sin ambigüedad.

## Objetivo

Reglas normativas de prosa para **plantillas PHP** y **prompts LLM**, alineadas con edad y mundo, sin perder tono épico suave.

---

## 1. Regla de oro: situación → problema → acción

Cada burbuja narrativa (salvo cierre poético corto) debe responder en orden:

1. **Dónde estamos** (1 frase concreta).
2. **Qué falla** (1 frase).
3. **Qué hacemos ahora** (1 frase + CTA o chips).

Si un párrafo no ayuda a (1)–(3), recortarlo.

---

## 2. Muletillas — cupo por sesión

| Expresión | Máximo por sesión play | Notas |
| --- | --- | --- |
| equilibrio (tiembla / se rompe…) | 1 | Sustituir por hechos: «los espejos mienten», «faltan páginas» |
| fragmento(s) | 2 | Usar nombre diegético de la zona (página, secuencia, semilla…) |
| niebla | 2 | Solo si escenario lo permite |
| chispa (del saber / explorador) | 1 | |
| runa(s) | Solo `zone_math` o ritual explícito | |

---

## 3. Léxico por `effective_age_band`

| Banda | Longitud frase | Léxico |
| --- | --- | --- |
| `band_early` | ≤12 palabras | Sin subordinadas largas; verbos simples |
| `band_child` | ≤18 palabras | Metáforas concretas (árbol, espejo, libro) |
| `band_tween` | ≤22 palabras | Puede un matiz de misterio |
| `band_teen` + | ≤25 palabras | Respeto; sin infantilizar; **sin arcaísmos** |

**Prohibido en todas las bandas:** palabras raras sin contexto (pergeñar, dilucidar, elucubrar, empyreo…).

---

## 4. Tono por mundo (sin mezclar)

| Fantasy | Sci-fi |
| --- | --- |
| Reinos, caminos, guardianes | Sectores, señales, balizas, cadetes |
| Magia suave, runas con moderación | Tecnología, datos, vacío |

Regla existente del canon: no hiperespacio en fantasy ni hechizos en sci-fi salvo metáfora marcada.

---

## 5. Plantillas PHP vs LLM

| Fuente | Obligación |
| --- | --- |
| Agentes LLM (`zone_pitch_writer`, `zone_scene_writer`, `challenge_writer`, `waiting_copy_writer`) | Inyectar `_mentor_prose_rules.es.md` + `zone_bible_excerpt` + cupos §2 |
| `waiting_copy_writer` | §1–4 + líneas cortas (≤90 caracteres); 4–8 líneas por lote — ver [SPEC_APP_ADVENTURE_LLM_NARRATIVE.md](SPEC_APP_ADVENTURE_LLM_NARRATIVE.md) §2.5 |
| `llmMentorTurn` (huecos anti-planificador) | Mismas reglas; no sustituye compose de aventura |
| Validador post-LLM | Rechazar si supera cupo de muletillas o vocabulario de zona ajena |

**Prohibido:** `ZoneNarrativeCatalog` y arrays estáticos de espera en cliente.

**Cliente:** `play.js` consume `waiting_lines[]` del API; si falla compose → animación neutra (spec LLM §1.2).

---

## 6. Prueba de aceptación humana

Checklist para QA (tutor adulto lee en voz alta):

- [ ] ¿Sé en qué lugar estamos en 5 segundos?
- [ ] ¿Entiendo qué problema hay?
- [ ] ¿Sé qué botón o carta pulsar?
- [ ] ¿Alguna frase la tuve que releer? → falla

Automatizable (MVP+): heurística de longitud de frase + lista negra de muletillas en tests.

---

## 7. Criterios de aceptación

1. `_mentor_prose_rules.es.md` actualizado con §1–4.
2. Copy de llegada y retos (LLM) pasa checklist §6 para cada `zone_id`.
3. Test PHPUnit: ningún turno de llegada supera 3 frases por párrafo ni 450 caracteres.
4. Lotes de espera: ninguna línea >90 caracteres; máximo 1 muletilla de §2 por lote.
5. Sesión de prueba: tutor reporta mejora en claridad (Vatardar → Laberinto).
