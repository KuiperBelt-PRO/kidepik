# Spec: Bootstrap repositorio kidepik

**Alcance:** estructura `.cursor/`, reglas, skills y convenciones SDD alineadas con el workspace KuiperbeltPRO.

**Estado:** implementado (2026-06).

## Requisitos

- Carpeta `.cursor/` con `AGENTS.md`, `SDD.md`, `RULES.md`, `CURRENT_SPECS.md`, `COMPANY.md`.
- Reglas `repo-bootstrap`, `agent-skill-routing` y wrapper de pruebas browser.
- Skill local `spec-driven-dev-kidepik` para SDD/TDD en este repo.
- Ramas Git: `master` (default), `develop` (integración).

## Fuera de alcance (fase bootstrap)

- Stack de aplicación, CI, Docker y despliegue (siguiente spec de producto).
