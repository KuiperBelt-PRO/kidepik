# 06 — Arquitectura frontend

**Specs:** [SPEC_WEB_FRONTEND_ARCHITECTURE.md](../specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md), [DESIGN.md](../DESIGN.md)

```mermaid
flowchart TB
  HTML[web/index.html] --> Main[js/main.js]
  Main --> Router[lib/router.js hash]
  Main --> Theme[lib/theme.js data-theme]
  Main --> ShellTheme[lib/shell-theme.js data-shell-theme]

  Router --> Scenes[js/scenes/*]
  Scenes --> Comp[js/components/*]
  Scenes --> Lib[js/lib/*]

  Comp --> World[world-layers + loader-*]
  Comp --> Shell[app-shell section-frame]
  Comp --> Panels[account settings crew auth legal]
  Comp --> Glass[glass-controls]

  Lib --> SB[supabase.js]
  Lib --> API[parent-account parent-settings crew-api]
  Lib --> WS[world-session]
```

## Capas de código

| Carpeta | Responsabilidad |
| --- | --- |
| `js/scenes/` | Montaje por ruta (`loader`, `home`, `account`, `settings`, `crew`, `legal`, `auth-callback`) |
| `js/components/` | DOM factories: loader*, shell, paneles, glass |
| `js/lib/` | Router, temas, sesión mundo, APIs, navegación shell |
| `css/` | Tokens, layout, themes, `components/glass-controls.css` |
| Sin bundler | ES modules + cache-bust `?v=` en imports críticos |

## Temas (dos ejes)

| Eje | Storage / attr | Ámbito |
| --- | --- | --- |
| Mundo visual dual | `localStorage` `kidepik-theme` → `data-theme` = `fantasy` \| `spaceOpera` | Capas / tipografía mundo |
| UI shell tutor | `kidepik.shell.uiTheme` → `data-shell-theme` = `fantasy` \| `sci-fi` | Chrome, tipografía gestión |

**No confundir** tema UI padre con `children.world_theme` (`fantasy` \| `sci-fi`).

## Anti-errores

- No introducir React/Vite como requisito MVP.
- Controles tutor: glass blanco ([DESIGN.md](../DESIGN.md)); sin accent-color de sistema.
