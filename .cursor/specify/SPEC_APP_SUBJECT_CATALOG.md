# Spec: Catálogo de materias (aprendizaje y examen de acceso)

> Estado: **implementada** (31 jul 2026) — **delta 18 ago 2026:** `mythology` = mitos reales; placement no examina lore inventado del mundo.  
> Relacionado: [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md), [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md), [docs/kidepik.md](../../docs/kidepik.md) §3  
> **Fuente de verdad** para ids, labels, pesos y reglas de activación por tripulante.

## Contexto

El MVP arrancó con **5 materias** (`math`, `language`, `logic`, `science`, `culture`) alineadas a zonas del canon. El producto evoluciona hacia un catálogo **más amplio** y **configurable por tutor**, con dificultad acoplada a `age_band` — no a la cantidad de áreas evaluadas.

Principio rector (jul 2026):

> Los exploradores pueden abordar **más materias** de las que se asumía; lo que escala es el **nivel** del reto, no el recorte arbitrario por edad. La banda define un **mínimo base**; el tutor puede **activar materias adicionales** por tripulante en su ficha.

## Objetivo

1. Catálogo cerrado de `subject_id` con metadatos (label, familia, peso, zona narrativa).
2. Materias **base por banda** (sugeridas al declarar edad / crear ficha).
3. **Overrides por tripulante** (`active_subjects`) independientes de la edad.
4. Reglas de placement y nivel general con renormalización de pesos.
5. Contrato UI en ficha Tripulación + defaults en Ajustes.

---

## 1. Catálogo completo (15 materias)

| `subject_id` | Label tutor (es-ES) | Familia UI | Peso default \(w\) | Zona canon MVP |
| --- | --- | --- | --- | --- |
| `math` | Matemáticas | Fundamentales | 0.13 | `zone_math` |
| `language` | Lengua y gramática | Fundamentales | 0.13 | `zone_language` |
| `reading` | Comprensión lectora *(separada de lengua)* | Fundamentales | 0.09 | `zone_language` * |
| `logic` | Lógica y razonamiento | Fundamentales | 0.09 | `zone_logic` |
| `science` | Ciencias naturales | Ciencias | 0.09 | `zone_science` |
| `culture` | Cultura general | Humanidades | 0.06 | `zone_culture` |
| `geography` | Geografía | Humanidades | 0.06 | `zone_culture` * |
| `history` | Historia | Humanidades | 0.08 | `zone_culture` * |
| `mythology` | Mitología | Humanidades | 0.04 | — (territorio genérico) |
| `ethics` | Ética y moral | Sociedad | 0.05 | — |
| `communication` | Comunicación | Sociedad | 0.04 | — |
| `politics` | Política y ciudadanía | Sociedad | 0.03 | — |
| `arts` | Arte (plástica, música, cine…) | Expresión | 0.04 | — |
| `sports` | Deporte y salud | Expresión | 0.03 | — |
| `finance` | Finanzas y economía cotidiana | Vida práctica | 0.04 | — |

\* Comparten metáfora de zona en MVP; `zone_id` en retos puede ser el de la familia hasta que existan zonas dedicadas.

**Notas de contenido:**

| Materia | Alcance pedagógico (orientativo) |
| --- | --- |
| `ethics` | Empatía, dilemas sencillos, convivencia, valores; sin doctrina religiosa |
| `mythology` | **Mitos reales** (griegos, romanos, egipcios, etc.) vestidos con envoltorio del mundo. **Placement:** la respuesta es conocimiento escolar previo; nunca trivia de lore inventado (Binar Star, reinos, héroes del sector). **Caminos:** lore del mundo solo si acaba de enseñarse en `lesson_narrative` / `narrative_wrapper`. No confundir con religión |
| `geography` | Mapas, clima, paisajes, países, continentes |
| `history` | Cronología, civilizaciones, hechos y personajes; relación causa-efecto; tono adaptado por banda |
| `arts` | Pintura, música, teatro, **cine** (lenguaje audiovisual básico) |
| `communication` | Escucha activa, mensaje claro, medios, debate respetuoso |
| `sports` | Reglas, fair play, cuerpo, hábitos saludables |
| `politics` | Instituciones, democracia, derechos; tono adaptado por banda |
| `finance` | Ahorro, presupuesto, consumo; en `band_early`/`band_child` solo nociones muy concretas |

### 1.1 Renormalización de pesos

Si el tutor desactiva materias, el motor PHP **renormaliza** los pesos de las activas para \(\sum w = 1\) al calcular `general_level` ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md) §3.3).

### 1.2 Tabla `subjects` (futuro / migración)

```sql
-- catálogo versionado; ids estables
create table public.subjects (
  id text primary key,
  label_es text not null,
  family text not null,
  default_weight numeric not null check (default_weight > 0 and default_weight <= 1),
  zone_id text null,
  sort_order int not null default 0,
  active boolean not null default true
);
```

MVP puede seguir en PHP (`SubjectCatalog`) hasta migración; el contrato de ids es el de §1.

---

## 2. Materias base por banda (mínimo sugerido)

Conjunto que el sistema **sugiere** al fijar `age_years` / `age_band`. No impide que el tutor active otras materias del catálogo.

| `age_band` | Edad | Materias base (sugeridas) |
| --- | --- | --- |
| `band_early` | 5–7 | math · language · logic · science · arts · communication |
| `band_child` | 8–10 | math · language · reading · logic · science · arts · communication · sports |
| `band_tween` | 11–13 | math · language · reading · logic · science · culture · geography · **history** · mythology · ethics · arts · communication · sports |
| `band_teen` | 14–17 | Todas las de tween + politics · finance |
| `band_adult` | 18–64 | **Catálogo completo** (15) |
| `band_senior` | 65–99 | **Igual que adult** |

**Regla:** la dificultad de cada reto sigue `age_band` aunque el tutor active `politics` para un niño de 8 años — el contenido se simplifica, no se bloquea por edad.

### 2.1 Comportamiento al declarar edad (first-run)

1. PHP calcula `age_band`.
2. **Sugiere** `settings.learning.active_subjects` = unión de:
   - materias base de la banda (§2),
   - `parent.settings.learning.active_subjects` del hogar (si existen),
   - sin duplicados.
3. No sobrescribe si el tutor ya editó `active_subjects` en ficha.
4. Toast / nota en ficha tutor: «Se han sugerido N materias según la edad; puedes ajustarlas aquí.»

---

## 3. Activación por tripulante (tutor)

### 3.1 Modelo de datos

En `children.settings.learning` (jsonb):

```ts
interface ChildLearningSettings {
  active_subjects: string[];     // ids del catálogo §1; ≥1 obligatorio
  show_levels_to_child?: boolean; // override hogar
  adaptation_policy?: "balanced" | "easier" | "harder";
  pause_adaptation?: boolean;
}
```

Precedencia:

1. **Tripulante** (`children.settings.learning`) — manda en placement y aventura.
2. **Hogar** (`parent.settings.learning`) — defaults al crear plaza y plantilla en Ajustes.
3. **Banda** — solo sugiere base (§2), no bloquea extras.

### 3.2 UI — ficha Tripulación (`#/crew/:id`)

Bloque **«Materias de aprendizaje»** (Fase B → **contrato aprobado en esta spec**):

```
┌─ Materias de aprendizaje ─────────────────────┐
│ El examen de acceso y la aventura usarán     │
│ las materias activas. El nivel se adapta     │
│ a la edad del explorador.                  │
│                                              │
│ Fundamentales                                │
│ [✓] Matemáticas  [✓] Lengua  [✓] Lectura …  │
│ Humanidades                                  │
│ [ ] Mitología  [✓] Geografía …               │
│ … (agrupado por familia §1)                  │
│                                              │
│ ⚠ Más de 10 materias: el examen puede ser   │
│   largo; se puede reanudar.                 │
│ [ Guardar materias ]                         │
└──────────────────────────────────────────────┘
```

| Regla UI | Detalle |
| --- | --- |
| Agrupación | Por `family` del catálogo |
| Mínimo | ≥1 materia activa (422 si vacío) |
| Sin tope duro por edad | Tutor puede marcar `politics` para `band_child` |
| Aviso | Si `active_subjects.length > 10`, banner informativo |
| Guardado | Explícito; `PATCH /api/v1/crew/:id` con `settings.learning` |
| Placement en curso | Cambios aplican al **siguiente** examen o retake confirmado |

### 3.3 Ajustes (hogar)

[SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md) §2.3: `learning.active_subjects` pasa a listar **los 14 ids** como checklist por familia. Aplica como default al **crear** nueva plaza; no altera miembros existentes salvo «Aplicar a toda la tripulación».

---

## 4. Efecto en placement y niveles

### 4.1 Composición del examen

Para cada `subject_id` en `active_subjects` del tripulante:

1. Motor PHP fija `difficulty` y `item_type` según `age_band` ([SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md](SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE.md) §1.4).
2. Agente genera o viste **1 reto** por materia (camino nominal).
3. **math** y **language**: opcional **2.º reto** si `age_band` ∈ {`band_teen`, `band_adult`, `band_senior`} y la sesión no supera ~15 min estimados.

**Reanudación:** el estado del examen vive en el **ledger JSONL** de sesión (`placement_queue` / respuestas); no en `placement_exams`. Ver [SPEC_APP_JOURNEY_MECHANICS.md](SPEC_APP_JOURNEY_MECHANICS.md) y [SPEC_DATA_STORAGE_LAYERS.md](SPEC_DATA_STORAGE_LAYERS.md).

**Techo operativo:** máximo **15 materias** en un mismo `placement_exam` (validación al guardar ficha); el catálogo tiene 14 — cabe completo.

### 4.2 Niveles

Tras placement, `user_subject_levels` tiene una fila por cada materia **evaluada** (activa en el examen). Materias activas pero no llegadas en examen abandonado quedan sin fila hasta retake.

---

## 5. Aventura y zonas (nota de canon)

Solo 5 zonas MVP en [SPEC_APP_WORLD_JOURNEY_CANON.md](SPEC_APP_WORLD_JOURNEY_CANON.md). Materias sin `zone_id` dedicada:

- Usan **territorio genérico** del capítulo (`C1_first_zone`) en narrativa.
- Tarea futura: ampliar mapa (p. ej. `zone_arts`, `zone_ethics`) sin cambiar `subject_id`.

---

## 6. Criterios de aceptación

1. Catálogo PHP/BD expone los **14** `subject_id` con labels y pesos.
2. Ficha tripulante: checklist agrupado; guardar `active_subjects`; ≥1 materia.
3. Tutor activa `finance` para explorador de 9 años → placement incluye finanzas con dificultad `band_child`.
4. `band_adult` sugiere las 15 materias al declarar edad.
5. Pesos renormalizados si solo 3 materias activas.
6. Ajustes: defaults hogar con checklist ampliado.
7. PHPUnit: `SubjectCatalog`, sugerencia base por banda, renormalización pesos.

---

## Aprobación

- [x] Catálogo 15 materias (§1) incl. **historia**, ética, mitología, geografía, arte, comunicación, deporte, política, finanzas
- [x] `reading` (comprensión lectora) **separada** de `language` (lengua/gramática)
- [x] Base por banda ampliada (§2); `band_tween` con 11 materias sugeridas; teen/adult/senior con catálogo completo
- [x] Tutor activa materias por tripulante sin límite de edad (§3)
- [x] Dificultad siempre por `age_band`, no por «materia avanzada»
- [x] Placement: 1 reto/materia activa + reanudación si examen largo

**Decisión titular (31 jul 2026):** aprobado catálogo de 14; comprensión lectora separada; materias base de tween confirmadas.

---

## Estado de implementación

| Fase | Estado |
| --- | --- |
| Specify | Cerrada (aprobada) |
| Plan / Task | [SUBJECT_CATALOG_PLACEMENT_ADAPTIVE_PLAN.md](../tasks/SUBJECT_CATALOG_PLACEMENT_ADAPTIVE_PLAN.md) |
| Implement | **Hecha** — `SubjectCatalog`, ficha crew, Ajustes defaults, pesos |
| Validate | PHPUnit `SubjectCatalogTest` + Node `subject-catalog.test.js` |

**Código:** `shared/Ai/SubjectCatalog.php`, `web/js/lib/subject-catalog.js`, `CrewService` PATCH `learning`, UI checklist en `crew-panel.js`.
