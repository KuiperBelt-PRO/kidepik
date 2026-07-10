# kidepik

Producto **Kidepik** (ecosistema Kuiper Belt, org `KuiperBelt-PRO`).

## Ramas

- `master` — release
- `develop` — integración

## POC local (arquitectura)

Stack **PHP + Docker** (`:8082`) + Supabase CLI. Cliente en **`web/`** (HTML/CSS/JS):

- Guía: [docs/POC_LOCAL.md](docs/POC_LOCAL.md)
- Spec: [.cursor/specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](.cursor/specify/SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md)
- Arranque: `./scripts/poc-up.ps1` · Preview móvil PC: `./scripts/poc-web-preview.ps1`
- Backend PHP: `api/` + `shared/` · Legacy FastAPI: `backend/` (no extender)

## Sistema visual (galería de diseño)

Cliente **`web/`** (HTML + CSS + JavaScript). Specs:

- Arquitectura: [.cursor/specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](.cursor/specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md)
- Visual premium v3: [.cursor/specify/SPEC_APP_VISUAL_DESIGN_V3.md](.cursor/specify/SPEC_APP_VISUAL_DESIGN_V3.md)
- Preview dev (Electron + Playwright móvil): [.cursor/specify/SPEC_WEB_DEV_PREVIEW.md](.cursor/specify/SPEC_WEB_DEV_PREVIEW.md)

## Agentes y SDD

Documentación de agentes, reglas y specs en [`.cursor/AGENTS.md`](.cursor/AGENTS.md).
