# 10 — Superficies del tutor

**Specs:** [SPEC_APP_ACCOUNT_SECTION.md](../specify/SPEC_APP_ACCOUNT_SECTION.md), [SPEC_APP_SETTINGS_SECTION.md](../specify/SPEC_APP_SETTINGS_SECTION.md), [SPEC_APP_CREW_SECTION.md](../specify/SPEC_APP_CREW_SECTION.md), [SPEC_LEGAL_AUTHENTICATED_SESSION.md](../specify/SPEC_LEGAL_AUTHENTICATED_SESSION.md), [SPEC_APP_SECTION_FRAME.md](../specify/SPEC_APP_SECTION_FRAME.md), [DESIGN.md](../DESIGN.md)

```mermaid
flowchart TB
  Shell[app-shell FABs + drawer]
  Frame[section-frame bandas glass logo scroll-fade]

  Shell --> Home[home welcome]
  Shell --> Acc[account-panel]
  Shell --> Set[settings-panel]
  Shell --> Crew[crew-panel lista/alta/ficha]
  Shell --> Legal[legal markdown]

  Acc --> Frame
  Set --> Frame
  Crew --> Frame
  Legal --> Frame
```

## Estado de implementación (jul 2026)

| Superficie | Estado | API |
| --- | --- | --- |
| Cuenta | Implementada | `GET/PATCH/DELETE /parents/me` |
| Ajustes | Fase A gestión | `GET/PATCH /parents/me/settings` |
| Tripulación | Fase A gestión (plaza, lista, ficha, permisos) | `/crew`, `/crew/:id`, permissions |
| Legal autenticado | Shell + vuelta a home sin logout | `GET /legal/:slug` |
| Play desde crew | **Pendiente** (contrato en 11) | — |

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
