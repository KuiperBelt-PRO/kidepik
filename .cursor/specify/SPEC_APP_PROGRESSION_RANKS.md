# Spec: Rangos de progresión (sci-fi y fantasía)

> Estado: **aprobada como marco** (julio 2026) — catálogo fino de rangos y arte **se ampliará más adelante**; este documento fija el contrato  
> Relacionado: [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [docs/kidepik.md](../../docs/kidepik.md) §4–5

## Contexto

Además de niveles pedagógicos (`L1`–`L5` por materia y general), el niño debe **sentir** progreso en el lenguaje de su mundo: grados de cadete / rangos de academia espacial **o** grados de aprendiz / órdenes del reino fantástico. Esas etiquetas no sustituyen el modelo cognitivo; lo **traducen**.

## Objetivo

1. Separar **nivel pedagógico** vs **rango narrativo**.
2. Definir ejes de progresión duales (sci-fi / fantasy).
3. Mapear de forma provisional nivel general → rango.
4. Dejar extensión explícita para catálogos ricos (nombres, insignias, umbrales por materia) en una revisión futura.

**No implementar** hasta que exista aventura + placement cableados; hasta entonces basta persistir `rank_id` nullable.

---

## Principios

| Principio | Decisión |
| --- | --- |
| Dual | Dos catálogos; uno activo según `world_theme` |
| Pedagógico manda | El motor de dificultad usa `L*`; el rango es presentación |
| Visible al niño | Sí, como título honorífico; sin números de examen |
| Visible al tutor | Label + nivel L* detrás |
| Extensible | Tabla/catálogo versionado; no hardcode eterno en UI |

---

## 1. Modelo

```ts
type RankTrack = "sci-fi" | "fantasy";

interface RankDef {
  id: string;           // "scifi_cadet_1"
  track: RankTrack;
  tier: number;         // 1..N orden
  label_child: string;  // mostrado al niño
  label_tutor: string;
  min_general_level: "L1" | "L2" | "L3" | "L4" | "L5";
}
```

Persistencia en niño:

```sql
-- columns on children or child_progress
rank_id text null,
rank_track text null check (rank_track in ('sci-fi', 'fantasy'))
```

Al elegir `world_theme`, `rank_track` = ese tema. Al completar placement, asignar rango inicial por mapa §2. Subidas posteriores: aventuras + niveles (spec futura de progresión continua).

---

## 2. Catálogo MVP (provisional — a enriquecer)

### 2.1 Ciencia ficción

| tier | id | label_child | min_general |
| --- | --- | --- | --- |
| 1 | `scifi_recruit` | Recluta estelar | L1 |
| 2 | `scifi_cadet` | Cadete explorador | L2 |
| 3 | `scifi_ensign` | Alférez de ruta | L3 |
| 4 | `scifi_lieutenant` | Teniente de nebulosa | L4 |
| 5 | `scifi_captain` | Capitán del saber | L5 |

### 2.2 Fantasía

| tier | id | label_child | min_general |
| --- | --- | --- | --- |
| 1 | `fantasy_spark` | Chispa del reino | L1 |
| 2 | `fantasy_apprentice` | Aprendiz de los reinos | L2 |
| 3 | `fantasy_adept` | Adepto del artefacto | L3 |
| 4 | `fantasy_guardian` | Guardián del saber | L4 |
| 5 | `fantasy_archon` | Archón del equilibrio | L5 |

**Regla de asignación:** mayor `tier` cuyo `min_general_level` ≤ `general_level` actual.

---

## 3. Ampliaciones futuras (fuera de detalle ahora)

Documentar aquí el **backlog** para no olvidarlo:

- Rangos intermedios (más de 5) y ramas por facción / escuela.
- Insignias cosméticas ligadas a materias (math → “cartógrafo de asteroides”, etc.).
- Ceremonias narrativas al subir de rango (beat especial).
- Sync con avatar post-MVP.
- Nombres y lore aprobados con diseño / copy final.

Cuando se aborde: nueva versión de esta spec o `SPEC_APP_PROGRESSION_RANKS_V2.md` sin romper ids MVP (migración de labels OK; ids estables).

---

## 4. API / UI

- Incluir `rank: { id, label_child, tier }` en DTO play y crew.
- Diálogo puede saludar con el rango tras placement.
- Tripulación (tutor): mostrar label + L general.

## Aprobación

- [x] Separación nivel pedagógico vs rango narrativo
- [x] Catálogo dual provisional 5 tiers
- [x] Enriquecimiento de rangos explícitamente aplazado
