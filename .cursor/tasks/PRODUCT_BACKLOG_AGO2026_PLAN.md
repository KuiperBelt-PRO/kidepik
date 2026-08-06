# Plan: Backlog producto ago 2026 (UI + waiting JSONL + play polish)

> Specs **aprobadas**. Cortes en curso.  
> [SPEC_APP_WAITING_PHRASES](../specify/SPEC_APP_WAITING_PHRASES.md) (JSONL),  
> [SPEC_APP_PRODUCT_BACKLOG_AGO2026](../specify/SPEC_APP_PRODUCT_BACKLOG_AGO2026.md).

**Fuera de alcance explícito:** Parquet / `.duckdb` persistente / ETL.

## Cortes (orden)

| # | Entrega | Estado |
| --- | --- | --- |
| 0 | Waiting phrases → JSONL `data/waiting/` + `pick_waiting_batch` sin PG | **hecho** |
| 1 | Ficha 3 tabs Detalles / Viaje / Ajustes | **hecho** |
| 2 | Grid materias + switches + copy niveles | **hecho** |
| 3 | Carta Tripulación: CTA Continuar aventura | **hecho** |
| 4 | Modal PIN teclado 3×3 al entrar play | **hecho** |
| 5 | UI cambio mundo activo | **hecho** |
| 6 | Play polish: fail/retry examen; regen 1 camino; prosa breve | **hecho** |
| 7 | Informes tutor + puntos flojos → path_composer | **hecho** |
| 8 | Post-rango: informe `.md` + felicitación | **hecho** (al completar camino) |

## Validación

- Playwright 390×844 por corte de UI.
- Smoke placement/paths tras cortes 0 y 6.
