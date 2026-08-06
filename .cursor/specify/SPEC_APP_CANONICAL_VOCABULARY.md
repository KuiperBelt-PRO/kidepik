# Spec: Vocabulario canónico de producto (AgeBand / Subjects)

> Estado: **aprobada** (ago 2026) — aclara residuales post-retiro IA PHP  
> Relacionado: [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_AI_PHP_STACK_RETIREMENT.md](SPEC_AI_PHP_STACK_RETIREMENT.md), [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md)

## Contexto

Tras retirar el stack OpenRouter PHP, quedaron clases en `shared/Ai/` que **no son agentes LLM**: listas y reglas deterministas. Esta spec fija qué sobrevive, dónde vive, y qué se elimina.

## Objetivo

1. Definir el vocabulario canónico mínimo en código Python.
2. Prohibir PlacementBank y clarificar Zone/Mentor.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| V1 | `AgeBand` | **Conservar** en `backend/app/catalogs/age_band.py` |
| V2 | `SubjectCatalog` | **Conservar** en `backend/app/catalogs/subject_catalog.py` |
| V3 | `PlacementBank` + `default.json` | **Eliminar**; ítems solo vía agentes |
| V4 | `ZoneCatalog` (nombres fijos de zona) | **Deprecar** como fuente de caminos; caminos los genera el LLM; materias siguen SubjectCatalog |
| V5 | `MentorCatalog` (ficha estática PHP) | **Deprecar**; perfil en `.md` del agente mentor + skills |
| V6 | `ZonePitchPlanner` | **Deprecar**; selección de caminos = orquestador + materias flojas ([SPEC_APP_JOURNEY_MECHANICS](SPEC_APP_JOURNEY_MECHANICS.md)) |
| V7 | Ubicación | No namespace `Ai`; catálogos vivos solo en Python (PHP copies se borran al migrar crew) |

---

## 2. Qué es cada pieza (glosario humano)

| Nombre | Es | No es |
| --- | --- | --- |
| **AgeBand** | Mapa edad→`band_early`…`band_senior` | Un agente |
| **SubjectCatalog** | Lista de materias (`math`, …), etiquetas, base por banda, pesos | Un banco de preguntas |
| **PlacementBank** | JSON de preguntas prefabricadas + scoring PHP | — **a borrar** |
| **ZoneCatalog** | Ids `zone_*` + labels fantasy/sci-fi | Generador de caminos (obsoleto) |
| **MentorCatalog** | Ids/nombres del Guardián/Arquitecto | Runtime LLM |
| **ZonePitchPlanner** | Algoritmo de 2–3 zonas por debilidad | Orquestador de narrativa |

---

## 3. Anti-repetición sin bank

En lugar de `item_key` de un banco:

1. Al componer placement/caminos, tool/consulta DuckDB o lectura de `events.jsonl` / `dialogue.jsonl` recientes.
2. El prompt incluye “evitar repetir estos stems/keys recientes”.
3. Validación post-LLM rechaza duplicados exactos de `item_key`/`stem` en la ventana L3.

---

## 4. Criterios de aceptación

1. Documentado en [SPEC_DATA_STORAGE_LAYERS](SPEC_DATA_STORAGE_LAYERS.md) D7–D8.
2. Plan de implementación elimina `shared/Ai/PlacementBank.php` y `placement_bank/`.
3. AgeBand + SubjectCatalog tienen tests Python vigentes.
4. Ningún service nuevo importa `Kidepik\Shared\Ai\PlacementBank`.

## Fuera de alcance

- Renombrar labels UI de niveles L1–L5 (posible iniciativa crew aparte).
