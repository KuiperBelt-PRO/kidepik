# .cursor

Guía operativa para agentes en `kidepik`.

## Reglas base

- Repositorio de producto **Kidepik** del ecosistema Kuiper Belt (org `KuiperBelt-PRO`).
- No incluir secretos en git.
- Mantener trazabilidad entre spec, tareas y cambios cuando el trabajo lo merezca.

## MCP: Context7 y Engram

- **Context7** (`context7` en el hub `Vibe-Coding`): documentación **actual** de librerías, frameworks, CLI y APIs públicas cuando la respuesta dependa de la referencia oficial. No sustituye a leer el código de este repo.
- **Engram** (si está activo en el IDE): memoria persistente por proyecto; conviene **buscar** antes de repetir diagnósticos largos y **guardar** decisiones reutilizables.
- **GitHub:** MCP `github-rest` del hub (`Vibe-Coding/.cursor/mcp.json`) para operaciones de repos y ramas.

## Documentación en `.cursor/`

| Documento | Uso |
| --- | --- |
| [SDD.md](SDD.md) | Fases Specify → Plan → Task → Implement → Validate. |
| [RULES.md](RULES.md) | Índice de `.cursor/rules/` de este repo y reglas generales en `Vibe-Coding`. |
| [skills/spec-driven-dev-kidepik/SKILL.md](skills/spec-driven-dev-kidepik/SKILL.md) | SDD/TDD **solo** en este repositorio. |
| [skills/expo-go-mobile-preview/SKILL.md](skills/expo-go-mobile-preview/SKILL.md) | Arrancar Metro + QR para **Expo Go** en móvil físico. |
| Git (commit, push, stage) | Hub: `Vibe-Coding/.cursor/skills/git-workflow/SKILL.md`. |
| [COMPANY.md](COMPANY.md) | Alineación de marca con Kuiper Belt. |
| [CURRENT_SPECS.md](CURRENT_SPECS.md) | Índice de specs vigentes y enlaces a `.cursor/specify/`. |
| [plan/PROJECT_OVERVIEW.md](plan/PROJECT_OVERVIEW.md) | Contexto del repo, stack y URLs locales. |
| [specify/README.md](specify/README.md) | Convención para nuevas especificaciones. |
| [operations/README.md](operations/README.md) | Convención para flujos operativos reproducibles. |
| [operations/OCI_ALWAYS_FREE_VALIDATION.md](operations/OCI_ALWAYS_FREE_VALIDATION.md) | Validación Oracle Always Free (VM ARM). |
| [skills/oci-mcp-ops/SKILL.md](skills/oci-mcp-ops/SKILL.md) | MCP `oci-kidepik` y aprovisionamiento OCI. |

Convenciones del repo (`README.md`, dependencias, CI) viven fuera de `.cursor/`; este fichero centra la navegación **dentro** de `.cursor/`.
