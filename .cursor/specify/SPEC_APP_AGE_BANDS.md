# Spec: Bandas de edad abiertas (tripulantes de cualquier edad)

> Estado: **propuesta — pendiente de aprobación** (julio 2026)  
> Relacionado: [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [SPEC_APP_PATH_CHALLENGE_COUNT.md](SPEC_APP_PATH_CHALLENGE_COUNT.md) (default 3/5 retos por camino según banda), [docs/kidepik.md](../../docs/kidepik.md) §3  
> **Delta de producto:** los tripulantes **no** están limitados a infancia; la app admite **cualquier edad**.

## Contexto

Hasta ahora el modelo pedagógico y el copy asumían ~5–14 años (`age_7` / `age_9`). El producto se abre a **exploradores de cualquier edad** (niños, adolescentes, adultos, mayores), manteniendo la misma mecánica de viaje + aprendizaje adaptado.

La cuenta sigue siendo del **titular** (Google); los miembros de Tripulación no tienen login propio en MVP. Un adulto puede crear plazas para menores **o** para sí mismo / otros adultos.

## Objetivo

1. Ampliar `age_years` aceptado y el catálogo de `age_band` / `effective_age_band`.
2. Adaptar tono del mentor, dificultad y longitud de textos por banda.
3. Actualizar copy de producto: **tripulante / explorador**, no solo «niño».
4. Definir implicaciones legales/UX mínimas (tutor vs adulto autónomo).

---

## 1. Rango de edad

| Campo | Regla MVP |
| --- | --- |
| `age_years` | Entero **5–99** (fuera → repregunta amable) |
| Declaración | En first-run por el propio tripulante; tutor puede corregir en ficha |
| Menores | El titular de la cuenta es responsable (ya en términos); sin cambio de auth |

No hay tope superior «infantil». Edades &lt; 5 quedan fuera del MVP (contenido no calibrado).

---

## 2. Catálogo de bandas pedagógicas

Sustituye el binario `age_7` \| `age_9` como **única** taxonomía. Los ids son estables:

| `age_band` | Edad cronológica típica | Uso pedagógico | Tono mentor |
| --- | --- | --- | --- |
| `band_early` | 5–7 | Lectura corta, MCQ simple, vocabulario básico | Muy cálido, frases cortas |
| `band_child` | 8–10 | Retos mixtos; equivalente histórico ~age_7/9 bajo | Cálido, aventura clara |
| `band_tween` | 11–13 | Más texto, lógica, menos andamiaje | Cercano, menos infantilismo |
| `band_teen` | 14–17 | Complejidad media-alta; metáforas más ricas | Respetuoso, sin condescendencia |
| `band_adult` | 18–64 | Contenido adulto-amigable; humor seco ok | Colega-mentor, sin tutear forzado si formal |
| `band_senior` | 65–99 | Ritmo cómodo, tipografía ya vía settings; evitar jerga innecesaria | Claro, paciente, digno |

### 2.1 Mapeo inicial desde `age_years`

```
5–7   → band_early
8–10  → band_child
11–13 → band_tween
14–17 → band_teen
18–64 → band_adult
65–99 → band_senior
```

`effective_age_band` puede **subir o bajar una banda** tras placement / rendimiento (misma idea Vygotsky que antes), con techo/suelo en el catálogo. Narrativa: nunca «tienes nivel de X años»; sí «círculo avanzado» / «ruta intensiva» / etc. según mundo y banda.

### 2.2 Compatibilidad con datos antiguos

Si existen filas con `age_7` / `age_9`:

| Legacy | Migración |
| --- | --- |
| `age_7` | `band_child` (o `band_early` si `age_years <= 7`) |
| `age_9` | `band_tween` si age≥11 else `band_child` |

Migración SQL en el Plan de implementación.

---

## 3. Efectos en el sistema

| Área | Cambio |
| --- | --- |
| First-run edad | Chips: rangos + texto libre 5–99; no solo 6–12 |
| Placement banco | Carpetas / tags por `age_band` (no solo early/child) |
| Mentor prompts | Inyectar banda + reglas de tono ([SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md)) |
| Session length | Adultos: default 15–25 min opcional en settings; kids 8–15 |
| Safety | `avoid_themes` + filtros por banda (más estrictos en `band_early`/`band_child`) |
| Tripulación UI | Copy «miembro / tripulante»; línea de tipo muestra edad sin asumir infancia |
| Legal | Textos ya hablan de menores; revisar mención «usuarios de cualquier edad bajo cuenta titular» en ciclo legal aparte si hace falta |

### 3.1 Niveles L1–L5

Siguen siendo **pedagógicos por materia**, no «edad». Un adulto en L1 es válido (repaso / nuevo idioma / etc.). El banco elige ítems por banda + nivel.

---

## 4. Copy y terminología

| Evitar (como único término) | Preferir |
| --- | --- |
| «el niño» en specs/UI universales | tripulante, explorador, miembro |
| «padres» como único rol | tutor / titular de cuenta (sigue válido para menores) |

En código, la tabla puede seguir llamándose `children` / `child_id` en MVP (**decisión:** no renombrar tablas aún; documentar alias semántico `crew_member` / `explorer` en API DTO: `member_id` opcional alias). Renombre DB = tarea futura explícita.

---

## 5. Criterios de aceptación

1. First-run acepta edad 42 → `band_adult`.
2. Placement y mentor usan tono distinto para `band_early` vs `band_adult` (tests de prompt fixture).
3. Migración legacy `age_7`/`age_9` documentada.
4. UI Tripulación no dice «niño» de forma exclusiva.
5. Fuera de 5–99 → repregunta sin crash.

## Aprobación

- [ ] Tripulantes de cualquier edad (5–99)
- [ ] Catálogo de 6 bandas + `effective_age_band`
- [ ] Tono/dificultad acoplados a banda
- [ ] Sin rename obligatorio de tabla `children` en MVP
