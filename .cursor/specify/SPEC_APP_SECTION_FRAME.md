# Spec: Marco de sección autenticada (bandas + glass + scroll)

> Estado: **aprobada** (julio 2026); **delta §2.2b marco play más alto** (ago 2026)  
> Relacionado: [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md), [SPEC_LEGAL_AUTHENTICATED_SESSION.md](SPEC_LEGAL_AUTHENTICATED_SESSION.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md), [SPEC_APP_ACCOUNT_SECTION.md](SPEC_APP_ACCOUNT_SECTION.md), [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md), [SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md), [SPEC_APP_VISUAL_DESIGN_V3.md](SPEC_APP_VISUAL_DESIGN_V3.md)

## Contexto

Tras el shell post-login, las pantallas de gestión (cuenta, tripulación, ajustes, etc.) necesitan un **contrato visual compartido**:

1. El mundo dual (cabecera sci-fi + pie fantasía) se **reduce** en todas las secciones autenticadas **excepto home**, igual que hoy en Términos/Privacidad.
2. El contenido vive dentro de un **marco central glass** (mismo lenguaje que el drawer).
3. Tipografía e iconos siguen el `uiTheme` sticky del padre (`sci-fi` | `fantasy`).

Legal autenticado **ya comprime bandas** y tiene scroll con fade propio; **no** adopta el marco glass en esta fase (sigue su layout de documento). Las **nuevas** secciones (empezando por Cuenta) sí usan este marco.

## Objetivo

Definir el patrón reutilizable de **sección de gestión autenticada** para implementar SDD/TDD sin reinventar layout en cada ruta.

**No se implementa código de producto hasta aprobación explícita.**

---

## Alcance

### Incluido

| Superficie | Descripción |
| --- | --- |
| Bandas mundo compactas | Comprimir / expandir con animación según ruta |
| Marco glass | Contenedor central responsive con scroll interno |
| Logo de sección | Wordmark KidepiK centrado, más pequeño, dentro del marco |
| Fade de scroll | Aparición por abajo / desaparición por arriba (máscara de opacidad) |
| Tema UI | Consumo de `data-shell-theme` / `uiTheme` del shell |
| Módulo compartido | API JS/CSS reutilizable por `#/account` y futuras rutas |

### Excluido

| Tema | Notas |
| --- | --- |
| Contenido concreto de Cuenta | [SPEC_APP_ACCOUNT_SECTION.md](SPEC_APP_ACCOUNT_SECTION.md) |
| Rediseño de Legal (marco glass) | Fuera; solo reutiliza bandas compactas ya existentes |
| Home welcome | Sin marco glass; bandas **expandidas** |
| HUD de juego infantil **full-bleed** (futuro) | Distinto del chrome de gestión; requiere spec + DESIGN propios. El play MVP tutor usa marco glass. |
| Tripulación / Ajustes | [SPEC_APP_CREW_SECTION.md](SPEC_APP_CREW_SECTION.md), [SPEC_APP_SETTINGS_SECTION.md](SPEC_APP_SETTINGS_SECTION.md) (propuesta) |

---

## Principios

| Principio | Decisión |
| --- | --- |
| Home = mundo completo | Solo `#/home` (sesión) mantiene bandas loader/expandidas |
| Resto gestión = compacto | Cuenta, legal autenticado, stubs futuros → bandas reducidas |
| Animación bidireccional | Compactar y expandir con la misma curva/duración que legal |
| Glass = drawer | Tokens de fondo/borde alineados al menú lateral, no inventar otra paleta |
| Shell encima | FABs y drawer no se desplazan; el marco vive bajo el chrome |
| Un solo mundo | Capas procedurales persisten; solo cambia layout de bandas |
| Reduced motion | Compactar/expandir instantáneo o ≤ 80 ms |

---

## 1. Bandas del mundo (compact / expand)

### 1.1 Modelo de layout

Reutilizar el mecanismo actual de legal (`animateWorldBands` / `setWorldBandLayout` en `world-transition.js` y tokens `--legal-*-band*` en CSS).

| Estado | Clase canónica | Bandas |
| --- | --- | --- |
| Expandido | `is-world-band-loader` (o alias `is-world-band-expanded`) | Sci-fi ~48 % / fantasía ~52 % (valores actuales loader) |
| Compacto | `is-world-band-legal` (o alias `is-world-band-compact`) | Sci-fi ~24 % / fantasía ~24 % (valores actuales legal) |

**Decisión de implementación:** mantener las clases existentes por compatibilidad con legal **o** introducir alias (`is-world-band-compact` ≡ legal) documentado; no romper Términos/Privacidad.

### 1.2 Matriz de rutas autenticadas

| Ruta | Bandas | Marco glass |
| --- | --- | --- |
| `#/home` | **Expandido** | No |
| `#/account` | **Compacto** | **Sí** |
| `#/legal/terminos` (sesión) | **Compacto** | No (layout legal) |
| `#/legal/privacidad` (sesión) | **Compacto** | No (layout legal) |
| `#/settings` | **Compacto** | **Sí** |
| `#/crew`, `#/crew/new`, `#/crew/:id` | **Compacto** | **Sí** |
| `#/play/:childId` | **Compacto** | **Sí** (aventura en marco glass; ver [DESIGN.md](../DESIGN.md)) |
| Otras gestión futuras | **Compacto** | **Sí** (por defecto) |
| `#/loader`, `#/auth/*` | N/A (sin shell de gestión) | No |

### 1.3 Transiciones

| Transición | Comportamiento |
| --- | --- |
| Home → Cuenta (u otra compacta) | `animateWorldBands(scene, true, 720ms)` — comprimir **animado** |
| Cuenta → Home | `animateWorldBands(scene, false, 720ms)` — expandir **animado** |
| Cuenta ↔ Legal autenticado | Ambos compactos: **sin** re-animación de bandas |
| Legal autenticado → Home | Expandir animado |
| Compacta → Compacta distinta | Bandas quietas; solo contenido del marco |
| Handoff shell (home↔account↔legal) | **Sin flash negro**: capas del mundo permanecen visibles en body hasta que la nueva escena las reclama ([SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md)) |

**Obligatorio:** en rutas con sesión y bandas compactas, la escena debe terminar con `is-world-band-legal` aplicado. La transición pendiente **no** puede consumirse en `loader-chrome` antes de `applySectionEnter` / `applyWorldBandTransitionOnMount`.

**CSS canónico:** `.scene.scene-legal` y `.scene.scene-loader.scene-world` comparten variables y `transition` de bandas en `legal.css`. Nunca aplicar `position: fixed` a `.scene.scene-legal` (rompe animaciones y layout).

| Token | Valor |
| --- | --- |
| Duración | **720 ms** (igual que legal hoy) |
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Relayout | Relayout de capas fantasy/space durante la transición (como legal) |
| `prefers-reduced-motion` | `durationMs ≈ 0`–80 |

Helper propuesto (puro / testeable):

```js
/**
 * @param {string} path — hash path sin #
 * @returns {boolean} true = bandas compactas
 */
function shouldCompressWorldBands(path) {
  if (path === "home") return false;
  // account, legal/*, crew, settings, …
  return isShellRoutePath(path) && path !== "home";
}
```

### 1.4 Integración con navegación shell

- Al navegar desde drawer / FAB cuenta: si origen y destino difieren en compactación, animar bandas **antes o en paralelo** al mount de la escena (mismo patrón que `prepareLegalNavigation` / `navigateFromLegal`).
- El shell permanece montado; no destruir mundo ([SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md)).

---

## 2. Marco glass de sección

### 2.1 Anatomía (viewport 390×844)

```
┌─────────────────────────────────────┐
│ [≡]              [◐] [☺]            │  ← shell chrome (fijo)
│    ╭───────────────────────────╮    │
│    │  [←]  [logo / skel]  [→]  │    │  ← cabecera FIJA (no scroll)
│    │       Tripulación         │    │  ← título de sección FIJO
│    │───────────────────────────│    │
│    │   subtítulo / contenido   │    │  ← scroll interno + fade
│    │   (formulario, listas…)   │    │
│    │                           │    │
│    ╰───────────────────────────╯    │
│  ░ sci-fi compacto ░               │
│  ░ fantasía compacta ░             │
└─────────────────────────────────────┘
```

### 2.2 Geometría

| Propiedad | Valor |
| --- | --- |
| Ancho | `min(100% - 2×pad, 100%)` dentro de `#app`; pad horizontal `clamp(12px, 4vw, 20px)` |
| Márgenes laterales | Simétricos; el marco **no** toca los FABs |
| Top | Bajo la banda de chrome: `var(--shell-chrome-band-h)` + `clamp(8px, 2vh, 16px)` |
| Bottom | Más bajo que v1: `bottom: calc(18% + env(safe-area-inset-bottom, 0px))` — el marco **ocupa más altura** hacia el pie fantasía compacto |
| Alto | Rellenar el hueco entre top y bottom (flex/`absolute` inset) |
| Border-radius | `16px`–`20px` (coherente con glass; no pill) |
| z-index | Por encima del mundo, **por debajo** del shell chrome/drawer |

Responsive: en desktop el marco se limita al ancho de `#app` (mismo frame que el shell), no al viewport completo.

### 2.2b Variante play — cajetín más alto (delta ago 2026)

En rutas `#/play/:childId` el marco debe **bajar más** hacia el paisaje para leer más diálogo de golpe ([SPEC_APP_ADVENTURE_STORY_RICHNESS.md](SPEC_APP_ADVENTURE_STORY_RICHNESS.md) §7; [SPEC_APP_ADVENTURE_DIALOGUE.md](SPEC_APP_ADVENTURE_DIALOGUE.md) §1.4).

| Propiedad | Gestión (crew/cuenta/…) | Play (`:has(.play-panel)` o clase `section-frame--play`) |
| --- | --- | --- |
| `bottom` | `calc(18% + safe-area)` | **`calc(6% + safe-area)`** (rango aceptable 4%–8%) |
| Mundo visible bajo el marco | Franja fantasía/sci-fi amplia | Franja menor pero **sigue visible** (no full-bleed opaco) |
| Compose | N/A o footer corto | Sigue anclado a `.section-frame__footer` |

**Prohibido:** subir el `top` tapando FABs; eliminar el fade del scroll; hacer el marco full-viewport sin ver el mundo.

Criterio visual 390×844: el historial muestra ≈ **40–50 % más** de altura útil de scroll vs gestión; captura `tmp/playwright-output/play-frame-taller-v1.png`.

### 2.3 Estilo glass (paridad con drawer)

Tokens alineados a [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md) §2.2 / CSS actual:

| Propiedad | Valor |
| --- | --- |
| Fondo | `rgba(255, 255, 255, 0.12)` — blanco con **mucha** transparencia (`--shell-drawer-bg`) |
| Blur | `backdrop-filter: blur(18px)` (igual drawer; mayor que FABs) |
| Borde | `1px solid rgba(255, 255, 255, 0.28)` — **mismo** criterio que el borde derecho del menú (`--shell-drawer-border`) |
| Sombra | `0 8px 28px rgba(0, 0, 0, 0.16)` (sutil; no multi-layer) |
| Fallback sin `backdrop-filter` | Fondo `rgba(255,255,255,0.20)` (mismo patrón shell) |

**Prohibido:** relleno gris/negro semitransparente; cards anidadas opacas innecesarias.

### 2.4 Cabecera — logo (instancia única)

| Requisito | Valor |
| --- | --- |
| **Instancia única** | **Un solo** nodo DOM del wordmark (el de loader/home). **Prohibido** duplicar `<img>` en el marco al cambiar de sección |
| Transición | Al entrar/salir de una sección con marco: **morph** posición + escala del logo hacia/desde la cabecera del marco (`morphLogoBetweenRects`, mismo contrato que legal ↔ home) |
| Asset | Mismo wordmark / ambigrama que loader y drawer |
| Posición | Superior del marco, **centrado** |
| Tamaño | **Más pequeño** que legal: `clamp(56px, 14vw, 72px)` de ancho (legal usa ~104–140 px) |
| Slot | `.section-frame__logo-mount` — contenedor vacío; el logo viaja aquí, no se clona |
| Motion | Sin órbita en sección; morph sincronizado con bandas cuando aplique |
| Accesibilidad | `alt="KidepiK"` en la imagen del logo compartido |

La cabecera del logo es **fija** dentro del marco (fuera del scroll); el **scroll** aplica solo a la zona de contenido (§3).

### 2.4c Título de sección (cabecera fija)

| Requisito | Valor |
| --- | --- |
| Elemento | `<h1 class="section-frame__title">` en `.section-frame__header` (debajo del logo) |
| Scroll | **No** — el título no entra en `.section-frame__scroll` |
| Tipografía | Misma matriz §2.5 (display según `data-shell-theme`) |
| Tamaño | `calc(1.35rem * var(--font-scale-ui, 1))` |
| API | `mountSectionFrame(host, { title })` + `setTitle(text)` |
| Accesibilidad | `aria-labelledby` → id del `h1`; `ariaLabel` solo si no hay título |

**Matriz de títulos**

| Ruta | Título en cabecera |
| --- | --- |
| `#/account` | Cuenta |
| `#/settings` | Ajustes |
| `#/crew` | Tripulación |
| `#/crew/new` | Nuevo tripulante |
| `#/crew/:id` | Nombre del tripulante (`setTitle` tras carga) |
| `#/play/:childId` | Aventura (MVP) |

Subtítulos contextuales (`crew-panel__subtitle`, helpers, mentor en play) **siguen en scroll**. Prohibido duplicar el `<h1>` de sección dentro del panel.

### 2.4d Logo — skeleton y estados de carga

| Estado | Clase en `.loader-logo-wrap` | Visible |
| --- | --- | --- |
| Pending | `is-logo-pending` | Skeleton glass en `.section-frame__logo-mount` |
| Ready | `is-logo-ready` (+ `is-ready`) | `<img class="loader-logo">` |
| Error | `is-logo-error` | Solo `.loader-logo-fallback` |

| Regla | Detalle |
| --- | --- |
| Helper | `syncLogoRevealState` / `inferLogoRevealState` (`web/js/lib/logo-reveal.js`) |
| Pending | Prohibido mostrar img rota o fallback textual |
| Ready ya en caché (home→sección) | Sin flash de skeleton |
| Skeleton | `.section-frame__logo-skeleton` + patrón glass-skeleton (`DESIGN.md` §11) |
| Reduced motion | Sin shimmer agresivo |

### 2.4b Animación del marco (fade)

| Estado | Motion |
| --- | --- |
| Entrar | Fade-in opacidad `0 → 1` en **280 ms**, `cubic-bezier(0.4, 0, 0.2, 1)` |
| Salir | Fade-out opacidad `1 → 0` en **220 ms** antes de desmontar la escena |
| Reduced motion | Instantáneo o ≤ 80 ms |

### 2.5 Tipografía e iconos (tema sticky)

Consumen `html[data-shell-theme]` / `getShellUiTheme()`:

| Elemento | `sci-fi` | `fantasy` |
| --- | --- | --- |
| Títulos / labels display | Bruno Ace / Orbitron | Uncial Antiqua / Cinzel |
| Cuerpo / inputs | Nunito | Nunito |
| Iconos UI | Variante procedural `sci-fi` | Variante `fantasy` |

Al cambiar el toggle del shell, la sección reacciona **sin recargar** (CSS + regeneración de SVG si hay iconos).

### 2.6 Iconografía en botones de sección (norma general)

| Regla | Detalle |
| --- | --- |
| Botones con texto | Icono procedural a la **izquierda** del label (`renderShellUiIconSvgInner`) |
| Tema | Variante `sci-fi` \| `fantasy` según `uiTheme` sticky; icono blanco salvo §2.6b |
| Tamaño icono | ~18–20 px dentro del botón |
| IDs mínimos | `save`, `danger` (+ catálogo shell existente) |

### 2.6b Acciones peligrosas (norma general)

| Regla | Detalle |
| --- | --- |
| Estilo botón | **Mismo** glass que el resto de botones de sección |
| Semántica peligro | Icono `danger` en **rojo** (`#FF6B63` aprox.) con variantes sci-fi y fantasy |
| Ejemplo | «Eliminar cuenta» = botón glass + icono danger rojo + texto blanco |

Persistencia del tema: la ya definida en shell (`localStorage` `kidepik.shell.uiTheme`, default `fantasy`); cuando exista sync a `parent_accounts`, esta sección no cambia de contrato — solo consume el tema activo.

---

## 3. Scroll interno + fade de opacidad

### 3.1 Contenedor de scroll

| Propiedad | Valor |
| --- | --- |
| Overflow | `overflow-y: auto` solo en la zona de contenido (bajo el logo) |
| Overflow-x | `hidden` |
| Scrollbar | Discreto (~6 px), track transparente; no tapar el fade |
| Touch | Inercia nativa; no scroll del `body`/`#app` detrás |
| Safe-area | Padding inferior interno respeta home indicator si el marco llega abajo |

### 3.2 Fade (máscara)

Igual idea que legal (`mask-image` / `-webkit-mask-image`):

| Borde | Efecto |
| --- | --- |
| Superior | Contenido que sale por arriba → fade a transparente |
| Inferior | Contenido que entra por abajo → fade desde transparente |

| Token | Valor orientativo |
| --- | --- |
| Ramp | `clamp(48px, 12dvh, 96px)` (puede ser menor que legal si el marco es más bajo) |
| Anclas | Variables CSS actualizadas en resize/scroll si hace falta (patrón `legal.js`) |

Con `prefers-reduced-motion`: máscara puede permanecer (no es motion temporal); no añadir animaciones de entrada por ítem.

### 3.3 Contenido

- El **título de sección** vive en la cabecera fija (§2.4c); el resto (textos, botones, campos, subtítulos, iconos) vive en la zona scrolleable.
- Estilo acorde a controles ya existentes (FABs glass, botones auth, tipografía dual).
- No introducir un design system paralelo.

---

## 4. Módulo previsto

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/section-frame.js` | Montar marco + logo + título fijo + slot de contenido; API `mountSectionFrame(host, { title?, ariaLabel?, navigation? })` → `{ contentEl, logoMountEl, titleEl, setTitle, syncLogoSkeleton, destroy }` |
| `web/js/lib/logo-reveal.js` | Estados pending/ready/error del wordmark |
| `web/js/lib/world-band-layout.js` (o extender `world-transition.js`) | `shouldCompressWorldBands(path)`, orquestar compact/expand en navegación shell |
| `web/css/components/section-frame.css` | Glass, geometría, cabecera, scroll, máscara fade, skeleton logo |
| `web/tests/world-band-layout.test.js` | Matriz home vs compactas |
| `web/tests/logo-reveal.test.js` | Estados de revelación del logo |
| `web/tests/section-frame.test.js` | `setTitle` / `titleEl` (si hay DOM) |
| Escenas | account, settings, crew, play; legal **no** monta este marco |

API mínima:

```js
/**
 * @param {HTMLElement} host
 * @param {{
 *   ariaLabel?: string;
 *   title?: string;
 *   navigation?: boolean | { back?: boolean; forward?: boolean };
 * }} [options]
 * @returns {{
 *   root: HTMLElement;
 *   contentEl: HTMLElement;
 *   logoMountEl: HTMLElement;
 *   titleEl: HTMLElement | null;
 *   setTitle: (text: string) => void;
 *   syncLogoSkeleton: (logoWrap?: HTMLElement | null) => void;
 *   destroy: () => Promise<void>;
 * }}
 */
export function mountSectionFrame(host, options = {})
```
---

## 5. Capas z-index (extensión shell)

| Capa | Contenido |
| --- | --- |
| Mundo procedural | Capas duales (compactas o expandidas) |
| Marco de sección | Glass + scroll |
| Shell scrim / drawer / FABs | Sin cambio respecto SPEC_APP_SHELL_CHROME |
| Modal confirmación (cuenta) | Por encima del shell |

---

## 6. Criterios de aceptación

1. Con sesión, `#/home` muestra bandas **expandidas** (como hoy).
2. Navegar Home → `#/account`: bandas se **comprimen** con animación ~720 ms (o reduced).
3. Navegar `#/account` → Home: bandas se **expanden** con animación.
4. `#/account` muestra marco glass central con borde 1 px blanco semitransparente y blur visible sobre el mundo.
5. Logo KidepiK centrado arriba dentro del marco, tamaño menor que en legal; durante pending solo skeleton (sin img rota ni fallback textual).
6. Título de sección fijo en cabecera (p. ej. «Tripulación» / «Cuenta» / «Aventura»); al hacer scroll del contenido el título permanece visible.
7. No hay `<h1>` de sección duplicado en el área scrolleable.
8. Contenido largo scrollea **dentro** del marco; fade superior e inferior visibles.
9. Toggle tema cambia tipografía (e iconos si hay) del título y contenido del marco al instante.
10. Legal autenticado sigue compacto **sin** adoptar el marco glass.
11. Playwright 390×844: capturas `tmp/playwright-output/section-header-title-scroll-v1.png`, `section-logo-skeleton-v1.png` (si viable).

---

## 7. Tests

| Test | Archivo |
| --- | --- |
| `shouldCompressWorldBands`: home false; account/legal true | `web/tests/world-band-layout.test.js` |
| Mount frame expone `titleEl` / `setTitle` y limpia en destroy | `web/tests/section-frame.test.js` |
| `syncLogoRevealState` pending/ready/error | `web/tests/logo-reveal.test.js` |

---

## 8. Relación con specs existentes

| Spec | Relación |
| --- | --- |
| SPEC_APP_SHELL_CHROME | Shell overlay; este patrón es el contenido bajo chrome |
| SPEC_LEGAL_AUTHENTICATED_SESSION | Origen del comportamiento de bandas compactas; legal no usa marco |
| SPEC_WORLD_LAYERS_PERSISTENCE | Transiciones no destruyen capas |
| SPEC_APP_ACCOUNT_SECTION | Primera sección que monta el marco |

---

## 9. Decisiones a confirmar en aprobación

- [ ] Matriz §1.2 (home expandido; resto gestión compacto; legal sin glass frame)
- [ ] Tokens glass = drawer (`0.12` / borde `0.28` / blur 18)
- [ ] Logo sección `clamp(56px, 14vw, 72px)`
- [ ] Duración bandas 720 ms alineada a legal
- [ ] Alias de clases `is-world-band-compact` opcional vs reutilizar `is-world-band-legal`

## Aprobación

- [x] Usuario aprueba contrato de bandas por ruta
- [x] Usuario aprueba anatomía y glass del marco
- [x] Usuario aprueba scroll + fade
- [x] Usuario aprueba que Legal no adopta el marco en esta fase

Siguiente tras aprobación: Plan/Task → Implement (TDD helpers de bandas + frame) → Validate Playwright → sección Cuenta.
