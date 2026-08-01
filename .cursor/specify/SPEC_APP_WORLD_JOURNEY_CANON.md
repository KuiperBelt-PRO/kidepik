# Spec: Canon del viaje (espina narrativa dual)

> Estado: **propuesta — pendiente de aprobación** (julio 2026); **delta §3.1 pitches de zona** (ago 2026) — ver [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md)  
> Relacionado: [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md), [SPEC_APP_CHARACTER_TRAITS.md](SPEC_APP_CHARACTER_TRAITS.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_AI_PLAY_ORCHESTRATION.md](SPEC_AI_PLAY_ORCHESTRATION.md), [docs/kidepik.md](../../docs/kidepik.md) §5–7  
> Precedencia: este documento es la **fuente de verdad del lore MVP**; el LLM **no inventa** una trama distinta — solo **instancia** escenas dentro de este marco.

## Por qué primero

La historia del viaje determina:

- Qué retos aparecen y en qué orden aproximado.
- Cómo evoluciona el personaje (logros narrativos + rango).
- Qué aprende el niño (materia ↔ zona del mapa).
- El tono del examen de acceso y de la ayuda para crear el personaje.

Sin este canon, la orquestación IA improvisaría arcos contradictorios.

## Objetivo

1. Fijar las dos tramas base (sci-fi / fantasy) y su metáfora pedagógica.
2. Definir el **mapa de zonas = materias**.
3. Definir la unidad de progreso del viaje (`journey_chapter`, `zone`, `beat`).
4. Fijar invariantes que el LLM debe respetar (y el validador rechaza si incumple).

---

## 1. Premisa compartida (ambos mundos)

| Concepto abstracto | Sci-fi | Fantasy |
| --- | --- | --- |
| Amenaza | **El Vacío** borra el conocimiento de la galaxia | El equilibrio se rompe; el **Artefacto** está fragmentado |
| Misión del niño | Recuperar conocimiento **planeta a planeta** | Restaurar fragmentos **reino a reino** |
| Rol inicial | Cadete / recluta explorador | Aprendiz / chispa del reino |
| Institución de ingreso | Academia Espacial / Cuerpo de Exploradores | Escuela de Magos / Academia del Reino |
| Mapa | Galaxia → sistemas (= materias) → planetas (= temas) | Continente → reinos (= materias) → lugares (= temas) |
| Progreso visible | Rango estelar ([SPEC_APP_PROGRESSION_RANKS.md](SPEC_APP_PROGRESSION_RANKS.md)) | Rango del reino (misma spec) |
| Aprendizaje | Cada reto “restaura” un fragmento de saber | Igual metáfora con magia/equilibrio |

**Regla de producto:** el niño **elige un mundo** y permanece en él (salvo unlock tutor / multiverso futuro). El progreso pedagógico es el mismo; solo cambian léxico, NPCs y escenografía.

---

## 2. Arco macro (capítulos MVP)

Ambos mundos comparten la misma **estructura de capítulos**. El LLM narra dentro del capítulo activo; no salta al final.

| `chapter_id` | Nombre interno | Qué vive el niño | Condición de avance |
| --- | --- | --- | --- |
| `C0_arrival` | Llegada / umbral | First-run + personaje + examen | `onboarding_step = complete` |
| `C1_first_zone` | Primera zona | 2–4 sesiones en la materia más débil o elegida | Completar quest introductoria de zona |
| `C2_crossroads` | Encrucijada | Elección de siguiente sistema/reino | 1 elección mayor persistida |
| `C3_deepening` | Profundización | Rotación de materias según niveles | N sesiones o metas de nivel |
| `C4_setback` | Contratiempo narrativo | El Vacío / sombra del Artefacto reaparece | 1 beat de crisis + reto de recuperación |
| `C5_rally` | Reagrupación | Aliado + nuevo plan | — |
| `C6_climax_mvp` | Cierre arco MVP | Confrontación simbólica (sin violencia gráfica) | Quest final capítulo |
| `C7_epilogue` | Eco | Semilla de continuación / rango celebrado | Stub post-MVP |

MVP **debe** implementar con riqueza: `C0`–`C2` y un esqueleto jugable de `C3`. Capítulos `C4+` pueden ser stubs narrativos cortos o generados bajo las mismas invariantes cuando el Plan lo active.

Persistencia sugerida en niño / journey:

```ts
journey: {
  chapter_id: "C1_first_zone",
  active_zone_id: "zone_math",
  antagonist_pressure: 0..1,  // cuánto “pesa” el Vacío/sombra
  fragments_restored: number, // contador simbólico
}
```

---

## 3. Zonas = materias (catálogo MVP)

| `zone_id` | Materia | Sci-fi (label niño) | Fantasy (label niño) |
| --- | --- | --- | --- |
| `zone_math` | `math` | Nebulosa Matemática / Planeta Geometría | Bosque de los Números |
| `zone_language` | `language` | Estación Léxico / Cometa Relato | Montañas de la Gramática |
| `zone_logic` | `logic` | Laberinto de Circuitos | Laberinto de Espejos |
| `zone_science` | `science` | Cinturón de Observatorios | Jardines Alquímicos |
| `zone_culture` | `culture` | Archivo Galáctico | Biblioteca de los Reinos |

Reglas:

1. Cada **reto de aprendizaje** declara `subject_id` y, si es narrativo de zona, `zone_id` coherente.
2. El mapa UI (futuro) y el diálogo (MVP) usan los mismos ids.
3. Si Ajustes desactiva una materia, su zona no se ofrece como destino hasta reactivarla (renormalizar pesos de examen igual que [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md)).

### 3.1 Elección de zona tras el examen

Al cerrar placement:

1. Narrativa de admisión (escuadrón / círculo) + anuncio de varios destinos.
2. Agente/motor propone **2–3 zonas** priorizando: materia con nivel más bajo (reto amable) **o** una “favorita” sugerida por rasgos del personaje.
3. Cada opción lleva **pitch completo** (contrato normativo en [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md) §2):
   - `label` — nombre del lugar en el mundo
   - `description` — qué es y qué ocurre allí (1–2 frases)
   - `why_for_you` — por qué encaja **ahora** con el perfil (sin revelar `L1`–`L5`)
4. UI: cartas de elección (título + textos), no chips planos de solo nombre.
5. El niño elige → `active_zone_id` + quest introductoria `Q_zone_intro_{zone}` con **≥3 learning gates**.
6. Ledger: `choices_offered` completo + `choice_taken`; prosa puede recordar destinos no elegidos.

---

## 4. Antagonista y tono

### Sci-fi — El Vacío

- No es un villano gore: es **olvido**, silencio en las estrellas, pantallas en blanco, planetas “sin historia”.
- El niño **restaura** saber; no “mata” al Vacío en MVP.
- Frustración del jugador → el Vacío “susurra más fuerte” en copy suave (nunca culpa al niño).

### Fantasy — Sombra del Artefacto / Desequilibrio

- Fragmentos del artefacto dispersos por reinos; cada reto recupera un brillo / runa.
- Amenaza = niebla que apaga canciones y nombres; sin sangre ni terror.

**Prohibido en ambos:** muerte gráfica, bullying, contenido adulto, política real, asustar con “perderás a tus padres”, etc. Alineado a `narrative.avoid_themes` del hogar.

---

## 5. NPCs canónicos

### 5.1 Mentor (voz única de UI)

Ver [SPEC_APP_MENTOR.md](SPEC_APP_MENTOR.md): **El Guardián del Conocimiento** (fantasy) / **El Arquitecto del Saber** (sci-fi). Toda burbuja IA es su voz.

### 5.2 Otros arquetipos (narrados por el mentor)

El LLM instancia **variantes** con estos arquetipos (ids estables en `meta.npc_ids`); el mentor los describe, no abren otro chat:

| `npc_archetype` | Función | Sci-fi ejemplo | Fantasy ejemplo |
| --- | --- | --- | --- |
| `companion` | Ánimo, comic relief suave | Droide aprendiz | Familiar mágico |
| `zone_guardian` | Presenta reto de materia | IA del planeta | Guardián del bosque |
| `antagonist_echo` | Presión narrativa | Eco del Vacío | Sombra del fragmento |

No inventar un “jefe final” fuera del capítulo activo. El arquetipo `mentor` del catálogo antiguo = el mentor de UI, no un NPC secundario.

---

## 6. Invariantes del LLM (validador)

El validador de orquestación **rechaza y re-prompt** si:

1. Cambia `world_theme` o niega hechos de `story_beats` previos.
2. Inventa un capítulo distinto al `chapter_id` activo.
3. Presenta un reto de materia sin `subject_id` en el envelope estructurado.
4. Usa vocabulario del mundo contrario (magia en sci-fi o hiperespacio en fantasy) salvo metáfora explícitamente permitida.
5. Revela niveles `L1`–`L5` al niño.
6. Supera longitud máxima de burbuja (p. ej. 500 caracteres display; soft 350).
7. Incluye temas en `avoid_themes`.

---

## 7. Relación con el aprendizaje

```
viaje (capítulo + zona)
    → genera contexto narrativo
    → selecciona / genera reto curricular (dificultad = niveles + effective_age_band)
    → resultado del reto
    → actualiza niveles (reglas en adventure session)
    → actualiza journey (fragments_restored, pressure, quest)
    → puede desbloquear rango / logro narrativo en child_traits
```

El viaje **no** es decoración: es el planificador de qué practicar. El motor pedagógico propone el `subject_id` y la dificultad; el narrador solo **viste** el reto.

---

## 8. Criterios de aceptación (documento)

1. Toda spec de play enlaza este canon para tono y zonas.
2. Caps. `C0`–`C2` tienen ids y condiciones de avance explícitas.
3. Catálogo zona↔materia es biyectivo en MVP.
4. Invariantes listadas son comprobables en tests del validador.

## Aprobación

- [ ] Premisa dual Vacío / Artefacto
- [ ] Capítulos `C0`–`C7` con MVP en `C0`–`C3`
- [ ] Zonas = materias
- [ ] Invariantes anti-alucinación de trama
- [ ] Aprendizaje subordinado al viaje (planificador pedagógico + narrador)
