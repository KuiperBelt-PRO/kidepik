# Spec: Puerta de entrada Loader → App / Auth

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md), [SPEC_WEB_FRONTEND_ARCHITECTURE.md](SPEC_WEB_FRONTEND_ARCHITECTURE.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md), [docs/kidepik.md](../../docs/kidepik.md) §5–6

## Contexto

El loader actual (`web/js/components/loader-chrome.js`) termina la secuencia visual (fondo dual, anillo de progreso, textos circulares «DOS MUNDOS» / «UN VIAJE ÉPICO», logo central) pero **no enlaza con el producto**: no hay CTA de entrada ni comprobación de sesión.

Esta spec define la **puerta de entrada** desde el loader hacia la app autenticada o hacia la pantalla de auth, con una transición continua sobre el mismo arte de fondo.

## Objetivo

1. Tras unos segundos de carga/revelado, mostrar un hint táctil claro.
2. Permitir **pulsar en cualquier punto del disco circular central** (logo + anillo) para continuar.
3. Si hay sesión Supabase válida → entrar en la app.
4. Si no hay sesión → **morph in-place** hacia la UI de login/registro (ver [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md)).
5. Mantener coherencia visual: mismas tipografías duales del anillo, mismo fondo dual de mundos.

## Principios

| Principio | Decisión |
| --- | --- |
| Un solo escenario visual | No navegar a otra ruta hasta completar la transición; el fondo dual permanece |
| Zona táctil generosa | Toda el área del disco central (`loader-focal`) es clickable, no solo el wordmark |
| No bloquear por red | Si Supabase tarda, el tap sigue siendo válido; se resuelve auth en segundo plano |
| Accesibilidad | Hint legible; foco/teclado en auth; `prefers-reduced-motion` acorta animaciones |
| Público 7–9 + padres | Copy en español (España); targets táctiles ≥ 48 px en auth |

## Máquina de estados (loader)

```
loading ──► ready ──► exiting ──► (session?) ──► app
                              └──► (no session) ──► auth-morph ──► auth-idle
```

| Estado | Descripción | Interacción |
| --- | --- | --- |
| `loading` | Secuencia actual (`is-reveal-*`) + progreso del anillo 0→100 % | Sin tap |
| `ready` | Progreso completo (y opcional órbita lenta del anillo) + hint visible | Tap en disco central habilitado |
| `exiting` | Animación de salida del anillo y reubicación del logo | Sin tap (debounce) |
| `auth-morph` | Transición tipográfica circular → recta + aparición de CTAs auth | Sin tap en anillo |
| `auth-idle` | UI auth estable (delegada a SPEC_APP_AUTH) | CTA Google |

**Estado inicial tras reload:** siempre `loading` → `ready`, aunque exista sesión cacheada (el usuario confirma entrada con tap).

## Comportamiento detallado

### 1. Fase `loading` (sin cambios sustanciales)

- Mantener secuencia de revelado existente ([loader-reveal-sequence.js](../../web/js/components/loader-reveal-sequence.js)).
- Progreso del anillo: **4,5 s** con easing actual (`DURATION_MS`).
- Tras progreso al 100 %: el anillo puede seguir en órbita lenta (comportamiento actual).

### 2. Fase `ready` — hint «Pulsa para comenzar tu viaje épico»

| Requisito | Valor |
| --- | --- |
| **Cuándo aparece** | **5,0 s** después de que el progreso del anillo llegue al 100 % (≈ 9,5 s desde inicio de progreso si no hay skip) |
| **Copy completo** | «Pulsa para comenzar tu viaje épico» |
| **Tipografía dual** | Dos segmentos inline, **mismas familias que el anillo**: |
| | • «Pulsa para comenzar» → **Bruno Ace / Orbitron** |
| | • «tu viaje épico» → **Uncial Antiqua / Cinzel** (peso display) |
| **Posición** | Debajo del disco central, dentro de `loader-chrome`, centrado horizontalmente |
| **Animación entrada** | Fade + slide 8 px desde abajo, 400 ms ease-out |
| **Pulso opcional** | Opacidad 0,85↔1 en 2,5 s loop (desactivado con `prefers-reduced-motion`) |
| **Zona táctil** | `loader-focal` completo: anillo + logo + padding invisible hasta el borde del disco (`--loader-ring-size`) |
| `pointer-events` | Pasar a `auto` en `loader-focal` cuando estado = `ready` |

**Accesibilidad del hint:**

- `aria-live="polite"` en contenedor del hint al mostrarse.
- El disco central pasa de `role="progressbar"` a `role="button"` con `aria-label="Pulsa para comenzar tu viaje épico"` cuando está en `ready`.

### 3. Tap en disco central (`ready` → `exiting`)

Al primer `pointerup` / `click` válido en `loader-focal`:

1. Ocultar hint inmediatamente (fade 150 ms).
2. Consultar sesión Supabase (`getSession()` / `onAuthStateChange` ya inicializado).
3. Iniciar animación de salida (§ Transición visual).
4. Rama:
   - **Sesión válida** (`session.access_token` presente y no expirado) → tras animación (~800 ms), `navigate("/home")` (ruta placeholder hasta existir home; ver § Rutas).
   - **Sin sesión** → tras animación, estado `auth-morph` → `auth-idle` montando UI de [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md) **sin destruir** capas de fondo del loader.

**Doble tap:** ignorar taps adicionales mientras `exiting` o `auth-morph`.

**Offline:** si no hay red, tratar como sin sesión verificable; mostrar auth con banner offline existente; OAuth fallará con mensaje claro.

### 4. Transición visual (anillo → auth)

Secuencia simultánea (**800 ms**, `cubic-bezier(0.4, 0, 0.2, 1)`):

| Elemento | De | A |
| --- | --- | --- |
| **Anillo base** (track/progreso) | Visible | Solo `opacity: 0` (sin scale); eliminar `loader-ring` del DOM al final |
| **Textos circulares** (SVG `textPath`) | Arco superior/inferior, orbitando | **Morph visible** letra a letra (FLIP) a dos líneas rectas bajo el logo |
| **Logo KidepiK** (`loader-logo-wrap`) | Centro del disco, ambigrama girando | Deja de girar; **mismo tamaño**; solo traslación hacia arriba del bloque auth |
| **Eslogan final** | — | Dos líneas bajo el logo (mismos glifos del arco + punto final): |
| | | Línea 1: «DOS MUNDOS.» — Bruno Ace / Orbitron |
| | | Línea 2: «UN VIAJE ÉPICO.» — Uncial Antiqua / Cinzel |
| **Fondo dual** | Intensidad actual | Sin atenuación extra (la vignette del loader basta) |
| **Capas procedurales** | Activas | Siguen animándose |

**Wire ASCII — estado `auth-idle` (viewport 390×844):**

```
┌─────────────────────────────┐
│  [Fantasy world layers]     │
│  [Space world layers]       │
│                             │
│         [KidepiK logo]      │  ← reubicado, sin anillo
│      Dos mundos.            │  ← recto, sci-fi
│      Un viaje épico.        │  ← recto, fantasía
│                             │
│   ┌─────────────────────┐   │
│   │ Continuar con Google │   │
│   └─────────────────────┘   │
│                             │
│  Al continuar aceptas los   │
│  Términos y la Privacidad   │
└─────────────────────────────┘
```

(Detalle del CTA Google en SPEC_APP_AUTH.)

### 5. `prefers-reduced-motion`

| Comportamiento normal | Reducido |
| --- | --- |
| Hint con pulso | Hint estático |
| Transición 800 ms | Corte a 150 ms (fade simple) |
| Órbita del anillo | Sin órbita; hint a los 1 s tras progreso 100 % |
| Capas procedurales | Pausar o estáticas (reutilizar reglas loader existentes) |

## Rutas y navegación

| Ruta hash | Escena | Notas |
| --- | --- | --- |
| `#/loader` | Loader + puerta (default al abrir app) | Comportamiento de esta spec |
| `#/auth` | Auth standalone (opcional) | Misma UI que `auth-idle`; fondo loader reutilizado; deep-link si sesión caduca en app |
| `#/home` | Shell app (placeholder P0) | Tras sesión válida; spec futura `SPEC_APP_HOME.md` |

**Decisión cerrada:** la transición loader→auth ocurre **in-place en `#/loader`** sin cambiar hash hasta que auth complete; entonces `navigate("/home")`. Si el usuario llega a `#/auth` directamente, montar auth con fondo loader estático (último frame o capas en hold).

## Contratos técnicos

### Módulos nuevos / cambios previstos

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-gate.js` | Máquina de estados `loading`→`ready`→`exiting`; hint; listener tap |
| `web/js/components/loader-auth-morph.js` | Animación anillo→logo+eslogan recto; handoff a auth UI |
| `web/js/components/loader-chrome.js` | Integrar gate; exponer `pointer-events` en focal |
| `web/js/scenes/auth.js` | Montaje UI auth (también embebible desde loader) |
| `web/js/lib/supabase.js` | Cliente Supabase + `getSession`, `signInWithOAuth`, helpers |
| `web/js/main.js` | Registrar rutas `auth`, `home` |
| `web/css/scenes/loader.css` | Estados `.is-gate-ready`, `.is-gate-exiting`, `.is-auth-morph` |
| `web/css/scenes/auth.css` | Estilos CTA Google |

### API / backend

- Validación de JWT en PHP ya existe (`SupabaseAuthService`); no bloquea esta fase UI.
- El cliente solo necesita sesión Supabase en `localStorage` para decidir rama en el gate.

## Copy (español)

| ID | Texto |
| --- | --- |
| `gate.hint.sci` | Pulsa para comenzar |
| `gate.hint.fantasy` | tu viaje épico |
| `gate.aria` | Pulsa para comenzar tu viaje épico |
| `gate.slogan.line1` | Dos mundos. |
| `gate.slogan.line2` | Un viaje épico. |

## Criterios de aceptación

1. Viewport **390×844**: hint legible (≥ 16 px efectivos) y visible tras **5 s** post-progreso 100 %.
2. Tap en **cualquier punto** del disco central (no solo en la imagen del logo) dispara la transición.
3. Con sesión mock/Supabase local válida → tras animación, navega a `#/home` (o placeholder acordado).
4. Sin sesión → anillo desaparece, logo arriba, eslogan en **dos líneas rectas** con tipografías duales, CTA Google visible.
5. Segundo tap durante transición no produce doble navegación ni errores consola.
6. `prefers-reduced-motion`: flujo completable sin animaciones largas.
7. Playwright: capturas `tmp/playwright-output/loader-gate-ready.png`, `loader-gate-auth-morph.png`.

## Fuera de alcance

- Onboarding post-registro (alta de niño, selector de mundo) → spec futura.
- Pantalla home / mapa → spec futura.
- Cambiar la secuencia de revelado de capas procedurales (solo se añade gate al final).
- Sustituir el hint antiguo de SPEC_LOADER_SCREEN («Toca para continuar») — **supersedido** por esta spec para salida a producto.

## Relación con SPEC_LOADER_SCREEN

La spec original prevé `navigate("/gallery")` al completar carga. **Esta spec sustituye esa salida** por el gate hacia app/auth. La galería POC puede quedar en `#/gallery` como ruta de desarrollo, no como destino por defecto del loader de producto.

## Aprobación

- [x] Usuario aprueba tiempos (**5 s** post-100 %, transición **800 ms**).
- [x] Usuario aprueba copy y reparto tipográfico: «Pulsa para comenzar» (sci-fi) + «tu viaje épico» (fantasía).
- [x] Usuario aprueba **morph in-place** en `#/loader`.
- [x] Usuario aprueba [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md) (**Google solamente** en MVP).
