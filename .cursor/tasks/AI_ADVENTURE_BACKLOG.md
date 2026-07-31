# Backlog: Sistema IA play (post Fases A–E)

> Estado: **vivo** (julio 2026)  
> Plan padre: [AI_ADVENTURE_SYSTEM_PLAN.md](AI_ADVENTURE_SYSTEM_PLAN.md)  
> UI obligatorio: [.cursor/DESIGN.md](../DESIGN.md) + [SPEC_APP_SECTION_FRAME.md](../specify/SPEC_APP_SECTION_FRAME.md)

## Hecho (vertical slice)

| Área | Estado |
| --- | --- |
| Gateway free + discovery/ranking + mock | Hecho |
| First-run tipado (mundo→nombre→edad→traits→handoff) | Hecho |
| Placement banco + scoring PHP + rewrite opcional | Hecho |
| Adventure zona + reto + beats + L2 summarizer | Hecho |
| Context pack L2/L3 en turnos LLM | Hecho |
| Timeline tutor API + «Diario del viaje» en ficha | Hecho |
| Play en `section-frame` + mundo animado + glass | Hecho (corrección UI) |

## Pendiente (prioridad sugerida)

### P0 — producto / pedagogía

1. **Capítulos** más allá de `C1_first_zone` (canon, ceremony, presión antagonista).
2. **Más zonas** y cola de retos por materia/nivel (no solo 1 reto hardcodeado).
3. **HUD niño dedicado** (si se separa del play tutor): contrato visual propio, **sin** romper tokens glass ni el mundo dual; documentar en DESIGN antes de implementar.
4. **Age stepper 5–99** en UI tripulación (backend ya acepta; stepper aún limitado en ficha).

### P1 — IA / calidad

5. Ranking live persistido en `ai_model_catalog` + fail window.
6. Safety filter / `safety_rewriter` en envelopes.
7. Placement: banco por ficheros por banda; scorer short_text con LLM solo en duda.
8. Summarizer: validar no contradicción L1; `kind=chapter` al cerrar capítulo.
9. Prompts versionados en repo (`*.es.md`) en lugar de strings inline.

### P2 — tutor / ops

10. Export timeline completo / paginación cursor cursor-based por `at` (hoy offset).
11. Vista timeline fuera de la ficha (ruta propia) si crece.
12. Telemetría `api_usage` en UI ops.
13. E2E Playwright dedicado `play` + placement (hoy smoke manual / autenticado crew).

### Deuda técnica UI (no reabrir)

- **Prohibido** montar play u otras secciones autenticadas con fondo plano / `destroyAppShell` / chrome inventado. Ver DESIGN § «Nuevas superficies autenticadas».

## Criterio de cierre de backlog

Vaciar P0 o mover ítems a specs/planes con fechas; mantener este fichero como índice, no como spec de contrato.
