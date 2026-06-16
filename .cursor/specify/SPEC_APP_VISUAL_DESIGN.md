# Spec: Sistema visual de la app móvil

> Estado: **aprobada** (junio 2026)  
> Relacionado: [docs/kidepik.md](../../docs/kidepik.md) §2, §5, [SPEC_POC_LOCAL_ARCHITECTURE.md](SPEC_POC_LOCAL_ARCHITECTURE.md)

## Objetivo

Definir un **sistema de diseño dual** (fantasía / space opera) con estética de **aventura gráfica moderna para móvil**: marcos narrativos, elecciones y retos legibles en pantallas táctiles, con un toque retro mínimo como gancho visual — no réplica SCUMM de los 90.

Validación inicial: **pantalla de carga (loader)** y **galería de mockups** navegable en Expo Go.

## Decisiones de producto (cerradas)

| # | Decisión |
| --- | --- |
| 1 | **Opción D — híbrido:** base ilustrada/vectorial + acentos GPU (Skia) en loader, transiciones y mapa. |
| 2 | **UX móvil primero:** sin panel de verbos; diálogo inferior, botones grandes, hotspots implícitos. Retro sutil (bordes, tipografía display, scanlines opcionales en space). |
| 3 | **Assets actuales:** vectoriales/SVG generados en código. **Futuro:** material gráfico producido con modelos de IA; los componentes deben aceptar sustitución por PNG/SVG externos sin reescribir layout. |
| 4 | **Marca:** sin gimmicks del logotipo (no “ojos” en d/p ni interacciones por giro del dispositivo). Logo = wordmark tipográfico limpio. |

## Alcance

### Incluido (esta iteración)

- Tokens de diseño: primitivos → semánticos → tema (`fantasy` | `spaceOpera`).
- `ThemeProvider` con cambio de tema en runtime.
- Componentes base reutilizables (marcos, botones, diálogo, progreso).
- `LoaderScreen`: animación de arranque temática.
- `DesignGalleryScreen`: lista de mockups para validar el sistema.
- Mockups: selector de mundo, diálogo, elección de ruta, reto, mapa, HUD, recompensa, shell minijuego.
- Dependencias: Reanimated, SVG, LinearGradient, Skia (acentos), fuentes Google.

### Excluido

- Navegación de producto real (onboarding, auth, API).
- Ilustraciones raster custom o pipeline IA (solo anotado como fase posterior).
- i18n, accesibilidad formal WCAG (objetivo legibilidad 7–9 años, sin auditoría completa).
- Tests automatizados de UI (validación manual en Expo Go).

## Arquitectura de tokens

```
tokens (spacing, radius, touchMin, typography.body)
  └── semantic (primary, surface, narrative, success, hint, danger, overlay)
        ├── fantasy   (palette, frameStyle, particleKind, displayFont)
        └── spaceOpera
```

**Invariante entre temas:** geometría, tamaño mínimo táctil (≥ 48 dp), jerarquía tipográfica del cuerpo, estructura de pantallas.

**Variable por tema:** paleta, gradientes de fondo, estilo de marco SVG, partículas Skia, fuente display, microcopy de UI (“Runa” / “Módulo”).

## Tipografía

| Rol | Fantasía | Space Opera | Ambos |
| --- | --- | --- | --- |
| Display / títulos | Cinzel | Orbitron | — |
| Cuerpo / retos | — | — | Nunito |

## Componentes del design system

| Componente | Uso |
| --- | --- |
| `ThemeBackground` | Gradiente + decoración SVG de fondo |
| `GamePanel` | Marco de aventura (esquinas ornamentales por tema) |
| `GameButton` | CTA y elecciones de ruta |
| `DialogueBox` | Texto narrativo + avatar placeholder |
| `ProgressRing` | Loader y progreso de sesión (Skia) |
| `ChoiceList` | 2–3 opciones narrativas |
| `ChallengeCard` | Enunciado + respuestas + pista |
| `MapNode` | Nodo de materia en mapa |
| `SessionHud` | Materia, progreso sin puntuación agresiva |
| `RewardSlot` | Objeto / recompensa narrativa |
| `MiniGameShell` | Contenedor canvas para minijuegos futuros |

## Pantallas de validación

1. **Loader** — wordmark, anillo de progreso, partículas temáticas, frase narrativa rotatoria.
2. **Galería** — selector de tema + acceso a cada mockup.
3. **Mockups** — los listados arriba con datos de ejemplo en español.

## Pipeline de assets (futuro)

1. Los componentes exponen props `imageSource` / `IllustrationSlot` donde hoy hay SVG placeholder.
2. Assets generados por IA se colocarán en `mobile/assets/themes/{fantasy|space}/` con convención `{component}-{variant}.png` o `.svg`.
3. Sustitución: cambiar el resolver de assets en `theme/assets.ts` sin tocar layout.
4. Documentar en código con comentario `// ASSET_SLOT: <nombre>` en cada placeholder.

## Criterios de éxito

1. App arranca en loader y transita a galería tras ~2,5 s (o tap para saltar en dev).
2. Cambio fantasy ↔ space opera actualiza todos los mockups visibles.
3. Texto de reto legible en móvil 5–6" sin zoom.
4. Áreas táctiles ≥ 48 dp en botones y elecciones.
5. Animación del loader fluida en Expo Go (Android físico validado).

## Estructura de archivos

```
mobile/
  theme/
    types.ts
    tokens.ts
    fantasy.ts
    spaceOpera.ts
    ThemeProvider.tsx
    assets.ts          # resolución de assets; placeholders → IA futuro
  components/
    ...
  screens/
    LoaderScreen.tsx
    DesignGalleryScreen.tsx
  mockups/
    ...
```

## Referencias de estilo (no prescriptivas)

- Marcos y diálogo: aventura gráfica moderna (Broken Age, Layton).
- Gancho retro mínimo: textura sutil, no pixel art dominante.
- Partículas: Skia en loader y mapa.
