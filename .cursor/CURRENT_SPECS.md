# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **POC local arquitectura (validada jun 2026):** [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](specify/SPEC_POC_LOCAL_ARCHITECTURE.md) — FastAPI + Supabase local + MinIO (R2) + cliente `web/`.
- **Pivot frontend web-first (implementado jun 2026):** [specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md](specify/SPEC_WEB_FRONTEND_ARCHITECTURE.md) — `web/` HTML/CSS/JS, puerto **8082**.
- **Sistema visual v3 web premium:** [specify/SPEC_APP_VISUAL_DESIGN_V3.md](specify/SPEC_APP_VISUAL_DESIGN_V3.md)
- **Preview dev móvil:** [specify/SPEC_WEB_DEV_PREVIEW.md](specify/SPEC_WEB_DEV_PREVIEW.md) — Electron 390×844 + Playwright.
- **Capacitor shell (fase posterior):** [specify/SPEC_CAPACITOR_MOBILE_SHELL.md](specify/SPEC_CAPACITOR_MOBILE_SHELL.md).
- **Plan de ejecución pivot:** [tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md](tasks/WEB_FRONTEND_PIVOT_EXECUTION_PLAN.md).

## Infraestructura Oracle Cloud (en curso)

Validar VM ARM Oracle + operar MCP. **MVP hosting:** [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) (Supabase + R2 + Cloud Run / Oracle Micro).

**Estado OCI:** MCP OK; launch ARM `OUT_OF_CAPACITY` en MAD. **Estado MVP:** stack free-tier documentado; compute backend TBD.

| Spec | Descripción |
| --- | --- |
| [specify/SPEC_HOSTING_FREE_TIER_STACK.md](specify/SPEC_HOSTING_FREE_TIER_STACK.md) | **MVP activo:** Supabase, R2, FastAPI, Cloud Run u Oracle Micro |
| [specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](specify/SPEC_OCI_INFRA_ALWAYS_FREE.md) | North star: VM ARM 1 OCPU/6 GB en `eu-madrid-1` |
| [specify/SPEC_OCI_MCP_SERVER.md](specify/SPEC_OCI_MCP_SERVER.md) | Servidor MCP FastMCP + OCI SDK (`oci-kidepik`) |

| Operativa / skill | Uso |
| --- | --- |
| [operations/OCI_ALWAYS_FREE_VALIDATION.md](operations/OCI_ALWAYS_FREE_VALIDATION.md) | Checklist prerrequisitos, smoke test, resultado |
| [skills/oci-mcp-ops/SKILL.md](skills/oci-mcp-ops/SKILL.md) | Flujo agente para aprovisionar/validar OCI |

**Secretos locales (no versionados):** `kidepik/.secrets/` — plantillas en `kidepik/.secrets.sample/`.

**Auth OCI:** `oci.env` + `oci.config` en `.secrets/`.

**Pendiente:** par SSH en `.secrets/ssh/kidepik_oci`.

---

Añadir filas a este índice cuando una feature tenga spec en `.cursor/specify/`.
