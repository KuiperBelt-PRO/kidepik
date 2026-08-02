# Spec: Historial paginado del diálogo de aventura (scroll hacia arriba)

> Estado: **implementada** (2 ago 2026)  
> Relacionado: [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md), [SPEC_APP_ADVENTURE_TURN_PACKAGING.md](SPEC_APP_ADVENTURE_TURN_PACKAGING.md), [SPEC_APP_AGE_BANDS.md](SPEC_APP_AGE_BANDS.md), [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md), [DESIGN.md](../DESIGN.md)

## Contexto

En `#/play/:childId` el historial de burbujas vive en `.play-panel__log` dentro del scroll del marco glass ([SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) §1). Hoy:

1. `POST …/dialogue/session` devuelve **todos** los `dialogue_turns` de la sesión abierta (`DialogueService::loadTurns` sin límite).
2. El cliente pinta el array completo y hace `scrollTop = scrollHeight` tras **cada** burbuja.
3. No hay forma de recuperar tramos anteriores sin recargar la sesión entera.

En sesiones largas (first-run + placement + aventura) el historial puede superar fácilmente la ventana visible del marco play (§2.2b de [SPEC_APP_SECTION_FRAME.md](SPEC_APP_SECTION_FRAME.md)). El niño/tutor necesita **releer** lo ocurrido sin salir de la aventura — patrón familiar de apps de mensajería: scroll hacia arriba → control para cargar mensajes anteriores.

La capa L1 del ledger ya persiste todo ([SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md)); esta spec define **solo lectura paginada en play**, no un segundo canal de chat ni edición del pasado.

## Objetivo

1. Cargar inicialmente un **recorte reciente** del historial (rendimiento + UX).
2. Permitir **cargar bloques anteriores** bajo demanda al acercarse al tope del scroll.
3. Mantener la **posición visual** tras prepend (sin saltos).
4. Copy del control **tematizado** por `world_theme` (fantasía / sci-fi / neutro pre-mundo).

---

## 1. Principios de producto

| Principio | Decisión |
| --- | --- |
| Fuente de verdad | `dialogue_turns` de la `session_id` activa (L1); mismo DTO `DialogueTurn` que hoy |
| No regenerar | Los turnos cargados son lectura; el servidor no re-invoca LLM |
| Un solo hilo | Mismo log mentor/explorer; incluye ecos `choice_resolved` ([SPEC_APP_ADVENTURE_TURN_PACKAGING.md](SPEC_APP_ADVENTURE_TURN_PACKAGING.md) §3.2) |
| Compose fijo | El pie con opciones/textarea **no** se mueve; solo scrollea el historial |
| Carga explícita | **Botón** (aprobado) — el usuario decide cuándo «recordar»; sin auto-load silencioso |
| Tutor autorizado | Mismo JWT + ownership que el resto de `/play/{childId}/dialogue/*` |

---

## 2. Paginación API

### 2.1 Parámetros

| Parámetro | Default | Descripción |
| --- | --- | --- |
| `limit` | **24** | Turnos por página (`PLAY_HISTORY_PAGE_SIZE`; alineado ≈2× ventana L3 de 12) |
| `before_sequence` | — | Exclusivo: devolver turnos con `sequence < before_sequence`, orden `sequence DESC` en query, **respuesta en orden ASC** |

### 2.2 Metadatos de historial

Objeto `history` anidado en respuestas que incluyan turnos:

```ts
interface DialogueHistoryMeta {
  page_size: number;        // limit efectivo
  has_older: boolean;       // existen turnos con sequence < oldest_sequence
  oldest_sequence: number | null;  // menor sequence devuelto en este payload; null si vacío
  newest_sequence: number | null;  // mayor sequence devuelto (útil en session inicial)
}
```

### 2.3 `POST /api/v1/play/{childId}/dialogue/session` (delta)

Además de los campos actuales, la respuesta incluye:

```json
{
  "session_id": "uuid",
  "flow_id": "adventure",
  "turns": [ /* últimos `limit` turnos, sequence ASC */ ],
  "history": {
    "page_size": 24,
    "has_older": true,
    "oldest_sequence": 17,
    "newest_sequence": 40
  },
  "pending_agent_turn": { }
}
```

**Cambio respecto a hoy:** `turns` deja de ser la sesión completa; solo la **ventana inicial reciente**. `pending_agent_turn` sigue siendo el último turno mentor de la sesión (aunque no esté en `turns` si la ventana es muy corta — en la práctica siempre estará en la ventana reciente).

### 2.4 `GET /api/v1/play/{childId}/dialogue/history` (nuevo)

| Query | Requerido | Descripción |
| --- | --- | --- |
| `session_id` | sí | Sesión abierta del niño |
| `before_sequence` | sí | Cursor: cargar página anterior a este `sequence` |
| `limit` | no | Default 24; máx 48 |

**200:**

```json
{
  "turns": [ /* DialogueTurn[], sequence ASC */ ],
  "history": {
    "page_size": 24,
    "has_older": false,
    "oldest_sequence": 1,
    "newest_sequence": 16
  }
}
```

**Errores:** mismos 401/403 que diálogo; `404` sesión inexistente o cerrada; `422` `before_sequence` inválido.

### 2.5 Orden y deduplicación

- Orden canónico en cliente: `sequence` ASC (igual que hoy).
- El cliente mantiene un `Set` de `turn.id` ya renderizados; ignora duplicados si el usuario pulsa dos veces o hay solapamiento de cursor.
- Índice DB recomendado (si no existe): `(session_id, sequence DESC)` — migración solo si el explain lo justifica.

### 2.6 Alcance del historial en play

La paginación del log en `#/play` abarca **todos** los `dialogue_turns` del tripulante (`child_id`), ordenados por `created_at` + `id` — **incluye sesiones cerradas** (p. ej. tras `reset-post-exam.php`, que cierra la sesión anterior y abre una nueva de aventura).

| Aspecto | Contrato |
| --- | --- |
| Ventana inicial | Últimos `page_size` turnos del **niño**, no solo de la sesión abierta |
| Cursor | `before_turn_id` (UUID del turno más antiguo visible) |
| Sesión abierta | Sigue siendo necesaria para `submitTurn` y para autorizar `GET …/history`; el cursor es global al viaje |
| Timeline tutor | `GET …/journey/timeline` sigue siendo la vista resumida para el tutor; no sustituye este log |

---

## 3. Comportamiento UI (`web/js/scenes/play.js`)

### 3.1 Hidratación inicial

1. Pintar `turns` de `dialogue/session` en orden.
2. **Un solo** scroll al final tras hidratar el lote (no por burbuja).
3. Si `history.has_older`, preparar control de carga (§3.2) en estado oculto hasta que el usuario scrollee arriba.

### 3.2 Descubrimiento del control (scroll hacia arriba)

| Aspecto | Contrato |
| --- | --- |
| Contenedor observado | `.section-frame__scroll` (scroll real del marco) |
| Umbral | `scrollTop ≤ 72px` → mostrar control |
| Ocultar | `scrollTop > 72px` o `!history.has_older` |
| Posición | Primera fila **dentro** de `.play-panel__log`, `position: sticky; top: 0; z-index: 1` — queda bajo el fade superior del marco |
| Interacción | Tap / clic en el botón → `GET …/dialogue/history` con `before_sequence = oldest_sequence` actual |
| Cargando | Botón `aria-busy="true"`, texto de espera (§4.3), deshabilitado |
| Tras éxito | Prepend burbujas + ecos; **preservar ancla** (§3.3); actualizar `oldest_sequence` y `has_older` |
| Error | Toast glass ([SPEC_APP_GLASS_TOAST.md](SPEC_APP_GLASS_TOAST.md)); botón vuelve a estado idle |

**No** disparar carga automática solo por cruzar el umbral — hace falta pulsar el botón (evita cargas accidentales en scroll elástico iOS).

### 3.3 Preservación de scroll (prepend)

Patrón obligatorio al insertar N nodos arriba del log:

```
prevScrollHeight = scrollEl.scrollHeight
prevScrollTop = scrollEl.scrollTop
// prepend nodos en orden ASC
scrollEl.scrollTop = prevScrollTop + (scrollEl.scrollHeight - prevScrollHeight)
```

Los mensajes **nuevos** del turno en curso siguen haciendo scroll al final; la carga histórica usa `preserveScroll: true` y no llama `scrollLogToEnd()`.

### 3.4 Renderizado de turnos antiguos

Reutilizar `appendMentorTurn` / `appendBubble` con flag `historical: true`:

- Misma tipografía/iconos del `world_theme` vigente (no re-simular tema pasado).
- Turnos `meta.phase === "choice_resolved"` → bloque `play-choice-echo` igual que en tiempo real.
- Turnos con opciones pasadas **no** reactivan chips en el pie; solo texto/burbuja.

### 3.5 Estilos

Nuevo bloque en `web/css/scenes/play.css`:

| Clase | Uso |
| --- | --- |
| `.play-history-load` | Contenedor sticky centrado |
| `.play-history-load__btn` | Variante `glass-btn` compacta (altura táctil ≥ 44px) |
| `.play-history-load--hidden` | `visibility: hidden; pointer-events: none` (reserva altura mínima opcional 0) |

Respetar `prefers-reduced-motion`: sin animación de entrada del control.

### 3.6 Accesibilidad

- Botón: `type="button"`, `aria-label` = texto visible + «Cargar mensajes anteriores de la aventura».
- Durante carga: `aria-live="polite"` en el botón con copy de espera.
- El `role="log"` del historial no anuncia cada burbuja prepended en bloque (evitar spam); opcional anuncio único «Se han cargado X mensajes anteriores».

### 3.7 Telemetría local

Canal `client` ([SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md)):

```json
{ "message": "play_history_load", "child_id": "…", "before_sequence": 17, "count": 24, "ok": true }
```

---

## 4. Copy del control (tematizado + banda de edad)

### 4.1 Modelo de selección

| Aspecto | Contrato |
| --- | --- |
| Ejes | `world_theme` (`fantasy` \| `sci-fi` \| `neutral`) × **tono de banda** (`early` \| `child` \| `teen` \| `adult`) |
| Mapeo banda | Misma agrupación que `waitingToneBand()` en `play.js`: `band_early`→`early`; `band_child`→`child`; `band_tween`/`band_teen`→`teen`; `band_adult`/`band_senior`→`adult`; sin banda → `child` |
| Pool | **Varias** cadenas por celda (tablas §4.2–4.4); el cliente elige **una al azar** |
| Cuándo sortear | Cada vez que el control pasa de oculto → visible (scroll arriba); al volver a ocultarse y reaparecer, **nueva** variante |
| Al cargar | Sorteo independiente del pool `loading` de la misma celda |
| Cambio de mundo | Si `set_world_theme` en first-run, el pool activo cambia; si el botón está visible, re-sortear |
| Aleatoriedad | `crypto.getRandomValues` si existe; si no, `Math.random()` — solo UX, sin impacto en juego |
| i18n | Castellano ES fijo en MVP |

### 4.2 Botón idle — fantasía

| Tono | Variantes (una al azar) |
| --- | --- |
| `early` | Recordar el camino · ¿Qué pasó antes? · Ver lo de antes · El camino de atrás |
| `child` | Recordar el camino · Ecos del sendero · Lo que quedó atrás · Recuerdos del viaje |
| `teen` | Recordar el camino · Hojas anteriores · Volver al pergamino · Ecos del sendero |
| `adult` | Recordar el camino · Hojas anteriores · Recuerdos del viaje · Volver al pergamino |

### 4.3 Botón idle — sci-fi

| Tono | Variantes (una al azar) |
| --- | --- |
| `early` | Crónicas anteriores · Ver lo de antes · ¿Qué pasó antes? · Mensajes de antes |
| `child` | Crónicas anteriores · Registros previos · Recuperar transmisión · Lo que quedó atrás |
| `teen` | Crónicas anteriores · Registros previos · Recuperar transmisión · Ampliar memoria |
| `adult` | Crónicas anteriores · Registros previos · Archivo de misión · Recuperar transmisión |

### 4.4 Botón idle — neutro (pre-mundo)

| Tono | Variantes (una al azar) |
| --- | --- |
| `early` | Ver mensajes anteriores · ¿Qué pasó antes? · Ver lo de antes |
| `child` | Ver mensajes anteriores · Mensajes de antes · Lo que quedó atrás |
| `teen` | Ver mensajes anteriores · Historial anterior · Mensajes previos |
| `adult` | Ver mensajes anteriores · Historial anterior · Mensajes previos |

### 4.5 Copy de carga (sorteo en la misma celda mundo×tono)

| Mundo | `early` | `child` | `teen` / `adult` |
| --- | --- | --- | --- |
| Fantasía | Desenrollando el pergamino… · Un momentito… | Desenrollando el pergamino… · Buscando en el mapa… | Desenrollando el pergamino… · Consultando el diario… |
| Sci-fi | Recuperando crónicas… · Un momentito… | Recuperando crónicas… · Leyendo el archivo… | Recuperando crónicas… · Sincronizando registro… |
| Neutro | Cargando… · Un momentito… | Cargando… · Un momentito… | Cargando… |

### 4.6 Copy fijo (sin sorteo)

| Estado | Fantasía | Sci-fi | Neutro |
| --- | --- | --- | --- |
| Sin más historial | Este es el inicio del camino | No hay crónicas anteriores en esta misión | No hay más mensajes |
| Error (toast) | No se pudo recordar el camino | No se pudieron recuperar las crónicas | No se pudo cargar el historial |

### 4.7 Implementación

- Mapa `PLAY_HISTORY_COPY` en `play.js` (o módulo `play-history-copy.js`): `{ neutral, fantasy, 'sci-fi': { early, child, teen, adult: { idle: string[], loading: string[] } } }`.
- Helper `pickHistoryCopy(pool: string[]): string`.
- `updateHistoryButtonLabel()` llama al sorteo y asigna `textContent` + `aria-label` («{label}. Cargar mensajes anteriores de la aventura»).
- Tests unitarios Node: pool no vacío; `pickHistoryCopy` devuelve miembro del array (mock RNG).

**Prohibido:** `Logs anteriores` y copy que suene a depuración técnica.

---

## 5. Límites y casos borde

| Caso | Comportamiento |
| --- | --- |
| Sesión con ≤ `page_size` turnos | `has_older: false`; control nunca visible |
| Usuario en mitad del scroll y llega turno nuevo | Auto-scroll al final **solo si** ya estaba a ≤ 80px del fondo (patrón chat); si está leyendo arriba, no forzar |
| `compose_failed` / spinner mentor | No mostrar control de historial encima del spinner |
| Placement con muchos ítems | Misma paginación; cada feedback cuenta como turno |
| Debug AI | Sin cambio; turnos debug siguen en `meta` si existían |

---

## 6. Criterios de aceptación

1. Sesión con 50 turnos: `dialogue/session` devuelve 24 y `has_older: true`.
2. Scroll hasta arriba → aparece botón con una variante aleatoria del pool `world_theme` × banda de edad.
3. Pulsar botón → 24 burbujas más antiguas arriba, **sin salto** de lectura.
4. Segunda pulsada carga el siguiente bloque hasta `has_older: false`; botón desaparece.
5. Turno con `choice_resolved` en historial antiguo muestra eco de cartas.
6. PHPUnit: `DialogueHistoryTest` — orden, cursor, ownership, sesión ajena 403.
7. Playwright 390×844: flujo con historial seed > 30 turnos; captura `tmp/playwright-output/play-history-load-v1.png`.

---

## 7. Impacto en código (referencia para plan)

| Área | Fichero |
| --- | --- |
| API ruta | `api/src/Router.php` |
| Servicio | `api/src/Services/DialogueService.php` — `loadRecentTurns`, `loadHistoryBefore` |
| Cliente | `web/js/scenes/play.js`, `web/js/lib/play-api.js` |
| Estilos | `web/css/scenes/play.css` |
| Tests | `api/tests/DialogueHistoryTest.php` |

---

## 8. Deltas en specs relacionadas

### [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md)

- §3.1: `turns` = ventana reciente + objeto `history`.
- §3.4 (nuevo): `GET …/dialogue/history`.
- §1: diagrama ASCII — anotar control sticky «Recordar el camino» en la zona superior del historial.

### [SPEC_APP_JOURNEY_MEMORY.md](SPEC_APP_JOURNEY_MEMORY.md)

- §6 API: fila `GET …/dialogue/history` — lectura L1 paginada para UI play (distinto de timeline tutor).

---

## Aprobación

- [x] Paginación por `session_id` + cursor `before_sequence` (`page_size` = 24)
- [x] Botón explícito (no auto-load silencioso)
- [x] Copy: pools por mundo × banda de edad; sorteo aleatorio al mostrar el control
- [x] Preservación de scroll al prepend
- [x] Criterios de aceptación §6
