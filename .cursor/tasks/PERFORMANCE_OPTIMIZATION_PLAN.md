# Plan: optimización de rendimiento (SPEC_APP_PERFORMANCE)

> Spec: [SPEC_APP_PERFORMANCE.md](../specify/SPEC_APP_PERFORMANCE.md)  
> Estado: **pendiente de aprobación de spec**

## Resumen

Cuatro fases ordenadas por impacto/riesgo. Cada fase termina con medición del perfil §6 de la spec y suite de tests existente (`./scripts/test-all.ps1` o subconjunto indicado).

```mermaid
flowchart LR
  P0[P0 Mundo + observers] --> P1[P1 Logging + ledger]
  P1 --> P2[P2 Play DOM + boot]
  P2 --> P3[P3 SQL batching opcional]
```

---

## Fase 0 — Baseline (antes de código)

| Tarea | Entregable |
| --- | --- |
| Capturar CPU 60 s idle en `#/crew` y `#/home` | Notas + screenshot Performance (Playwright CDP o DevTools) |
| Registrar p95 `open_session` / `submit_turn` sin LLM (mock o flujo placement corto) | Línea base en este doc |
| Tamaño típico `events.jsonl` en dev | Número de líneas en sesión de prueba |
| Confirmar flags `.env.poc`: `LOG_TO_FILES`, `APP_DEBUG_AI`, `LOG_CLIENT_INGEST` | Tabla en informe de cierre Fase 0 |

**Gate:** baseline documentado en PR o comentario de issue antes de Fase 1.

---

## Fase 1 — P0 Cliente (máximo impacto UX)

### 1.1 Tiers de runtime del mundo

| Paso | Archivos |
| --- | --- |
| Crear `web/js/lib/world-runtime-tier.js` | API §3.1 spec |
| Integrar con `loader-animation-frame.js` | Respetar `document.hidden` + tier |
| Actualizar suscriptores: clouds, celestial, orbit, meteor, fx-render, fantasy-render, space-ships | Early return / acumulación `dt` en `ambient` |
| Cablear tier desde `shell-navigation` / `world-band-layout` al cambiar ruta | `full` vs `ambient` |
| Tests unitarios `web/tests/world-runtime-tier.test.js` | Transiciones |

**No hacer:** destruir `world-session` ni regenerar escena.

### 1.2 Observadores

| Paso | Archivos |
| --- | --- |
| Quitar `watchNoSpellcheck(document.documentElement)` de `main.js` | Mantener en `section-frame.js` |
| Debounce `scheduleShellFrameSync` en `shell-frame.js` | 1 rAF coalescido |
| Debounce `syncLoaderLogoMask` en `loader-logo-mask.js` | 100 ms + early exit |

**Validación:** flujo shell + play §6 spec; sin regresión visual handoff mundo.

**Tests:** extender `world-transition.test.js` si aplica; Playwright smoke handoff.

---

## Fase 2 — P1 Observabilidad + ledger

### 2.1 Backend logging

| Paso | Archivos |
| --- | --- |
| Buffer + flush periódico en `app/logging_/__init__.py` | Config: `LOG_BUFFER_LINES`, `LOG_FLUSH_MS` |
| Excluir o muestrear paths estáticos en middleware `main.py` | Solo local |
| Ajustar umbral `client` con `APP_DEBUG_AI` | Ver spec §logging |

**Tests:** `backend/tests/unit/test_app_logger.py` (nuevo).

### 2.2 Cliente logging

| Paso | Archivos |
| --- | --- |
| Caché sesión en `app-logger.js` flush | 60 s TTL |
| Evitar click listener si `minLevel` > debug | Ya parcial; revalidar con debug IA |

### 2.3 Ledger tail + memo

| Paso | Archivos |
| --- | --- |
| Optimizar `read_events` tail en `ledger.py` | limit sin sort global si posible |
| Memo en `DialogueService` para eventos de sesión | Invalidar en append |

**Tests:** `backend/tests/unit/test_ledger_read_events.py` con fichero 5k líneas.

---

## Fase 3 — P2 Play DOM + boot

| Paso | Archivos |
| --- | --- |
| Refactor incremental `play.js` render de burbujas | Sin `innerHTML` masivo en log |
| CSS `content-visibility` en burbujas antiguas | `play.css` |
| Cache markdown por turno | `play.js` o helper |
| Fuentes: revisar subset / `display=swap` | `index.html` |
| Cache `architecture/config` para logger | `app-logger.js` sessionStorage |

**Validación:** scroll log 48 burbujas; Lighthouse en build estático si hay pipeline.

---

## Fase 4 — P3 SQL (opcional, si baseline lo justifica)

| Paso | Archivos |
| --- | --- |
| Perfil de consultas en `open_session` | Notas |
| Combinar `_recent` + `_last_mentor` donde seguro | `dialogue.py` acotado |
| pytest contract sin cambiar respuesta JSON | `backend/tests/` |

**Gate:** solo si Fases 1–3 no alcanzan p95 `open_session` objetivo.

---

## Cierre documental

Al terminar cada fase:

1. Actualizar estado en [SPEC_APP_PERFORMANCE.md](../specify/SPEC_APP_PERFORMANCE.md).
2. Añadir fila en [CURRENT_SPECS.md](../CURRENT_SPECS.md) si aún no está.
3. Actualizar [13-dev-test-validate.md](../diagrams/13-dev-test-validate.md) con comandos de benchmark si se añaden scripts.
4. Añadir fila en [14-cursor-doc-routing.md](../diagrams/14-cursor-doc-routing.md).

---

## Estimación orientativa

| Fase | Esfuerzo | Riesgo regresión visual |
| --- | --- | --- |
| 0 Baseline | 0.5 d | — |
| 1 P0 cliente | 2–3 d | Medio (mundo) |
| 2 P1 I/O | 1–2 d | Bajo |
| 3 P2 play/boot | 2 d | Medio (play) |
| 4 P3 SQL | 1 d | Medio (API) |

Implementar **una fase por PR** preferiblemente.
