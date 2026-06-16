# kidepik

Producto **Kidepik** (ecosistema Kuiper Belt, org `KuiperBelt-PRO`).

## Ramas

- `master` — release
- `develop` — integración

## POC local (arquitectura)

Validación **completada** (jun 2026) de FastAPI + Supabase + R2 (MinIO) + app móvil (Expo Go, SDK 54):

- Guía: [docs/POC_LOCAL.md](docs/POC_LOCAL.md)
- Spec: [.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md](.cursor/specify/SPEC_POC_LOCAL_ARCHITECTURE.md)
- Arranque: `./scripts/poc-up.ps1` · App web (PC): `./scripts/poc-expo-web.ps1` · Móvil: `./scripts/poc-expo-go.ps1`

## Sistema visual (galería de diseño)

Spec: [.cursor/specify/SPEC_APP_VISUAL_DESIGN.md](.cursor/specify/SPEC_APP_VISUAL_DESIGN.md)

Tras `./scripts/poc-expo-web.ps1` (PC) o `./scripts/poc-expo-go.ps1` (móvil), la app abre con **loader** → **galería de mockups**. Usa el toggle Fantasía/Espacio para validar el dual theme. El POC de arquitectura sigue accesible desde la galería (dev).

## Agentes y SDD

Documentación de agentes, reglas y specs en [`.cursor/AGENTS.md`](.cursor/AGENTS.md).

