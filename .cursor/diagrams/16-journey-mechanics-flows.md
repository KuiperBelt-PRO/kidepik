# 16 — Flujos de mecánicas de viaje (decisiones de producto)

**Specs:** [SPEC_APP_JOURNEY_MECHANICS.md](../specify/SPEC_APP_JOURNEY_MECHANICS.md), [SPEC_APP_WAITING_PHRASES.md](../specify/SPEC_APP_WAITING_PHRASES.md), [SPEC_APP_PLAY_FIRST_RUN.md](../specify/SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_PARALLEL_WORLDS.md](../specify/SPEC_APP_PARALLEL_WORLDS.md), [SPEC_DATA_STORAGE_LAYERS.md](../specify/SPEC_DATA_STORAGE_LAYERS.md), [SPEC_APP_PATH_CHALLENGE_COUNT.md](../specify/SPEC_APP_PATH_CHALLENGE_COUNT.md) *(implementada: N retos/camino)*, [SPEC_APP_DICTATION.md](../specify/SPEC_APP_DICTATION.md) *(propuesta: gate dictado)*

> Contratos detallados en la spec; aquí el **mapa de decisión** jugable.

## Vista global del viaje

```mermaid
flowchart TD
  A([Tripulante creado]) --> B[First-run §1]
  B --> C[Prueba de acceso §2]
  C --> D{¿Aprobado?}
  D -- NO --> C
  D -- SI --> E[Elección de caminos §3]
  E --> F[Retos del camino]
  F --> G{¿Superado?}
  G -- NO --> H[Regenerar solo camino fallido]
  H --> E
  G -- SI --> I[Niveles / rango §4]
  I --> E
  I -.-> J[Cambio de mundo opcional]
  J --> B2[First-run o continuar<br/>el otro mundo]
  B2 --> C
```

## §1 First-run — decisiones

```mermaid
flowchart TD
  A([Inicio viaje]) --> B{¿Mundo activo?}
  B -- NO --> C[Host neutro + chips mundo]
  C --> D[Guardar active_world + UI tema]
  B -- SI --> E[Mentor del mundo]
  D --> E
  E --> F{¿Nombre?}
  F -- NO --> G[Preguntar nombre]
  G --> F
  F -- SI --> H{¿Edad / banda?}
  H -- NO --> I[Preguntar edad → AgeBand]
  I --> H
  H -- SI --> J{¿traveler.md completo?}
  J -- NO --> K[Descripción especie/atuendo/…<br/>1 o N turnos]
  K --> L[character_coach → traveler.md]
  L --> J
  J -- SI --> M([Ofrecer prueba de acceso])
```

## §2 Prueba de acceso — decisiones

```mermaid
flowchart TD
  A([Comenzar prueba]) --> B[Compose placement_composer]
  B --> W[Espera: waiting_phrases 8s]
  W --> C{¿Envelope N ítems OK?}
  C -- NO --> R{¿Reintentos?}
  R -- SI --> B
  R -- NO --> Err[Error producto]
  C -- SI --> D[Persistir cola en events.jsonl]
  D --> E[Mostrar ítem i]
  E --> F[Respuesta viajero]
  F --> G{¿Correcta?}
  G -- NO --> H[Explicación breve]
  H --> I
  G -- SI --> I{¿Más ítems?}
  I -- SI --> E
  I -- NO --> J[Calcular niveles]
  J --> K{¿Aprobado?}
  K -- NO --> L[Mensaje + reinicio prueba]
  L --> A
  K -- SI --> M[Escribir niveles en Supabase]
  M --> N([Felicitación → caminos])
```

## §3 Caminos — decisiones

```mermaid
flowchart TD
  A([Elegir caminos]) --> B[Ranking híbrido PG + notas tutor]
  B --> B2[Calibrar dificultad: suelo banda + L* + rolling]
  B2 --> C[path_composer ×3 en paralelo<br/>1 camino por slot · N retos/camino]
  C --> D{¿Pack válido?}
  D -- NO slot --> C2[Reintento / fallback solo ese slot]
  C2 --> D
  D -- SI --> E[Guardar path_pack en JSONL]
  E --> F[Cartas + compose: 3 caminos<br/>dictados on: + 4.ª transcripción]
  F --> F2{¿Qué elige?}
  F2 -- Texto --> F3[Consulta mentor acotada al pack]
  F3 --> F
  F2 -- 4.ª dictado --> Dbg[Dictado §3b · path_offer / debug]
  Dbg --> F
  F2 -- Camino --> G[Intro camino + lección + compose]
  G --> G2{¿Dudas o empezar retos?}
  G2 -- Texto --> G3[Consulta mentor acotada al tema]
  G3 --> G
  G2 -- Empezar retos --> H[Mini-historia + reto k de N]
  H --> O{¿Ítems usable para materia?}
  O -- Sí --> P[Chips equipaje en pie diálogo]
  O -- No --> I
  P --> I{¿Acierto?}
  H --> I
  I -- NO --> J[Explicación]
  J --> K
  I -- SI --> K{¿Más retos?}
  K -- SI --> H
  K -- NO --> L{¿Camino superado?}
  L -- SI --> M[Felicitación + §4 niveles]
  M --> R[Reutilizar 2 caminos + compose 1 nuevo]
  R --> E
  L -- NO --> N[Regenerar SOLO ese camino]
  N --> E2[Sustituir slot en pack]
  E2 --> F
```

## §3b Dictado (propuesta — [SPEC_APP_DICTATION](../specify/SPEC_APP_DICTATION.md))

```mermaid
flowchart TD
  A([Camino superado]) --> B{enabled + política tutor}
  B -- NO --> Z([Pack siguiente])
  B -- SI --> C[dictation_composer: teoría + canónico]
  C --> T[TTS Gemini Flash · 1 WAV cacheado]
  T --> Q{¿Audio?}
  Q -- Cuota --> Skip[Sin dictado · seguir viaje]
  Skip --> Z
  Q -- SI --> Th[dictation_theory]
  Th --> L[dictation_listen · replay ilimitado]
  L --> P[Foto papel]
  P --> G[dictation_grader visión]
  G --> R{¿Aprobado o max intentos?}
  R -- NO --> L
  R -- SI --> W[weak_points ledger]
  W --> Z
```

## §4 Niveles / rango — decisiones

```mermaid
flowchart TD
  A([Fin examen o camino]) --> B[Nota interna]
  B --> C[Update niveles materia + general en PG<br/>del mundo activo]
  C --> D{¿Sube rango?}
  D -- SI --> E[Update rank_id mundo]
  D -- NO --> F
  E --> F[tutor_report.md + mensaje breve mentor]
  F --> G([Continuar viaje])
```

## §5 Espera LLM — decisiones

```mermaid
flowchart TD
  A([Compose largo]) --> B[GET waiting_phrases<br/>mundo×banda×fase]
  B --> C{¿Hay frases?}
  C -- NO --> D[Fallback mínimo neutro seed]
  C -- SI --> E[Cola rotativa]
  D --> E
  E --> F[Mostrar frase N]
  F --> G[Timer 8s]
  G --> H{¿Compose done?}
  H -- NO --> F
  H -- SI --> I([Ocultar espera / mostrar resultado])
```

## Persistencia en cada decisión clave

| Decisión | Escribe |
| --- | --- |
| Mundo / nombre / edad flags | Supabase `children` |
| Personaje | `traveler.md` |
| Cola examen / respuestas / path pack / dictados | `events.jsonl` (mundo) + WAV `/media/audio/` + fotos `/media/dictations/` (TTL) |
| Niveles oficiales | Supabase por mundo |
| Diálogo | `dialogue.jsonl` (mundo) |
