# Spec: Placement adaptado por edad y prosa narrativa del mentor

> Estado: **implementada** (31 jul 2026)  
> Relacionado: [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md)  
> **Delta** — catálogo y activación: [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md).

## Contexto

El placement MVP usa banco JSON fijo + strings PHP. Esta spec define el **objetivo de producto**: agente contextual + pedagogía PHP + catálogo amplio configurable por tutor.

Ver [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) para el listado completo de materias, pesos y UI de activación en ficha tripulante.

## Objetivo

1. Placement con **1 reto por materia activa** del tripulante; dificultad por `age_band`.
2. Prosa del mentor generada por agente; complejidad del habla por banda.
3. Agente genera retos dentro de restricciones PHP; scoring en servidor.

---

## 1. Arquitectura: agente con matices

### 1.1 División de responsabilidades

| Capa | Responsable |
| --- | --- |
| Qué materias entran | `children.settings.learning.active_subjects` (tutor) ∩ catálogo |
| Dificultad / tipo ítem | PHP según `age_band` |
| Texto narrativo y reto | Agente + `PlayerState` |
| Respuesta correcta | Agente propone → PHP valida → persistir |
| Niveles / banda efectiva | PHP |

### Fallback (A1 — 1 ago 2026)

**Prohibido** degradar a banco seed (`default.json` / `pickQueue`) en el examen real. Si el agente no compone una cola completa tras reintentos: mensaje de reintento al explorador, sin ítems plantilla.

`PlacementBank` permanece para scoring helpers y tests; no rellena `item_queue` de producción.

### 1.2 Qué materias entran en el examen

```
materias_del_examen = active_subjects del tripulante
  (validadas contra SubjectCatalog)
```

No hay recorte por edad: un niño de 8 años con `politics` activo por el tutor **sí** recibe un reto de política con dificultad `band_child`.

Las **materias base por banda** ([SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md) §2) son sugerencia al declarar edad, no techo.

### 1.3 Carga del examen

| Regla | Valor |
| --- | --- |
| Retos por materia | 1 (default) |
| Retos extra | math y language: +1 reto si `band_teen` \| `band_adult` \| `band_senior` |
| Máximo materias | 14 (tamaño catálogo) |
| Reanudación | Obligatoria si `item_queue` no completada |
| Aviso tutor | Si `active_subjects.length > 10` |

### 1.4 Dificultad y tipo por banda

| `age_band` | `difficulty` | Tipos permitidos |
| --- | --- | --- |
| `band_early` | 1 | `mcq` |
| `band_child` | 1–2 | `mcq`, `short_text` corto |
| `band_tween` | 2–3 | mixto |
| `band_teen` | 2–4 | mixto; comprensión lectora en `reading` |
| `band_adult` | 3–5 | mixto; razonamiento |
| `band_senior` | 2–4 | como adult; léxico claro |

Aplica a **todas** las materias activas, incluidas `finance`, `politics`, `mythology`, etc.

---

## 2. Prosa narrativa del mentor

### 2.1 Registro por mundo

Fantasy épica / space opera; sin jerga de «examen escolar».

### 2.2 Complejidad del habla por banda

| Dimensión | early | child | tween | teen | adult | senior |
| --- | --- | --- | --- | --- | --- | --- |
| Tono | Muy cálido | Aventura clara | Cercano | Respetuoso | Colega-mentor | Paciente, digno |
| Vocabulario | Concreto | + imágenes | Metáforas moderadas | Rico | Abstracto preciso | Como adult, sin jerga |
| Palabras/turno | 20–45 | 30–60 | 40–80 | 50–100 | 55–120 | 45–100 |

`band_teen` ≠ `band_adult` en sintaxis y registro.

### 2.3 Generación (no plantilla nominal)

Intro, cada reto, feedback, cierre: agente con `PlayerState` (edad, banda, traits, materia actual, mundo, mentor). Validador PHP de longitud y tono. Plantillas solo en degradación.

---

## 3. Criterios de aceptación

1. Placement incluye todas las `active_subjects` del tripulante (1 reto c/u).
2. Tutor añade `mythology` a un niño de 7 años → reto con `difficulty` 1, prosa `band_early`.
3. Teen y adult: prosa distinguible en fixtures.
4. Sin wrapper seco «Prueba N de M en la Escuela» en flujo nominal.
5. Agente + validador PHP; scoring sin LLM.
6. Integración con [SPEC_APP_SUBJECT_CATALOG.md](SPEC_APP_SUBJECT_CATALOG.md).

---

## Aprobación (v3)

- [x] Examen = materias activas del tripulante (catálogo 14)
- [x] Base por banda = sugerencia, no límite
- [x] Tutor configura materias en ficha
- [x] Dificultad/prosa por `age_band` (teen ≠ adult en habla)
- [x] Agente genera narrativa y retos (validación PHP); plantillas solo en degradación

**Decisión titular (31 jul 2026):** aprobado para implementación futura; esperar OK antes de codificar.

---

## Estado de implementación

| Fase | Estado |
| --- | --- |
| Specify | Cerrada (aprobada) |
| Plan / Task | [SUBJECT_CATALOG_PLACEMENT_ADAPTIVE_PLAN.md](../tasks/SUBJECT_CATALOG_PLACEMENT_ADAPTIVE_PLAN.md) |
| Implement | **Hecha** — `PlacementExamComposer` genera el examen completo vía agente; **sin banco seed** (A1 ago 2026); fallo → reintento UI |
| Validate | PHPUnit `PlacementAdaptiveTest` + `PlacementAgentOnlyAndQueuesTest` |

### Entregado

1. `SubjectCatalog` + tests
2. `children.settings.learning` + API PATCH + UI checklist
3. `PlacementExamComposer` + `PlacementItemValidator` (agente primero)
4. ~~`PlacementBank` como fallback seed~~ **retirado del camino feliz (A1)**
5. `PlacementNarrator` + feedback con explicación
6. Prompts `shared/Ai/prompts/placement_exam_composer.es.md` (castellano ES)
7. Colas de modelo por purpose en BD (`ai_purpose_model_queues`, B1)
