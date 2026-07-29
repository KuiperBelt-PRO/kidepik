# KidepiK — Especificación de producto

> Documento maestro de visión, pedagogía, diseño y stack técnico.  
> Estado: borrador de producto · Última actualización: julio 2026

---

## 1. Visión general

**KidepiK** es una aplicación móvil gamificada (**Android e iOS**) para niños, principalmente en las franjas de **7 y 9 años**, que combina:

- **Aprendizaje estructurado** por temas, edad y dificultad adaptativa.
- **Narrativa generativa** con hilo conductor y elecciones con consecuencias.
- **Avatar personalizable** (monstruito evolutivo) como gancho de retención — *post-MVP*.
- **Píldoras de entretenimiento puro** para evitar fatiga cognitiva — *post-MVP*.

El aprendizaje no se presenta como temario escolar, sino como **retos cortos** integrados en un viaje por mundos de fantasía o space opera (el niño elige ambientación al inicio).

### Alcance MVP vs. futuro

| Área | MVP | Post-MVP |
| --- | --- | --- |
| **Plataforma** | **Android** (Google Play) e **iOS** (App Store) — una sola base de código | — |
| **Avatar** | Descripción en **puntos de texto** (sin 3D ni personalización visual) | Monstruito 3D/2.5D evolutivo |
| **Píldoras / minijuegos** | No incluidos | Minijuegos táctiles tras N lecciones |
| **IA** | OpenRouter (modelos free) + fallback Gemini/Grok free | Modelos de pago según volumen |
| **Perfil y progreso** | Tablas relacionales en PostgreSQL | Informes para padres, analíticas |
| **Infra producción** | **DreamHost PHP** + Supabase (DB + Auth) + media local (`web/media/`) | Ampliar hosting DreamHost / cuotas Supabase según volumen |

### Contexto de negocio

- **Coste operativo bajo** en fase inicial: DreamHost (app+API+media), Supabase (DB + Auth), OpenRouter free.
- Escalado **proporcional al volumen**: cuando haya usuarios de pago, ampliar recursos o activar modelos de pago sin saltos desproporcionados.- Monetización por **volumen de usuarios** con ticket bajo (freemium, créditos, suscripción familiar).
- Desarrollo asistido por IA; el cuello de botella no es el tiempo de código sino la **definición de producto y validación con padres**.

---

## 2. Marca: KidepiK

### Nombre elegido

**KidepiK** — neologismo propio, alta probabilidad de disponibilidad en marcas, dominios y tiendas.

| Aspecto | Detalle |
| --- | --- |
| **Fonética** | Evoca *Kid Epic* (niño épico) y la raíz *Epi-* (epifanía, descubrimiento). |
| **Ambigrama** | Casi palindrómico; al rotar 180° la **d** y la **p** se 
intercambian visualmente sin perder legibilidad. |
| **Logo** | Wordmark tipográfico **KidepiK**; limpio y legible; sin gimmicks animados en el nombre. |
| **Idiomas** | Pronunciable y memorable en español e inglés sin traducción. |
| **Ambientación** | Agnóstico: sirve para fantasía, space opera o multiverso. |
| **Sistema visual** | Spec: [.cursor/specify/SPEC_APP_VISUAL_DESIGN.md](../.cursor/specify/SPEC_APP_VISUAL_DESIGN.md) — temas dual fantasy / space opera. |

---

## 3. Base pedagógica

El motor educativo debe basarse en evidencia cognitiva para generar confianza en padres y resultados reales en niños.

### 3.1 Teoría de la carga cognitiva (Sweller)

- Sesiones de **microlearning**: 3–5 minutos por reto.
- Una idea por pantalla; sin paredes de texto.
- Refuerzo inmediato tras cada acierto o error guiado.

### 3.2 Zona de desarrollo próximo (Vygotsky)

- **Dificultad dinámica** según tasa de aciertos/fallos.
- Si el niño falla repetidamente: bajar ~10 % la dificultad o cambiar el enfoque (más visual, menos abstracto).
- Andamiaje: pistas progresivas antes de revelar la solución.

### 3.3 Hitos por edad (Piaget)

| Edad | Etapa cognitiva | Contenido prioritario |
| --- | --- | --- |
| **~7 años** | Pensamiento lógico concreto | Reglas de juego, gramática visual (p. ej. *Superdiccionario* interactivo), sumas/restas manipulativas, clasificación |
| **~9 años** | Mayor concentración; inicio del abstracto | Problemas multi-paso, comprensión lectora profunda, acertijos de lógica, fracciones y patrones |

### 3.4 Estructura curricular

- **Por temas:** matemáticas, lenguaje, ciencias, lógica, cultura general, etc.
- **Por edad:** filtro principal al alta del perfil; el motor afinará con el rendimiento real y el **examen de acceso** (véase §6).
- **Por mundo:** cada rama de conocimiento se mapea a una zona del mapa (planeta, reino, nebulosa).
- **Por nivel:** cada materia tiene niveles discretos (p. ej. `M1`–`M5` en matemáticas); el perfil cognitivo se **actualiza tras cada sesión** en base de datos, no en un blob JSON.

### 3.5 Conocimiento RAG (futuro próximo)

El motor de agentes podrá consumir documentos pedagógicos vectorizados (guías por edad, vocabulario por materia, plantillas de retos). La ingesta y actualización de esos corpus se diseñará como pipeline aparte; en MVP el RAG prioritario es el **historial del viaje del niño** (`story_beats`, `story_summaries`) más catálogos curriculares en tablas.

---

## 4. Sistema de avatares

> **Estado MVP:** esta sección queda **aparcada**. En el MVP el personaje se representa como **lista de rasgos en texto** (especie, color, rasgos narrativos). No hay render 3D ni personalización visual.

### Concepto (post-MVP)

El niño crea un **monstruito** (especie alienígena o criatura fantástica) que evoluciona con el aprendizaje. La progresión otorga **Materia Evolutiva** y piezas cosméticas desbloqueables.

### Representación en MVP

En pantalla de perfil y en prompts al LLM:

```
• Especie: explorador spot
• Color: verde neón
• Rasgos: ojos redondos, piernas elásticas
• Logros narrativos: salvó al droide en Nebulosa Matemática
```

El motor de historia usa esta descripción textual; no hay assets gráficos asociados.

### Diseño visual (post-MVP)

- Estética limpia tipo **Pixar**; entorno 3D o 2.5D.
- Anatomía **no humana**: piernas larguiruchas, rostros sin nariz, bocas sin dientes, pies sin dedos, etc.
- Personalización: formas corporales, ojos, brazos, colores, atuendos, accesorios.

### Progresión vinculada al aprendizaje (post-MVP)

| Módulo superado | Recompensa visual (ejemplo) |
| --- | --- |
| Ciencias | Gafas de explorador, exoesqueleto |
| Lenguaje | Alas o antenas comunicadoras |
| Matemáticas | Patrones geométricos en el cuerpo |
| Lógica | Runas o circuitos luminosos |

- *Nota:* Flutter tendría ventaja gráfica para esta fase; el stack elegido (React Native) es suficiente para MVP textual y se reevaluará si el avatar 3D exige más control de píxeles.


---

## 5. Mundos y ambientación

El niño elige **un mundo** al crear el personaje. Ambos comparten la misma mecánica de aprendizaje y progresión; solo cambian narrativa, arte y vocabulario.

### Opción A — Space Opera

- **Rol:** cadete explorador con su nave.
- **Mapa:** galaxia; cada sistema solar = asignatura; cada planeta = tema.
- **Trama base:** una fuerza (*El Vacío*) borra el conocimiento de la galaxia; la misión es recuperarlo planeta a planeta.
- **Examen de acceso (ejemplo):** prueba de ingreso a la **Academia Espacial** o al **Cuerpo de Exploradores Galáctico** — el LLM elige la variante según las elecciones del registro.

### Opción B — Fantasía épica

- **Rol:** aprendiz de magia o héroe joven.
- **Mapa:** continente con reinos (Bosque de los Números, Montañas de la Gramática…).
- **Trama base:** restaurar un artefacto fragmentado para devolver el equilibrio al reino.
- **Examen de acceso (ejemplo):** prueba a la **Escuela de Magos de los Reinos Unidos** o a la **Academia de Ciencias y Exploradores del Reino** — según elecciones iniciales.

### Multiverso (futuro)

Saltar entre dimensiones (portal mágico ↔ agujero de gusano) con el mismo avatar y progreso unificado.

---

## 6. Nivel inicial y examen de acceso

El **nivel de partida** no se fija solo por la edad declarada. Combina:

1. **Edad** → rango cognitivo base (Piaget, §3.3).
2. **Examen de acceso narrativo** → integrado en la historia de onboarding, no como test escolar visible.

### Flujo

1. Tras el registro y la elección de mundo, el LLM genera la escena de **examen de acceso** acorde al arco elegido (academia espacial, escuela de magos, etc.).
2. El niño resuelve **3–5 retos cortos** de distintas materias (presentados como obstáculos narrativos).
3. El backend registra aciertos, tiempo y tipo de error por materia.
4. Se calcula el **nivel inicial por materia** y se persiste en `user_subject_levels` (véase §9).
5. La narrativa continúa con el resultado del examen como parte del hilo (aprobado con honores, ingreso en escuadrón avanzado, etc.).

### Principios

- El examen **no muestra puntuación numérica** al niño; solo feedback narrativo.
- Los padres pueden ver un resumen en el panel familiar (*post-MVP*).
- El nivel puede **subir o bajar** en sesiones posteriores según rendimiento (Vygotsky, §3.2).

---

## 7. Motor de historia generativa (IA)

La narrativa **no está pre-escrita** de forma rígida. Actúa como hilo conductor dinámico, pero **cada beat ya generado se persiste** para no repetir ni contradecir el viaje del niño.

### Flujo

1. La API **PHP** recoge el **estado del jugador** desde PostgreSQL (perfil, niveles por materia, historial narrativo).
2. El **motor de agentes** (LangGraph u orquestación futura, §10.6) selecciona modelo vía OpenRouter y construye el prompt con contexto RAG del viaje.3. El LLM genera: introducción narrativa, contexto del siguiente reto, tono emocional.
4. Salida validada con **Pydantic**; texto adaptado al nivel lector; opcional **TTS** (*post-MVP*).
5. Tras la sesión, el niño **elige** la siguiente ruta; la elección y el texto generado se **guardan** en `story_beats`.
6. En la siguiente sesión, el motor **lee los beats anteriores** — no regenera desde cero puntos ya vividos.

### Persistencia del viaje (requisito crítico)

| Qué se guarda | Para qué |
| --- | --- |
| Texto narrativo de cada beat | Continuidad; el LLM no reescribe escenas pasadas |
| Elecciones del niño | Ramificación y consecuencias |
| Retos presentados y resultados | Evitar repetir el mismo ejercicio con distinto envoltorio |
| Resumen comprimido cada N beats | Mantener contexto dentro del límite de tokens sin perder hilo |
| Embeddings de beats/resúmenes (*futuro*) | Búsqueda semántica en pgvector para RAG de largo plazo |

El LLM recibe: **resumen acumulado** + **últimos K beats completos** + estado actual. Nunca se le pide «inventar de nuevo» un tramo ya registrado.

### Inputs clave para el LLM

- Edad y niveles por materia (desde tablas, no JSON monolítico).
- Tema y dificultad del reto actual.
- Descripción textual del personaje (MVP; avatar visual *post-MVP*).
- Mundo activo y zona del mapa.
- Historial de elecciones y beats narrativos (desde BD).
- Resultado de la última sesión (aciertos, frustración estimada).

### Restricciones de seguridad y tono

- Lenguaje apto para infancia; sin violencia gráfica ni miedo intenso.
- Longitud acotada por sesión.
- Validación de salida (filtros + re-prompt si hace falta).

---

## 8. Píldoras de entretenimiento puro

> **Estado MVP:** **no incluidas**. Se implementarán cuando exista el núcleo de historia + lecciones validado con usuarios.

Para evitar saturación cognitiva (*futuro*): **cada 3 lecciones superadas** se desbloquea una píldora de ~2 minutos.

Ejemplos (*post-MVP*):

- Minijuego táctil (esquivar asteroides / atrapar luciérnagas).
- Interacción con el avatar (cosquillas, cambio de expresión).
- Burbujas de colores, composición musical tocando elementos.
- Bingos o cartones temáticos rápidos (sin sustituir el núcleo educativo).

Las píldoras **no evalúan** rendimiento académico; solo refuerzan hábito y diversión.

---

## 9. Modelo de datos (PostgreSQL + pgvector)

El **perfil del usuario, los niveles por materia y el progreso del viaje** viven en **tablas relacionales**, no en un documento JSON único. JSON/JSONB solo donde aporte flexibilidad puntual (p. ej. metadatos de un reto o scores del examen de acceso).

PostgreSQL incluye la extensión **pgvector** para embeddings del RAG (historial largo, corpus pedagógico futuro). Relacional y vectorial en la **misma base de datos** simplifica la infraestructura.

### Esquema propuesto (borrador)

```
parent_accounts          -- cuenta padre/tutor (vinculada a Supabase Auth u auth propio)
  id, auth_provider_id, email, created_at

children                 -- perfil del niño (1..N por cuenta padre)
  id, parent_id, display_name, birth_date, age_band, world, locale, created_at

child_traits             -- MVP: rasgos textuales del personaje
  child_id, trait_key, trait_value

subjects                 -- catálogo: matematicas, lenguaje, ciencias, logica...
subject_levels           -- catálogo de niveles por materia (M1..M5, descripción)

user_subject_levels      -- nivel actual del niño por materia (se actualiza tras cada sesión)
  child_id, subject_id, level_id, accuracy_rolling, difficulty_modifier, updated_at

placement_exams          -- resultado del examen de acceso
  child_id, world, narrative_variant, completed_at, raw_scores (jsonb)

learning_sessions        -- cada sesión de juego/aprendizaje
  id, child_id, subject_id, topic, started_at, ended_at, accuracy, frustration_score

session_answers          -- respuestas individuales (para adaptación y no repetir)
  session_id, question_hash, correct, response_time_ms

story_beats              -- unidad atómica del viaje narrativo
  id, child_id, sequence_num, zone, narrative_text, choices_offered (jsonb),
  choice_made, quest_id, generated_at, model_used

story_summaries          -- resúmenes comprimidos cada N beats (para contexto LLM)
  child_id, up_to_beat_id, summary_text, token_count

story_embeddings         -- (*futuro*) vectores de beats/resúmenes para RAG semántico
  beat_id, embedding vector(1536)

knowledge_chunks         -- (*futuro*) corpus pedagógico vectorizado
  id, subject_id, age_band, content, embedding vector(1536)

narrative_quests         -- misiones activas/completadas
  id, child_id, quest_key, status, started_at, completed_at

api_usage                -- cuotas IA por usuario/modelo/día
  user_id, model, tokens, date
```

### Políticas

- La app móvil **nunca** accede a PostgreSQL directamente; solo vía **API PHP** con JWT validado.- Autorización en capa API: cada padre solo opera sobre sus `children` (equivalente funcional a RLS).
- Retención y borrado: política RGPD / menores (*pendiente legal*).

### Contrato API (vista agregada)

La API expone un DTO `PlayerState` ensamblado desde joins, para la app y el motor IA:

```typescript
interface PlayerState {
  childId: string;
  profile: { displayName: string; age: number; world: string; locale: string };
  traits: Record<string, string>;           // MVP: texto
  subjectLevels: SubjectLevelSnapshot[];  // desde user_subject_levels
  activeQuest: QuestSnapshot | null;
  recentBeats: StoryBeatSummary[];          // últimos K beats
  journeySummary: string;                   // desde story_summaries
}
```

> **Pendiente:** migraciones SQL definitivas, enums, índices y extensiones pgvector en `.cursor/specify/`.

---

## 10. Arquitectura técnica

### 10.1 Plataformas objetivo

| Plataforma | Soporte |
| --- | --- |
| **Android** | Sí — Google Play |
| **iOS** | Sí — App Store |

Una sola base de código **web** (`web/`) sirve navegador y, en fase posterior, **Capacitor** para Google Play y App Store.

### 10.2 Elección del cliente

| Característica | Web HTML/CSS/JS + Capacitor ✓ | React Native + Expo |
| --- | --- | --- |
| Calidad visual premium | Ilustración, Rive/Lottie, CSS en capas | UI programática limitada sin pipeline de arte |
| Iteración diseño | Navegador + Electron viewport móvil | Expo Go / Metro |
| Tiendas | Capacitor empaqueta los mismos estáticos | EAS Build nativo |
| Complejidad MVP | Baja (sin bundler obligatorio) | Media-alta |

**Decisión (jun 2026): web-first.** Cliente en `web/` (HTML + CSS + JavaScript). Capacitor para distribución móvil cuando corresponda. Spec: [.cursor/specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](../.cursor/specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md).

### 10.3 Stack acordado

| Capa | Tecnología | Notas |
| --- | --- | --- |
| **App cliente** | **HTML + CSS + JS** en `web/`; **Capacitor** (fase posterior) | Android + iOS vía WebView nativo |
| **Backend / API** | **PHP 8.2+** (`api/` + `shared/`) | Mismo origen que `web/`; DreamHost en prod |
| **Agentes y RAG** | **Fase posterior** (LangGraph u orquestación acordada) | Narrativa, validación pedagógica — no bloquea MVP hosting |
| **Base de datos** | **PostgreSQL + pgvector** (Supabase) | Relacional + vectorial |
| **Auth** | **Supabase Auth** | JWT validado en PHP — ver §10.8 |
| **Storage de archivos** | **Filesystem `web/media/`** | [SPEC_MEDIA_STORAGE.md](../.cursor/specify/SPEC_MEDIA_STORAGE.md) |
| **IA** | **OpenRouter** (modelos `:free`) | Gateway unificado; ver §10.6 |
| **Proxy / TLS** | nginx (Docker/DreamHost) | Producción DreamHost |
| **Contenedores** | **Docker + Docker Compose** | Local (`poc-up`); prod DreamHost no requiere compose |
| **TTS (opcional)** | API de voz del proveedor elegido | *Post-MVP* |
| **CI/CD** | GitHub Actions | Tests PHPUnit; Capacitor build móvil (fase posterior) |
| **Web comercial** | **Vercel + Next.js** (*opcional*) | Solo landing/marketing |
| **Pagos** | Stripe (*futuro*) | Sin coste fijo |

### 10.4 Entornos: local vs producción

Dos entornos con **la misma topología lógica** (API + Postgres + pgvector), distinto host.

#### Desarrollo local

```
┌─────────────────────────────────────────────────────────┐
│  PC de desarrollo (Windows)                              │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐   │
│  │ web/ (app)   │    │  Docker Compose (local)      │   │
│  │ navegador /  │───►│  • nginx + PHP-FPM (api/)    │   │
│  │ Electron dev │    │  • media: web/media/         │   │
│  └──────────────┘    │  • Supabase CLI (54321)      │   │
│                      └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Backend y media** en Docker (`:8082`); Supabase CLI para Auth/DB.
- **Frontend:** `./scripts/poc-up.ps1` → app+API en `http://localhost:8082`; preview móvil con `./scripts/poc-web-preview.ps1` (Electron 390×844).
- Sin PHP nativo en el host Windows; ver reglas del workspace. Spec: [.cursor/specify/SPEC_POC_DOCKER_LOCAL_DEV.md](../.cursor/specify/SPEC_POC_DOCKER_LOCAL_DEV.md).

#### Producción

**MVP (activo):** DreamHost PHP + Supabase + media local — diagrama en §10.5.1.

**North star (Oracle ARM monolito):**

```
┌─────────────────────────────────────────────────────────┐
│  VM Ubuntu en Oracle Cloud (ARM Ampere A1)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker Compose                                  │   │
│  │  • Traefik / NPM  (80, 443, Let's Encrypt)      │   │
│  │  • PHP API / nginx (o runtime acordado)         │   │
│  │  • PostgreSQL + pgvector (volumen persistente)  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
┌────────┴────────┐
│  App web /    │  Android / iOS (Capacitor)
│  Capacitor    │
└─────────────────┘
```

**Ventaja del monolito (si algún día se unificara compute+DB):** latencia baja. **Producto actual:** PHP en DreamHost + Postgres en Supabase + media en disco.

### 10.5 Hosting — vía canónica (julio 2026)

| Vía | Estado | Descripción |
| --- | --- | --- |
| **DreamHost PHP + Supabase + media local** | **Única vía de producto** | App+API PHP en DreamHost; Supabase DB+Auth; ficheros en `web/media/` — [SPEC_HOSTING_FREE_TIER_STACK.md](../.cursor/specify/SPEC_HOSTING_FREE_TIER_STACK.md) |

**Descartado (no reabrir sin decisión explícita):** Cloudflare R2/S3, MinIO, FastAPI, GCP Cloud Run, Oracle OCI Always Free.

#### 10.5.1 DreamHost PHP (arquitectura activa)

```
┌─────────────┐     JWT (Supabase)      ┌─────────────────────────────┐
│  App web    │ ───────────────────────►│  PHP API (mismo origen)     │
│  Capacitor  │     HTTPS               │  DreamHost                  │
└──────┬──────┘                         └───────┬─────────────────────┘
       │ GET /media/...                         │
       ▼                                        ▼
┌─────────────┐                         ┌──────────┐
│ Filesystem  │                         │ Supabase │
│ web/media/  │                         │ Postgres │
│             │                         │ + Auth   │
└─────────────┘                         └──────────┘
```

**Piezas fijas:**

- **Supabase:** Postgres (pgvector) + Auth. La app obtiene JWT; PHP lo valida.
- **Media:** filesystem bajo `web/media/` (local Docker / DreamHost).
- **PHP:** API en el mismo dominio que `web/`.

Guía local: [docs/POC_LOCAL.md](../docs/POC_LOCAL.md) + [SPEC_POC_DOCKER_LOCAL_DEV.md](../.cursor/specify/SPEC_POC_DOCKER_LOCAL_DEV.md).  
Aviso histórico FastAPI (no implementar): [SPEC_POC_LOCAL_ARCHITECTURE.md](../.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md).

#### 10.5.2 Neon vs Supabase

Metáfora: **Neon = solo el motor** (Postgres serverless); **Supabase = el coche entero** (DB + Auth + APIs).

| Característica | Neon | Supabase |
| --- | --- | --- |
| Producto | Postgres serverless | BaaS completo |
| Auth | No | Sí (email, Google, Apple) |
| Storage producto | No usamos el de Supabase | Media en `web/media/` |
| pgvector | Sí | Sí |

**Decisión KidepiK:** **Supabase** (DB + Auth).

#### 10.5.3 Media

Solo filesystem `web/media/` — [SPEC_MEDIA_STORAGE.md](../.cursor/specify/SPEC_MEDIA_STORAGE.md). Sin object storage cloud.

#### 10.5.4 Compute descartado

GCP Cloud Run, Oracle ARM/Micro y FastAPI **no** forman parte del plan de producto. Hosting = DreamHost PHP.

Referencias: [SPEC_HOSTING_FREE_TIER_STACK.md](../.cursor/specify/SPEC_HOSTING_FREE_TIER_STACK.md), [SPEC_MEDIA_STORAGE.md](../.cursor/specify/SPEC_MEDIA_STORAGE.md).

### 10.6 Motor de agentes, OpenRouter y RAG

**OpenRouter** como **único gateway** hacia varios proveedores free, con fallback y gestión de límites.

#### Modelos free (prioridad rotativa)

| Proveedor vía OpenRouter | Uso preferente | Límite free (orientativo) |
| --- | --- | --- |
| Google Gemini Flash | Narrativa, examen de acceso | Cuota diaria |
| xAI Grok | Fallback narrativa | Cuota OpenRouter |
| Otros `:free` en OpenRouter | Cola de respaldo | Según catálogo |

#### Orquestación (LangGraph)

```
Request narrativo (API PHP)
       │
       ▼
┌─────────────────┐
│ Rate limiter    │  ← por usuario + global (tabla api_usage o Redis)
│ + quota tracker │
└────────┬────────┘
         ▼
┌─────────────────┐
│ RAG             │  ← story_beats + summaries + pgvector (Supabase Postgres)
│ + subject levels│
└────────┬────────┘
         ▼
┌─────────────────┐
│ LangGraph       │  ← agente narrador → validador pedagógico → formateador
│ (multi-agente)  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Model router    │  ← OpenRouter: modelo A → B → C si 429/5xx
└────────┬────────┘
         ▼
┌─────────────────┐
│ Output guard    │  ← Pydantic + tono infantil + longitud
└────────┬────────┘
         ▼
   Persistir beat en story_beats
```

#### Gestión de límites

- **Contador en BD** (`api_usage`) para no superar cuotas diarias.
- Si todos los modelos free están agotados: mensaje amable en app («tu explorador descansa hasta mañana») — **nunca** factura sorpresa.
- Cuando haya ingresos: modelos de pago en OpenRouter con techo mensual configurable.

### 10.7 API, credenciales y seguridad App ↔ API

```
┌─────────────┐     JWT (Supabase)      ┌──────────────────┐
│  App web    │ ───────────────────────►│  PHP API         │
│  Capacitor  │     HTTPS only          │  /api/v1/*       │
└──────┬──────┘                         └────────┬─────────┘
       │                                         │
       │ GET /media/...                          │ DATABASE_URL
       ▼                                         ▼
┌─────────────┐                         ┌──────────────────┐
│ web/media/  │                         │  Supabase        │
│ filesystem  │                         │  Postgres        │
└─────────────┘                         └──────────────────┘
                                                 │
                                    OPENROUTER_API_KEY (solo servidor)
                                                 ▼
                                        ┌──────────────────┐
                                        │  OpenRouter      │
                                        └──────────────────┘
```

| Secreto | Dónde vive | Quién lo usa |
| --- | --- | --- |
| Clave pública Supabase (anon) | App | App → Supabase Auth |
| `DATABASE_URL` (Supabase) | Solo servidor | PHP → Postgres |
| JWKS / validación JWT Supabase | Solo servidor | PHP valida JWT |
| `OPENROUTER_API_KEY` | Solo servidor | PHP → OpenRouter |
| JWT del usuario | Memoria segura en app | Cada llamada a API |

**Reglas:**

- TLS en producción (DreamHost).
- La API valida JWT en cada request; comprueba que `child_id` pertenece al padre autenticado.
- Rate limiting por usuario (p. ej. 30 req/min) para proteger cuotas free de IA.
- Sin secretos de IA ni credenciales de BD en el bundle de la app.

### 10.8 Supabase y media

#### Supabase (DB + Auth — sí; Storage — no)

| Pieza Supabase | ¿Usarla en KidepiK? |
| --- | --- |
| PostgreSQL hospedado (+ pgvector) | **Sí — BD principal** |
| Auth (email, Google, Apple) | **Sí** — JWT hacia API PHP (MVP: Google) |
| Storage | **No** — media en `web/media/` |
| Edge Functions | **No** — lógica en PHP |
| API REST automática (PostgREST) | **No** — la app habla con `/api/v1` PHP |

Flujo: la app obtiene JWT de Supabase Auth → PHP valida JWT → lee/escribe en Postgres Supabase.

#### Media

Ficheros bajo `web/media/`; BD guarda URLs/rutas. [SPEC_MEDIA_STORAGE.md](../.cursor/specify/SPEC_MEDIA_STORAGE.md).

Ver [SPEC_HOSTING_FREE_TIER_STACK.md](../.cursor/specify/SPEC_HOSTING_FREE_TIER_STACK.md).

### 10.9 Papel de Vercel (opcional)

**Vercel** despliega frontends web y funciones serverless ligeras (ecosistema Next.js). **No** compila apps móviles ni ejecuta contenedores PHP.

Uso previsto en KidepiK: **landing page** de marketing para padres (Next.js), si se necesita SEO. El núcleo del producto (app + API + BD) **no** va en Vercel.

### 10.10 Operativa con agentes Cursor

Los agentes trabajan sobre el stack canónico (Docker local `:8082`, specs en `.cursor/`, diagramas en `.cursor/diagrams/`). Deploy DreamHost vía SFTP/rsync documentado en operations cuando exista el flujo. **No** hay aprovisionamiento OCI ni Cloud Run en el plan de producto.

### 10.11 Alternativas evaluadas (resumen)

| Tecnología | Decisión |
| --- | --- |
| **Flutter** | Descartado por ahora; reservado si avatar 3D exige más control gráfico |
| **Nativo duplicado (Swift + Kotlin)** | Descartado |
| **Supabase como backend completo** | Descartado; **DB + Auth sí**, Storage no |
| **Supabase Storage** | Descartado (egress); media en `web/media/` |
| **Neon** | Alternativa DB; Supabase elegido por Auth integrado |
| **Vercel como backend** | Descartado |
| **JSON monolítico como fuente de verdad** | Descartado |
| **Llamada IA directa desde la app** | Descartado |
| **Replit como producción** | Descartado |
| **Render / Koyeb free como producción** | Descartado (RAM, sleep) |
| **GCP Cloud Run** | Descartado (no hosting de producto) |
| **Oracle ARM / Micro** | Descartado (no hosting de producto) |
| **Cloudflare R2 / MinIO / FastAPI** | Descartado |
| **GCP e2-micro** | Descartado (1 GB, solo US) |

### 10.12 Coste cero → escalado proporcional

| Fase | Usuarios | Infra | IA |
| --- | --- | --- | --- |
| **0 — MVP** | < 500 | DreamHost PHP + Supabase + media local; Docker `poc-up` en dev | Solo modelos `:free` vía OpenRouter |
| **1 — Tracción** | 500–5k | Ampliar cuotas / Supabase Pro / plan DreamHost | Mix free + modelos pago con techo |
| **2 — Escala** | > 5k | Escalar mismo stack (PHP + Supabase + disco) según cuello de botella | Router por tier (free vs premium) |
### 10.13 Principios de código

- SOLID, KISS, YAGNI.
- Separar: UI web · API PHP · motor IA (fase posterior) · persistencia (Postgres).
- **Paridad local/producción:** mismo contrato HTTP; local vía Docker PHP (`poc-up`), prod DreamHost.- Preparar módulos futuros: avatar 3D, píldoras, panel padres, ingesta RAG de corpus pedagógico.

---

## 11. Modo historia

- Hilo conductor continuo entre sesiones.
- Generación **sobre la marcha** según elecciones iniciales (alta de personaje) y decisiones posteriores.
- El aprendizaje se presenta como **obstáculo narrativo** (código numérico, runa, idioma alienígena…) que hay que resolver para avanzar.
- Sensación de **viaje**: el niño es protagonista, no alumno pasivo.
- **Continuidad garantizada** por `story_beats` y resúmenes — el viaje es único y persistente.

---

## 12. Entorno de desarrollo y pruebas

### Entornos de preview

| Entorno | Herramienta | Requisitos / notas |
| --- | --- | --- |
| **PC — desarrollo** | `./scripts/poc-up.ps1` → `http://localhost:8082` | Docker Desktop; ver `SPEC_POC_DOCKER_LOCAL_DEV` |
| **PC — viewport móvil** | `./scripts/poc-web-preview.ps1` (Electron 390×844) | Misma app web, marco fijo |
| **Agentes / E2E** | MCP Playwright, viewport 390×844 | Capturas en `tmp/playwright-output/` |
| **Móvil físico (fase Capacitor)** | Build Capacitor en dispositivo | Posterior al MVP web |

### Flujo de desarrollo día a día

1. Levantar stack local: `./scripts/poc-up.ps1` (Docker nginx+PHP + Supabase CLI).
2. Abrir `http://localhost:8082` (loader → auth → legal). Opcional: `./scripts/poc-web-preview.ps1`.
3. Validar UI en navegador o Electron; agentes con Playwright viewport móvil.
4. Builds de tienda: **Capacitor** (fase posterior) empaquetando `web/`.

### Matriz de pruebas mínima (MVP)

- **Web:** flujo loader → auth → legal en `localhost:8082` (`poc-up.ps1`).
- **Backend:** tests `pytest` contra API local en Docker.
- **Casos funcionales:** registro padre, alta de niño, elección de mundo, examen de acceso narrativo, una lección, elección narrativa, verificación de que el siguiente beat **no repite** el anterior, persistencia tras cerrar app.

---

## 13. Modelo de monetización

| Modelo | Detalle |
| --- | --- |
| **Freemium** | Modo historia básico; lecciones diarias limitadas |
| **Premium (suscripción familiar)** | Historias ilimitadas, informes de progreso, modelos IA de mayor calidad |
| **Créditos (opcional)** | Packs para contenido extra |
| **Publicidad** | Solo en versión gratuita; sin anuncios intrusivos en flujo infantil |

Objetivo: **margen alto** por uso de APIs free al inicio y precio bajo × muchos usuarios cuando escale.

---

## 14. Roadmap de definición (pendiente)

Antes de implementar, cerrar en specs derivadas (`.cursor/specify/`) y operativa (`.cursor/operations/`):

- [x] Stack Docker local PHP + Supabase (`poc-up`) — ver SPEC_POC_DOCKER_LOCAL_DEV.
- [ ] Migraciones SQL definitivas producto (tablas §9, índices, extensión pgvector) — parcial vía PHP legal/bootstrap.
- [ ] Motor IA / agentes (LangGraph u alternativa) acoplado a API PHP.
- [ ] Enums de materias y niveles por edad (MVP: 2–3 materias).
- [ ] System prompts: examen de acceso, beat narrativo, generación de reto.
- [ ] Model router OpenRouter: orden de fallback y límites por usuario.
- [ ] Contrato OpenAPI `/api/v1` (profile, session, story).
- [ ] Flujo de pantallas MVP: registro → mundo → examen de acceso → mapa → lección → elección.
- [ ] Deploy DreamHost (web + api + shared + media).
- [ ] Documentar flujo SFTP/rsync en `.cursor/operations/` cuando esté listo.
- [ ] Playbook post-provisionado SSH (Docker, despliegue, backups Postgres).
- [x] Decisión Auth MVP: Supabase Auth + Google.
- [ ] Política de privacidad y consentimiento parental (COPPA / RGPD) — textos legales en app parcialmente.
- [ ] Comprobación final de marca **KidepiK** (OEPM, EUIPO, Play Store, App Store, dominio).
- [ ] Landing marketing en Vercel (*opcional*).

---

## 15. Glosario

| Término | Significado |
| --- | --- |
| **Beat narrativo** | Unidad persistida de historia (texto + elección + contexto) |
| **Examen de acceso** | Prueba narrativa de onboarding que fija niveles iniciales por materia |
| **Materia Evolutiva** | Moneda de progresión para personalizar el avatar (*post-MVP*) |
| **Píldora** | Minijuego de entretenimiento puro tras N lecciones (*post-MVP*) |
| **Zona** | Región del mapa asociada a una rama de conocimiento |
| **PlayerState** | DTO agregado desde BD para app y motor IA |
| **Model router** | Selector de modelo OpenRouter con fallback y cuotas |
| **LangGraph** | Orquestador de flujos multi-agente con estado (Python) |
| **pgvector** | Extensión Postgres para búsqueda vectorial (RAG) |
| **OCI** | Oracle Cloud Infrastructure |

---

## 16. Referencias pedagógicas

- Sweller, J. — *Cognitive Load Theory* (microlearning, carga intrínseca/extrínnea).
- Vygotsky, L. — *Zona de desarrollo próximo* (andamiaje y dificultad adaptativa).
- Piaget, J. — Etapas del desarrollo cognitivo (7 años: operaciones concretas; 9 años: camino al formal).

---

*Documento vivo. Las specs de implementación detalladas vivirán en `.cursor/specify/`; la operativa de infraestructura en `.cursor/operations/` — según el flujo SDD del repositorio.*
