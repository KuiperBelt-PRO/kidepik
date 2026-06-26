# Spec: Lluvia de meteoritos — franja superior del loader

> Estado: **aprobada** (jun 2026)  
> Relacionado: [SPEC_LOADER_SCREEN.md](SPEC_LOADER_SCREEN.md), capa orbital (`loader-space-orbit.js`)

## Contexto

La mitad superior del loader concentra la ambientación **space opera**: planetas en órbita, arcos blancos y naves procedurales que cruzan de vez en cuando. Falta un elemento atmosférico ligero que refuerce el cielo estelar sin competir con planetas ni naves.

## Objetivo

Añadir **estelas fugaces horizontales** (meteoritos / shooting stars) en la franja superior, como partículas de distintos tamaños y velocidades, que aparezcan **esporádicamente** en ráfagas cortas — sensación de cielo vivo, no lluvia constante.

## Principios de diseño

| Principio | Decisión |
| --- | --- |
| Dirección | **Solo horizontal**, de **izquierda → derecha** (ángulo 0°; sin diagonal ni arco) |
| Estética | Estrella fugaz: **cabeza brillante a la derecha**, cola que se desvanece hacia la izquierda |
| Escala | Partículas pequeñas; variación de longitud y grosor, no objetos grandes |
| Ritmo | **Ráfagas ocasionales** con pausas largas; nunca un flujo continuo |
| Paleta | Blanco puro `#fff` y cyan suave `#7ec8ff` (tokens loader space); opacidad 0,35–1 |
| Capa | Misma zona que órbitas (`top 0`, altura ~48 %), **por debajo de naves** (z-index 2) |
| Máscara | Respeta el `mask-image` radial del anillo central (no cruzar el logo) |
| Accesibilidad | `prefers-reduced-motion`: **capa desactivada** |
| Rendimiento | Máx. **24** meteoritos concurrentes; DOM + `requestAnimationFrame` (sin canvas) |

## Composición (wire ASCII)

Vista de la franja superior (~48 % viewport):

```
  ←──────────────────────────────────────────→
  ·                    ·              ·
     ═══►                      ══►
        ══════►                        ═══►
  ·         ·                              ·
  ═══════════════════════════════════════════  ← borde inferior franja / máscara anillo
                    ( logo — zona enmascarada )
```

- Cada `═══►` es una estela; la cabeza (`►`) va **delante** (derecha).
- Las ráfagas agrupan 2–5 estelas en ~0,4–1,2 s, con Y aleatorio dentro de la franja útil.

## Comportamiento

### Ritmo de aparición (ráfagas)

| Parámetro | Valor | Notas |
| --- | --- | --- |
| Retardo inicial | 2,5–5 s tras montar loader | Evita competir con el arranque del anillo |
| Intervalo entre ráfagas | **12–22 s** (aleatorio uniforme) | Más espaciadas en el tiempo |
| Meteoritos por ráfaga | **10–28** | |
| Escalonado intra-ráfaga | **35–95 ms** entre cada spawn | Salen juntos; ráfaga corta (~0,4–2,5 s) |
| Pausa mínima post-ráfaga | Implícita en intervalo 12–22 s | Siguiente ráfaga tras el intervalo |

### Trayectoria

| Parámetro | Valor |
| --- | --- |
| Origen X | `-8 %` a `-18 %` del ancho del layer (fuera de pantalla izquierda) |
| Destino X | `108 %` a `118 %` (fuera de pantalla derecha) |
| Origen Y | `8 %`–`38 %` de la altura del layer (zona superior de la franja; evitar franja central enmascarada) |
| Movimiento | Solo `translateX` lineal; **sin** rotación ni `motion-path` |
| Duración por meteorito | `durationMs = base × sizeFactor` donde `base` ∈ 280–520 ms y `sizeFactor` ∈ 0,85–1,35 |

### Clases de tamaño

| Clase | Longitud (px) | Grosor (px) | Opacidad cabeza | Peso en spawn |
| --- | --- | --- | --- | --- |
| `micro` | 10–16 | 1 | 0,45–0,65 | 35 % |
| `small` | 18–28 | 1–1,5 | 0,55–0,8 | 40 % |
| `medium` | 32–48 | 1,5–2 | 0,7–0,95 | 20 % |
| `bright` | 52–72 | 2 | 0,85–1 | 5 % (raro) |

La **velocidad** no es independiente del tamaño: meteoritos más largos tienden a duración ligeramente mayor (más «lejos»), pero con jitter ±15 % para evitar patrones mecánicos.

### Apariencia visual (CSS)

Cada meteorito es un `div.loader-meteor` con gradiente horizontal:

```css
background: linear-gradient(
  90deg,
  transparent 0%,
  rgba(126, 200, 255, 0.15) 35%,
  rgba(255, 255, 255, var(--meteor-tail)) 72%,
  #fff 100%
);
border-radius: 999px;
box-shadow: 2px 0 6px rgba(126, 200, 255, 0.35); /* solo en medium/bright */
```

- Sin assets raster ni Lottie.
- Opcional: `filter: blur(0.3px)` en `micro` para suavizar.

### Ciclo de vida de un meteorito

1. **Spawn**: se crea fuera del DOM visible, posición inicial `(x0, y)`.
2. **Fade-in**: opacidad 0 → objetivo en los primeros **8 %** del recorrido.
3. **Cruce**: movimiento lineal L→R.
4. **Fade-out**: opacidad → 0 en el último **12 %** del recorrido (antes de salir por la derecha).
5. **Destroy**: `remove()` al completar; no pool de objetos en v1.

## Integración técnica

### Ficheros previstos

| Fichero | Responsabilidad |
| --- | --- |
| `web/js/components/loader-meteor-shower.js` | Montaje capa, scheduler de ráfagas, animación RAF, API `destroy()` |
| `web/css/scenes/loader.css` | Estilos `.loader-layer--meteor-shower`, `.loader-meteor`, variantes de tamaño |
| `web/js/components/loader-chrome.js` | Invocar `mountMeteorShowerLayer(layers, { reducedMotion })` junto a `mountSpaceOrbitLayer` |
| `web/tests/loader-meteor-shower.test.js` | Tests del scheduler (intervalos, límites concurrentes, desactivación reduced motion) |

### Montaje en el árbol DOM

```
.loader-layers
  ├── .loader-layer--bg
  ├── .loader-layer--accent (fantasy / space)
  ├── .loader-layer--space-orbit   (z-index 1)
  ├── .loader-layer--meteor-shower (z-index 2, nuevo)  ← encima de órbitas, debajo de naves
  └── …
```

La capa meteoritos **comparte** clip y máscara con `--space-orbit` (misma altura 48 %, mismo `mask-image` radial). Se puede extraer mixin CSS `--loader-orbit-zone-*` para no duplicar.

### API del módulo

```js
/**
 * @param {HTMLElement} container  — .loader-layers
 * @param {{ reducedMotion?: boolean }} [options]
 * @returns {{ destroy: () => void }}
 */
export function mountMeteorShowerLayer(container, options);
```

### RNG

Reutilizar patrón de `loader-ship-rng.js` (semilla por sesión de loader) para reproducibilidad en tests con semilla fija.

## Criterios de aceptación

1. Viewport **390×844**: al menos una ráfaga visible en **≤ 10 s** de observación (con motion activo).
2. Todas las estelas se mueven **estrictamente horizontal** (ΔY = 0 durante el vuelo).
3. Entre dos ráfagas consecutivas el intervalo planificado es **12–22 s**.
4. Nunca más de **24** meteoritos simultáneos.
5. Meteoritos **no** aparecen sobre el logo (máscara radial respetada).
6. `prefers-reduced-motion`: capa ausente; sin errores consola.
7. `destroy()` del loader cancela RAF y elimina nodos pendientes.
8. Tests unitarios del scheduler pasan en `web/tests/loader-meteor-shower.test.js`.
9. Captura Playwright opcional: `tmp/playwright-output/loader-meteor-burst.png` (forzar ráfaga con `?meteorDemo=1` solo en dev, si se implementa flag debug).

## Fuera de alcance

- Meteoritos en diagonal o siguiendo arcos orbitales.
- Sonido.
- Interacción táctil (tap no dispara ráfaga).
- Partículas en la mitad fantasía (solo franja superior space).
- Assets IA / spritesheets.

## Plan de implementación (tras aprobación)

1. Extraer variables CSS compartidas de zona orbital (opcional, refactor mínimo).
2. Implementar `loader-meteor-shower.js` con scheduler + animación.
3. Estilos en `loader.css`.
4. Cablear en `loader-chrome.js`.
5. Tests unitarios del scheduler.
6. Validación Playwright móvil 390×844 según [web-mobile-preview](../skills/web-mobile-preview/SKILL.md).

## Aprobación

- [x] Usuario aprueba ritmo de ráfagas (5–8 s, 5–20 meteoritos).
- [x] Usuario aprueba z-index (debajo de naves, encima de órbitas).
- [x] OK para implementar (fase Implement).
