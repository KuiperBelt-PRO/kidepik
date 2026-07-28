# Spec: Sistema de diálogo de aventura (IA)

> Estado: **aprobada como contrato de producto** (julio 2026) — detalle de prompts/modelos ampliables; **sin implementación** hasta Plan del motor de play  
> Relacionado: [SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md), [SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md), [SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md), [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [docs/kidepik.md](../../docs/kidepik.md) §7, §10.6

## Contexto

Los miembros de la tripulación, al entrar en su aventura (primera vez y siguientes), interactúan con un **sistema de diálogo impulsado por IA**: el agente plantea situaciones y preguntas; el niño responde eligiendo **opciones** o **escribiendo texto**. Es el canal principal de onboarding, examen de acceso y (más adelante) de la aventura narrativa.

## Objetivo

Definir el **contrato de UI, estado, API y seguridad** del diálogo de aventura, reutilizable por:

1. Primer acceso ([SPEC_APP_PLAY_FIRST_RUN.md](SPEC_APP_PLAY_FIRST_RUN.md)).
2. Examen de conocimientos ([SPEC_APP_PLACEMENT_EXAM.md](SPEC_APP_PLACEMENT_EXAM.md)).
3. Sesión de aventura post-examen ([SPEC_APP_ADVENTURE_SESSION.md](SPEC_APP_ADVENTURE_SESSION.md)).

## Principios

| Principio | Decisión |
| --- | --- |
| Un solo motor de diálogo | Misma escena/componente; distinto `flow_id` / agente |
| Respuestas duales | Siempre posible: chips de opción y/o campo de texto según el turno |
| Tema visual = mundo del niño | Tipografía, iconos y tono siguen `world_theme` cuando ya existe; antes del mundo: tema neutro o dual suave |
| Persistencia de turnos | Cada intercambio relevante se guarda (no regenerar el pasado) |
| Apta infancia | Filtros de tono; sin violencia gráfica ni miedo intenso |
| Tutor en sesión | JWT adulto; `child_id` autorizado; el niño no tiene cuenta |
| Cuota IA | Rate limit + mensaje amable si no hay cuota ([docs/kidepik.md](../../docs/kidepik.md)) |

---

## 1. Anatomía UI (viewport 390×844)

```
┌─────────────────────────────────┐
│ [← salir*]     [mundo icon]     │  ← chrome play (no drawer tutor)
│                                 │
│  ┌─ burbuja agente ───────────┐ │
│  │ Texto narrativo / pregunta │ │
│  └────────────────────────────┘ │
│                                 │
│  (historial scrollable corto)   │
│                                 │
│  ┌ opciones ──────────────────┐ │
│  │ [ A ]  [ B ]               │ │
│  │ [ C ]  …                   │ │
│  └────────────────────────────┘ │
│  [ Escribe tu respuesta…   ➤ ]  │  ← si el turno admite texto
└─────────────────────────────────┘
```

\* Salir: respeta `require_exit_pin` de Tripulación.

### 1.1 Estados de turno (`input_mode`)

| Modo | UI |
| --- | --- |
| `options_only` | Solo chips (≥2); sin teclado |
| `text_only` | Solo input texto |
| `options_or_text` | Chips + «O escribe…» |
| `continue` | Un CTA «Continuar» / «Siguiente» sin respuesta libre |
| `blocked` | Esperando red / cuota; spinner + reintentar |

### 1.2 Tipografía e iconos según mundo

| `world_theme` | Display | Iconografía |
| --- | --- | --- |
| `null` (pre-elección) | Neutra (Nunito / sistema de marca sin sesgo fuerte) o split sutil | Iconos genéricos KidepiK |
| `fantasy` | Uncial Antiqua / Cinzel (misma familia que shell fantasy) | Runas / pergaminos / magia |
| `sci-fi` | Bruno Ace / Orbitron | Circuitos / orbital / HUD |

`font_scale_play` del miembro (o default hogar) aplica aquí.

Al elegir mundo en first-run, **transición ≤ 300 ms** a tipografía/iconos del mundo; reduced-motion = corte.

### 1.3 Tono conversacional

El backend inyecta en el system prompt el `world_theme` (o «aún sin mundo»), edad si existe, `narrative.*` de ajustes del hogar y `avoid_themes`. El LLM **no** inventa datos de perfil ya fijados.

---

## 2. Modelo de turno

```ts
type DialogueRole = "agent" | "child" | "system";

interface DialogueTurn {
  id: string;
  child_id: string;
  session_id: string;
  flow_id: "first_run" | "placement" | "adventure" | string;
  sequence: number;
  role: DialogueRole;
  text: string;
  options?: { id: string; label: string }[];
  input_mode: "options_only" | "text_only" | "options_or_text" | "continue" | "blocked";
  child_reply?: { kind: "option" | "text"; option_id?: string; text?: string };
  meta?: Record<string, unknown>; // p.ej. subject_id en examen
  model_used?: string;
  created_at: string;
}
```

Persistencia sugerida: tabla `dialogue_turns` o reutilizar/extender `story_beats` con `flow_id` — **decisión de implementación:** tabla `dialogue_turns` separada del viaje narrativo largo para no mezclar onboarding con beats de historia; los beats de aventura pueden referenciar turnos o vivir en `story_beats` post-examen.

---

## 3. API (contrato)

Base: `/api/v1/play/{childId}/dialogue`

Auth: Bearer tutor; ownership check.

### 3.1 Abrir o reanudar sesión de diálogo

`POST /api/v1/play/{childId}/dialogue/session`

```json
{ "flow_id": "first_run" }
```

**200:**

```json
{
  "session_id": "uuid",
  "flow_id": "first_run",
  "onboarding_step": "choose_world",
  "world_theme": null,
  "turns": [ /* últimos K o desde inicio del flow */ ],
  "pending_agent_turn": { /* si hay que mostrar pregunta actual */ }
}
```

Idempotente: si hay sesión abierta del mismo `flow_id`, reanuda.

### 3.2 Enviar respuesta del niño

`POST /api/v1/play/{childId}/dialogue/turn`

```json
{
  "session_id": "uuid",
  "reply": { "kind": "option", "option_id": "fantasy" }
}
```

o `{ "kind": "text", "text": "Nora" }`.

**200:** turnos nuevos del agente (1..n), posibles **side effects** tipados:

```json
{
  "agent_turns": [ /* DialogueTurn */ ],
  "effects": [
    { "type": "set_world_theme", "value": "fantasy" },
    { "type": "set_display_name", "value": "Nora" },
    { "type": "advance_onboarding", "to": "choose_name" }
  ],
  "flow_complete": false
}
```

El cliente aplica effects a UI local; la fuente de verdad es el servidor (ya persistió en `children`).

### 3.3 Errores

| Código | Caso |
| --- | --- |
| 401 / 403 | Auth / no es su child |
| 409 | Sesión de otro flow activa; cupo diario; fuera de horario |
| 422 | Reply inválido para `input_mode` |
| 429 | Cuota IA |
| 503 | Modelos caídos → mensaje «Tu explorador descansa un momento» |

---

## 4. Orquestación servidor (alto nivel)

```
reply niño
  → validar modo + permisos + cuota
  → persistir turno niño
  → (opcional) clasificar intención / validar dato estructurado
  → agente (OpenRouter) con contexto: flow + estado child + últimos turnos
  → validar salida (schema: text, options, input_mode, effects)
  → aplicar effects transaccionales (perfil, niveles…)
  → persistir turnos agente
  → responder
```

Validación estructurada obligatoria (JSON schema / DTO PHP) — el LLM no escribe SQL ni inventa effects fuera del catálogo permitido por `flow_id`.

### 4.1 Catálogo de effects por flow

| Flow | Effects permitidos |
| --- | --- |
| `first_run` | `set_world_theme`, `set_display_name`, `set_age`, `advance_onboarding` |
| `placement` | `record_answer`, `set_subject_level`, `set_general_level`, `set_effective_age_band`, `advance_onboarding` |
| `adventure` | `append_story_beat`, `set_choice`, `update_quest` (detalle en SPEC_APP_ADVENTURE_SESSION) |

---

## 5. Seguridad y pedagogía

- Longitud texto niño: 1–280 caracteres; strip HTML.
- Opciones: ids estables definidos por servidor (no confiar en label libre como enum).
- Re-prompt si tono inadecuado.
- Log de `model_used` + tokens en `api_usage`.
- Sin PII del tutor en prompts más allá de lo necesario.

---

## 6. Criterios de aceptación (cuando se implemente)

1. Un turno `options_or_text` muestra chips e input.
2. Elegir opción o texto produce siguiente burbuja agente.
3. Effect `set_world_theme` cambia tipografía/iconos al vuelo.
4. Reanudar sesión recupera historial sin regenerar desde cero.
5. 429 muestra copy amable; no crashea UI.
6. Tests: schema effects, ownership, validación reply vs input_mode.

## Aprobación

- [x] Diálogo con opciones y/o texto como canal de aventura
- [x] Tema visual acoplado a `world_theme`
- [x] Persistencia de turnos + effects tipados
- [x] Auth vía tutor + child_id

Detalle fino de prompts y UX de burbujas puede refinarse en Plan sin romper este contrato.
