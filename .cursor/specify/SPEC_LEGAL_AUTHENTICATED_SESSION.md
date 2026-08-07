# Spec: Legal autenticado + shell post-login

> Estado: **aprobada** (julio 2026); **delta ago 2026:** legal autenticado usa `mountSectionFrame` (cajetín glass homogéneo)  
> Relacionado: [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md), `supabase/migrations/` (documentos legales), [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md)

## Contexto

Las pantallas `#/legal/terminos` y `#/legal/privacidad` se diseñaron primero para el flujo **pre-login** (enlaces desde el panel auth del loader): FABs procedurales de volver/subir, transición animada de vuelta al loader y tipografía fija sci-fi.

Tras el shell post-login, un padre autenticado puede abrir legal desde el drawer o volver desde legal. Hoy el botón **Volver** siempre hace handoff al loader (como si no hubiera sesión), lo que **rompe la sesión de producto** visualmente. Además faltan el chrome común (menú + FABs) y la tipografía dual del tema UI padre.

## Objetivo

Cuando existe **sesión Supabase válida**, las pantallas legales deben comportarse como **sección autenticada de gestión**: shell visible, marco glass (`section-frame`), vuelta vía navegación shell estándar, y tipografía acorde a `uiTheme` del shell (`sci-fi` | `fantasy`).

El flujo **sin sesión** (visitante en loader → legal) **no cambia**.

---

## Alcance

### Incluido

| Requisito | Detalle |
| --- | --- |
| Marco glass | `mountSectionFrame` + `mountLegalPanel` (mismo patrón que Cuenta/Ajustes) |
| Shell en legal autenticado | `ensureAppShell` activo; menú, toggle tema y cuenta visibles |
| Volver autenticado | Navegación shell (menú / atrás del marco) → destino sin `signOut` |
| Volver anónimo | Mantiene transición legal → loader/auth actual |
| Tipografía dual | Títulos del markdown y título del marco siguen `data-shell-theme` |
| FABs legales | Solo en modo anónimo (el shell cubre navegación autenticada) |
| Layout bajo chrome | Marco glass bajo FABs del shell; scroll con fade del `section-frame` |
| Persistencia mundo | Capas procedurales siguen entre legal ↔ home ([SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md)) |

### Excluido

| Tema | Notas |
| --- | --- |
| Reescribir transición legal ↔ home | Vuelta autenticada puede ser fade + `navigate('/home')` sin morph al logo auth |
| Editor admin de legales | Fuera de alcance |
| Tema mundo del niño | Solo tema UI padre del shell |

---

## Modos de la escena legal

| Modo | Condición | Shell | FABs legales | Volver |
| --- | --- | --- | --- | --- |
| **Anónimo** | Sin `access_token` válido | No montado | Visibles (flecha izq. + subir) | Handoff animado → `#/loader` (`resumeAuth`) |
| **Autenticado** | Sesión válida | Montado (mismo contrato que home/account) | Ocultos (N/A) | Navegación shell estándar (`navigateShellRoute`) |

Clase escena autenticada: usa `scene-loader` + `section-frame` (no `.scene-legal`).

---

## Tipografía (solo autenticado)

Aplica cuando `body.is-shell-active` y `html[data-shell-theme]` está definido:

| Elemento | `sci-fi` | `fantasy` |
| --- | --- | --- |
| `h1`, `h2`, `h3` del markdown | Bruno Ace / Orbitron | Uncial Antiqua / Cinzel |
| Cuerpo (`p`, `ul`, tablas) | Nunito | Nunito (legibilidad) |
| Logo fallback | Bruno Ace / Orbitron | Uncial Antiqua / Cinzel |

Al cambiar el toggle del shell, el documento actualiza `data-shell-theme` y el legal reacciona vía CSS (sin recargar).

---

## Integración shell

- Rutas: `legal/terminos`, `legal/privacidad` ya están en `isShellRoutePath()`.
- Enlaces del drawer (Términos / Privacidad): `prepareLegalNavigation` + `navigate`; animación de bandas/logo igual que auth → legal.
- Salida autenticada (Inicio / Cuenta / FAB cuenta): `animateWorldBands` expandiendo en legal + `navigateFromLegal` → destino con bandas ya expandidas.
- `body.is-shell-active` mantiene `#app` a ancho completo durante el handoff ([SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md) §15).

---

## Criterios de aceptación

1. Usuario logueado en `#/home` → drawer → Términos: ve menú + FABs shell; no ve FAB flecha legal.
2. En Términos/Privacidad autenticado → Volver (si se expone) o Inicio en menú → `#/home`, sesión activa.
3. Toggle sci-fi ↔ fantasía en legal autenticado cambia fuentes de títulos al instante.
4. Usuario **sin** sesión en loader → legal → Volver → loader/auth (comportamiento actual).
5. Playwright 390×844: capturas `legal-auth-shell-*.png` bajo `tmp/playwright-output/`.

---

## Tests

| Test | Archivo |
| --- | --- |
| Destino de vuelta según sesión | `web/tests/legal-navigation.test.js` |
| Evento / suscripción tema shell | `web/tests/shell-theme.test.js` (extensión) |

---

## Implementación (referencia)

| Área | Archivos |
| --- | --- |
| Escena autenticada | `web/js/scenes/legal.js` (`renderLegalAuthenticated`) |
| Panel contenido | `web/js/components/legal-panel.js` |
| Escena anónima | `web/js/scenes/legal.js` (`renderLegalAnonymous`) |
| Estilos anónimos | `web/css/scenes/legal.css` |
| Estilos marco | `web/css/components/section-frame.css`, reglas `.section-frame .legal-panel` en `legal.css` |
| Tema | `web/js/lib/shell-theme.js` |
| Navegación | `web/js/lib/shell-navigation.js`, `web/js/lib/legal-navigation.js` |
