# 10 — Superficies del tutor

**Specs:** [SPEC_APP_ACCOUNT_SECTION.md](../specify/SPEC_APP_ACCOUNT_SECTION.md), [SPEC_APP_SETTINGS_SECTION.md](../specify/SPEC_APP_SETTINGS_SECTION.md), [SPEC_APP_CREW_SECTION.md](../specify/SPEC_APP_CREW_SECTION.md), [SPEC_LEGAL_AUTHENTICATED_SESSION.md](../specify/SPEC_LEGAL_AUTHENTICATED_SESSION.md), [SPEC_APP_SECTION_FRAME.md](../specify/SPEC_APP_SECTION_FRAME.md), [DESIGN.md](../DESIGN.md)

```mermaid
flowchart TB
  Shell[app-shell FABs + drawer]
  Frame[section-frame cabecera fija logo+titulo scroll-fade]

  Shell --> Home[home welcome]
  Shell --> Acc[account-panel]
  Shell --> Set[settings-panel]
  Shell --> Crew[crew-panel lista/alta/ficha/diario]
  Shell --> Play[play-panel diálogo aventura]
  Shell --> Legal[legal markdown sin marco glass]

  Acc --> Frame
  Set --> Frame
  Crew --> Frame
  Play --> Frame
```

## Estado de implementación (ago 2026)

| Superficie | Estado | API |
| --- | --- | --- |
| Cuenta | Implementada; título «Cuenta» en cabecera | `GET/PATCH/DELETE /parents/me` |
| Ajustes | Fase A gestión; título en cabecera | `GET/PATCH /parents/me/settings` |
| Tripulación | Fase A + cartas TCG; **ficha v2 propuesta** (pestañas Viaje/Ajustes + progreso) | `/crew`, `/crew/:id`, permissions; `GET …/journey/timeline`; `progress` en crew detail (propuesto) |
| Play (`#/play/:id`) | Vertical slice; título «Aventura» en cabecera | dialogue session/turn |
| Legal autenticado | Shell + vuelta a home; **sin** section-frame | `GET /legal/:slug` |

## Navegación típica

```mermaid
flowchart LR
  Drawer --> Home
  Drawer --> Crew
  Drawer --> Settings
  Drawer --> Account
  Drawer --> Legal
  Drawer --> Logout[signOut → loader]
  FAB_Account[FAB cuenta] --> Account
  FAB_Theme[FAB tema UI] --> ToggleShellTheme
```

## Anti-errores

- Home **no** usa bandas compactas del section-frame (excepción de spec).
- Permisos de niño ≠ settings del hogar; defaults de crew viven en `settings.crew_defaults`.
- Controles: catálogo glass en DESIGN.md / `glass-controls.css`.
