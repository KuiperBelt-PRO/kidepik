# Spec: Legal autenticado + shell post-login

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_APP_SHELL_CHROME.md](SPEC_APP_SHELL_CHROME.md), [SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md](SPEC_PHP_DB_MIGRATIONS_AND_LEGAL.md), [SPEC_APP_AUTH.md](SPEC_APP_AUTH.md), [SPEC_WORLD_LAYERS_PERSISTENCE.md](SPEC_WORLD_LAYERS_PERSISTENCE.md)

## Contexto

Las pantallas `#/legal/terminos` y `#/legal/privacidad` se diseñaron primero para el flujo **pre-login** (enlaces desde el panel auth del loader): FABs procedurales de volver/subir, transición animada de vuelta al loader y tipografía fija sci-fi.

Tras el shell post-login, un padre autenticado puede abrir legal desde el drawer o volver desde legal. Hoy el botón **Volver** siempre hace handoff al loader (como si no hubiera sesión), lo que **rompe la sesión de producto** visualmente. Además faltan el chrome común (menú + FABs) y la tipografía dual del tema UI padre.

## Objetivo

Cuando existe **sesión Supabase válida**, las pantallas legales deben comportarse como **sección autenticada de gestión**: shell visible, vuelta a `#/home` sin cerrar sesión, y tipografía acorde a `uiTheme` del shell (`sci-fi` | `fantasy`).

El flujo **sin sesión** (visitante en loader → legal) **no cambia**.

---

## Alcance

### Incluido

| Requisito | Detalle |
| --- | --- |
| Shell en legal autenticado | `ensureAppShell` activo; menú, toggle tema y cuenta visibles |
| Volver autenticado | FAB volver (si visible) o navegación equivalente → `#/home`, **sin** `signOut` ni `navigate('/loader')` con `resumeAuth` |
| Volver anónimo | Mantiene transición legal → loader/auth actual |
| Tipografía dual | Títulos y logo fallback en legal siguen `data-shell-theme` del documento |
| FABs legales | Ocultos en modo autenticado (el shell cubre navegación y tema) |
| Layout bajo chrome | Logo y texto a **la misma altura** que legal anónimo; el shell se superpone sin desplazar el contenido |
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
| **Autenticado** | Sesión válida | Montado (mismo contrato que home/account) | Ocultos | `#/home` (sesión intacta) |

Clase escena: `.scene-legal.is-legal-authenticated` cuando hay sesión.

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
| Escena | `web/js/scenes/legal.js` |
| Estilos | `web/css/scenes/legal.css` |
| Tema | `web/js/lib/shell-theme.js` |
| Navegación pura | `web/js/lib/legal-navigation.js` |
