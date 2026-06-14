# KidepiK — Especificación de producto

> Documento maestro de visión, pedagogía, diseño y stack técnico.  
> Estado: borrador de producto · Última actualización: junio 2026

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
| **Infra producción** | Oracle Cloud Always Free (ARM) | Escalar instancia o migrar piezas si hace falta |

### Contexto de negocio

- **Coste operativo cero** en fase inicial: Oracle Always Free, Expo, OpenRouter free, modelos `:free`, Supabase Auth/Storage (*opcional*).
- Escalado **proporcional al volumen**: cuando haya usuarios de pago, ampliar recursos o activar modelos de pago sin saltos desproporcionados.
- Monetización por **volumen de usuarios** con ticket bajo (freemium, créditos, suscripción familiar).
- Desarrollo asistido por IA; el cuello de botella no es el tiempo de código sino la **definición de producto y validación con padres**.

---

## 2. Marca: KidepiK

### Nombre elegido

**KidepiK** — neologismo propio, alta probabilidad de disponibilidad en marcas, dominios y tiendas.

| Aspecto | Detalle |
| --- | --- |
| **Fonética** | Evoca *Kid Epic* (niño épico) y la raíz *Epi-* (epifanía, descubrimiento). |
| **Ambigrama** | Casi palindrómico; al rotar 180° la **d** y la **p** se intercambian visualmente. |
| **Logo** | La *d* y la *p* pueden ser los **ojos del avatar**; al girar el móvil el monstruito puede cambiar expresión (*post-MVP*). |
| **Idiomas** | Pronunciable y memorable en español e inglés sin traducción. |
| **Ambientación** | Agnóstico: sirve para fantasía, space opera o multiverso. |

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

1. La API **FastAPI** recoge el **estado del jugador** desde PostgreSQL (perfil, niveles por materia, historial narrativo).
2. El **motor de agentes** (LangGraph, véase §10.6) selecciona modelo vía OpenRouter y construye el prompt con contexto RAG del viaje.
3. El LLM genera: introducción narrativa, contexto del siguiente reto, tono emocional.
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

- La app móvil **nunca** accede a PostgreSQL directamente; solo vía **API FastAPI** con JWT validado.
- Autorización en capa API: cada padre solo opera sobre sus `children` (equivalente funcional a RLS).
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

Una sola base de código con **React Native + Expo** compila para ambas tiendas.

### 10.2 Elección del framework móvil

| Característica | React Native + Expo ✓ | Flutter |
| --- | --- | --- |
| Lenguaje | JavaScript / TypeScript | Dart |
| Curva de arranque | Mínima con ecosistema web/React | Moderada (árbol de Widgets) |
| Rendimiento UI | Muy bueno (puente a componentes nativos) | Excelente (render propio; ideal para animaciones 60 fps) |
| Ecosistema | NPM gigantesco | pub.dev muy completo |
| Desarrollo | Expo Go, hot reload, EAS Build en la nube | Flutter tooling propio |

**Decisión: React Native + Expo.** Prioriza velocidad de iteración, familiaridad con React/TypeScript e integración rápida con APIs REST. Flutter queda como alternativa valorada para la fase de avatar 3D gamificado (*post-MVP*) si el rendimiento visual lo exige.

### 10.3 Stack acordado

| Capa | Tecnología | Notas |
| --- | --- | --- |
| **App móvil** | **React Native + Expo** (TypeScript) | Android + iOS; EAS Build para tiendas |
| **Backend / API** | **FastAPI** (Python 3.11+) | Asíncrono; Pydantic; streaming de respuestas IA |
| **Agentes y RAG** | **LangGraph** (+ LangChain según necesidad) | Flujos multi-agente: narrativa, validación pedagógica, formato |
| **Base de datos** | **PostgreSQL + pgvector** | Relacional + vectorial en el mismo motor |
| **Auth** | **Supabase Auth** (*recomendado MVP*) o JWT propio en FastAPI | Ver §10.8 |
| **Storage de archivos** | Supabase Storage (*opcional*) o volumen en Oracle | Avatares e imágenes *post-MVP* |
| **IA** | **OpenRouter** (modelos `:free`) | Gateway unificado; ver §10.6 |
| **Proxy / TLS** | **Traefik** o **Nginx Proxy Manager** | Solo en producción (Oracle) |
| **Contenedores** | **Docker + Docker Compose** | Local y producción con el mismo modelo |
| **TTS (opcional)** | API de voz del proveedor elegido | *Post-MVP* |
| **CI/CD** | GitHub Actions | Tests, build imagen Docker, EAS Build móvil |
| **Web comercial** | **Vercel + Next.js** (*opcional*) | Solo landing/marketing; no aloja backend ni app móvil |
| **Pagos** | Stripe (*futuro*) | Sin coste fijo |

### 10.4 Entornos: local vs producción

Dos entornos con **la misma topología lógica** (API + Postgres + pgvector), distinto host.

#### Desarrollo local

```
┌─────────────────────────────────────────────────────────┐
│  PC de desarrollo (Windows)                              │
│                                                          │
│  ┌──────────────┐    ┌─────────────────────────────┐   │
│  │ Expo (app)   │    │  Docker Compose (local)      │   │
│  │ emulador /   │───►│  • FastAPI (backend)         │   │
│  │ Expo Go / web│    │  • PostgreSQL + pgvector     │   │
│  └──────────────┘    │    (volumen persistente)   │   │
│                      └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

- **Backend y BD** corren en Docker en el PC; los datos persisten en volumen local entre reinicios.
- **Frontend** con `npx expo start`: emulador Android (AVD), **Expo Go** en móvil físico (Android o iPhone), o tecla **`w`** para vista web rápida.
- Sin PHP ni runtime nativo en el host Windows más allá de Node/Docker; ver reglas del workspace.

#### Producción (Oracle Cloud Always Free)

```
┌─────────────────────────────────────────────────────────┐
│  VM Ubuntu en Oracle Cloud (ARM Ampere A1)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Docker Compose                                  │   │
│  │  • Traefik / NPM  (80, 443, Let's Encrypt)      │   │
│  │  • FastAPI        (backend)                      │   │
│  │  • PostgreSQL + pgvector (volumen persistente)  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS
┌────────┴────────┐
│  App Expo       │  Android / iOS
│  (tiendas)      │
└─────────────────┘
```

**Ventaja clave:** API y Postgres en la **misma máquina** → consultas RAG con latencia de red ~1 ms frente a arquitecturas fragmentadas (backend en Koyeb + BD en Supabase).

### 10.5 Oracle Cloud Always Free — decisión de hosting

**Decisión: Oracle Cloud Infrastructure (OCI) Always Free** como host de producción.

#### Por qué Oracle y no solo Supabase / Cloud Run / Render

| Opción | Veredicto |
| --- | --- |
| **Supabase Edge Functions** | Descartado como backend principal: insuficiente para LangGraph, timeouts cortos, sin Python robusto |
| **Vercel** | Descartado para backend: serverless JS/TS, sin contenedores largos, sin Postgres propio |
| **Google Cloud Run** | Válido (free tier generoso) pero fragmenta BD y API; cold starts |
| **Koyeb / Render free** | 512 MB RAM, sleep tras inactividad → mala UX para un niño esperando historia |
| **Replit** | Bueno para prototipos; caro y poco control para producción B2C |
| **Oracle Always Free ARM** | **Elegido:** 0 € perpetuo, RAM configurable, sin sleep, Docker Compose completo |

#### Tamaño de instancia recomendado

Oracle ofrece una «bolsa» de recursos ARM (hasta 4 OCPU + 24 GB RAM gratis). **No hace falta usarlo todo desde el día uno.**

| Perfil | OCPU | RAM | Uso |
| --- | --- | --- | --- |
| **Punto dulce (recomendado)** | 1 | **6 GB** | FastAPI + LangGraph + Postgres/pgvector con holgura |
| Mínimo viable | 1 | 4 GB | Ajustado; monitorizar OOM |
| AMD Micro (1 GB) | — | 1 GB | **Insuficiente** para API + Postgres juntos; solo API con BD externa |
| Máximo free | 4 | 24 GB | Reservar para escala o otros proyectos |

#### Consideraciones Oracle

- **Arquitectura ARM (aarch64):** las imágenes Docker deben compilarse para ARM (`docker buildx`); el 99 % del ecosistema Python es compatible.
- **Disponibilidad:** las instancias ARM gratuitas a veces están sin stock («Out of capacity»); elegir región EU (Madrid, Frankfurt, París) y tener script de reintento o aprovisionamiento vía Terraform.
- **Sysadmin:** firewall OCI (Security Lists), `ufw` en Ubuntu, actualizaciones, backups de Postgres (cron + volumen o `pg_dump`). No es PaaS gestionado.
- **Plan B si solo hay AMD 1 GB:** API en Oracle + Postgres en Supabase free + swap en disco (más lento, último recurso).

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
Request narrativo (FastAPI)
       │
       ▼
┌─────────────────┐
│ Rate limiter    │  ← por usuario + global (tabla api_usage o Redis)
│ + quota tracker │
└────────┬────────┘
         ▼
┌─────────────────┐
│ RAG             │  ← story_beats + summaries + pgvector (futuro)
│ + subject levels│     todo en Postgres local
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
┌─────────────┐     JWT                 ┌──────────────────┐
│  App Expo   │ ───────────────────────►│  FastAPI         │
│  Android/iOS│     HTTPS only          │  /api/v1/*       │
└─────────────┘                         └────────┬─────────┘
                                                 │
                                    credenciales BD (solo servidor)
                                                 ▼
                                        ┌──────────────────┐
                                        │  PostgreSQL      │
                                        │  + pgvector      │
                                        └──────────────────┘
                                                 │
                                    OPENROUTER_API_KEY (solo servidor)
                                                 ▼
                                        ┌──────────────────┐
                                        │  OpenRouter      │
                                        └──────────────────┘
```

| Secreto | Dónde vive | Quién lo usa |
| --- | --- | --- |
| Clave pública Supabase Auth (si aplica) | App (público por diseño) | App → login |
| `DATABASE_URL` | Solo contenedor backend / `.env` servidor | FastAPI → Postgres |
| `OPENROUTER_API_KEY` | Solo servidor | Motor IA |
| `JWT_SECRET` o validación Supabase JWT | Solo servidor | FastAPI valida cada request |
| JWT del usuario | Memoria segura en app | Cada llamada a API |

**Reglas:**

- TLS obligatorio (Traefik + Let's Encrypt en producción).
- La API valida JWT en cada request; comprueba que `child_id` pertenece al padre autenticado.
- Rate limiting por usuario (p. ej. 30 req/min) para proteger cuotas free de IA.
- Sin secretos de IA ni credenciales de BD en el bundle de la app.

### 10.8 Papel de Supabase (opcional)

**Supabase** es PostgreSQL gestionado + Auth + Storage + API REST auto-generada (PostgREST) + RLS.

| Pieza Supabase | ¿Usarla en KidepiK? |
| --- | --- |
| PostgreSQL hospedado | **No** como BD principal — Postgres va en Docker (local y Oracle) por latencia RAG y control |
| Auth (email, Google, Apple) | **Sí, recomendado MVP** — gratis, menos código que auth propio |
| Storage (imágenes) | **Opcional** — útil *post-MVP* para avatares |
| Edge Functions | **No** — sustituidas por FastAPI |
| API REST automática | **No** — la app habla solo con FastAPI |

Flujo híbrido: la app obtiene JWT de Supabase Auth → FastAPI valida ese JWT → lee/escribe en Postgres propio.

### 10.9 Papel de Vercel (opcional)

**Vercel** despliega frontends web y funciones serverless ligeras (ecosistema Next.js). **No** compila apps móviles ni ejecuta contenedores Python largos.

Uso previsto en KidepiK: **landing page** de marketing para padres (Next.js), si se necesita SEO. El núcleo del producto (app + API + BD) **no** va en Vercel.

### 10.10 Provisión de infraestructura con agentes Cursor

La infraestructura Oracle se provisionará y operará con **agentes de Cursor** apoyándose en herramientas estándar — **no** en un MCP oficial de Oracle para VMs (no existe a día de hoy para aprovisionamiento bruto).

#### Vías previstas

| Herramienta | Uso |
| --- | --- |
| **Terraform** (proveedor OCI oficial) | Infraestructura como código: VCN, subnet pública, security lists (22, 80, 443), instancia `VM.Standard.A1.Flex` (1 OCPU, 6 GB), Ubuntu ARM |
| **OCI CLI** (`oci`) | Scripts bash alternativos para crear la VM si Terraform resulta pesado para el MVP |
| **Ansible / scripts bash vía SSH** | Post-provisionado: Docker, Docker Compose, directorios, despliegue inicial |
| **Docker Compose** (en repo) | Definición declarativa del stack: `api`, `db`, `proxy` — misma receta local y producción |

#### Flujo esperado con Cursor

1. El agente genera o actualiza ficheros `.tf` / scripts OCI CLI según especificación (región EU, puertos, tamaño ARM).
2. El usuario (o CI) ejecuta `terraform apply` con credenciales OCI locales — **las claves nunca se commitean**.
3. Tras obtener IP pública, el agente genera playbook/script SSH: instalar Docker, clonar repo, levantar `docker compose up -d`.
4. Iteraciones posteriores: el agente modifica Compose, variables de entorno y documentación operativa en `.cursor/operations/`.

> **Nota:** Oracle no ofrece MCP plug-and-play para crear VMs; la automatización pasa por Terraform/OCI CLI + SSH. Los agentes Cursor escriben y mantienen esos artefactos; la ejecución requiere credenciales del usuario en el entorno local.

### 10.11 Alternativas evaluadas (resumen)

| Tecnología | Decisión |
| --- | --- |
| **Flutter** | Descartado por ahora; reservado si avatar 3D exige más control gráfico |
| **Nativo duplicado (Swift + Kotlin)** | Descartado |
| **Supabase como backend completo** | Descartado; solo Auth/Storage opcional |
| **Vercel como backend** | Descartado |
| **JSON monolítico como fuente de verdad** | Descartado |
| **Llamada IA directa desde la app** | Descartado |
| **Replit como producción** | Descartado |
| **Render / Koyeb free como producción** | Descartado (RAM, sleep) |
| **Cloud Run** | Alternativa válida; Oracle elegido por coste 0 sin cold start en instancia siempre activa |

### 10.12 Coste cero → escalado proporcional

| Fase | Usuarios | Infra | IA |
| --- | --- | --- | --- |
| **0 — MVP** | < 500 | Oracle ARM 1 OCPU/6 GB + Docker local | Solo modelos `:free` vía OpenRouter |
| **1 — Tracción** | 500–5k | Ampliar RAM Oracle (hasta bolsa free) o Supabase Pro solo para Auth | Mix free + modelos pago con techo |
| **2 — Escala** | > 5k | Migrar piezas (BD gestionada, CDN, réplicas) según cuello de botella real | Router por tier (free vs premium) |

### 10.13 Principios de código

- SOLID, KISS, YAGNI.
- Separar: UI móvil · API FastAPI · motor IA (LangGraph) · persistencia (Postgres).
- **Paridad local/producción:** mismo `docker-compose.yml` (o override por entorno).
- Preparar módulos futuros: avatar 3D, píldoras, panel padres, ingesta RAG de corpus pedagógico.

---

## 11. Modo historia

- Hilo conductor continuo entre sesiones.
- Generación **sobre la marcha** según elecciones iniciales (alta de personaje) y decisiones posteriores.
- El aprendizaje se presenta como **obstáculo narrativo** (código numérico, runa, idioma alienígena…) que hay que resolver para avanzar.
- Sensación de **viaje**: el niño es protagonista, no alumno pasivo.
- **Continuidad garantizada** por `story_beats` y resúmenes — el viaje es único y persistente.

---

## 12. Entorno de desarrollo y pruebas

### Emuladores y dispositivos

| Entorno | Herramienta | Requisitos / notas |
| --- | --- | --- |
| **Android (emulador)** | Android Studio → Virtual Device Manager (AVD) | Windows/macOS/Linux; ~16 GB RAM recomendados; simula cámara, GPS, rotación |
| **iOS (simulador)** | Simulador de Xcode | **Solo macOS** — no hay simulador oficial de iOS en Windows |
| **Móvil físico** | **Expo Go** (Play Store / App Store) | Escanear QR tras `npx expo start`; hot reload en ~medio segundo |
| **Maquetado rápido** | Tecla **`w`** en Expo | Render en navegador; no sustituye pruebas nativas |

### Flujo de desarrollo día a día

1. Levantar stack local: `docker compose up` (API + Postgres persistente).
2. En otra terminal: `npx expo start` en el proyecto móvil.
3. Probar en emulador Android, Expo Go (Android/iPhone) o web.
4. Builds de tienda: **EAS Build** (Expo Application Services) en la nube para APK/AAB e IPA.

### Matriz de pruebas mínima (MVP)

- **Android:** emulador o dispositivo físico.
- **iOS:** dispositivo físico con Expo Go, o simulador en Mac cuando esté disponible.
- **Backend:** tests contra API local en Docker.
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

- [ ] `docker-compose.yml` local (api + postgres + pgvector) y override producción.
- [ ] Migraciones SQL definitivas (tablas §9, índices, extensión pgvector).
- [ ] Módulos FastAPI + esqueleto LangGraph (agentes narrador, validador, router).
- [ ] Enums de materias y niveles por edad (MVP: 2–3 materias).
- [ ] System prompts: examen de acceso, beat narrativo, generación de reto.
- [ ] Model router OpenRouter: orden de fallback y límites por usuario.
- [ ] Contrato OpenAPI `/api/v1` (profile, session, story).
- [ ] Flujo de pantallas MVP: registro → mundo → examen de acceso → mapa → lección → elección.
- [ ] Terraform OCI (o scripts CLI) para VM ARM — **mantenidos por agentes Cursor**.
- [ ] Playbook post-provisionado SSH (Docker, despliegue, backups Postgres).
- [ ] Decisión Auth: Supabase Auth vs JWT propio.
- [ ] Política de privacidad y consentimiento parental (COPPA / RGPD).
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
