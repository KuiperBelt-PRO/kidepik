# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).
- **POC local arquitectura (validada jun 2026):** [specify/SPEC_POC_LOCAL_ARCHITECTURE.md](specify/SPEC_POC_LOCAL_ARCHITECTURE.md) — FastAPI + Supabase local + MinIO (R2) + Expo Go (SDK 54). Guía: [docs/POC_LOCAL.md](../docs/POC_LOCAL.md).
- **Sistema visual app móvil (aprobada jun 2026):** [specify/SPEC_APP_VISUAL_DESIGN.md](specify/SPEC_APP_VISUAL_DESIGN.md) — design system dual fantasy/space opera, loader y galería de mockups.
- **Expo Web local (jun 2026):** [specify/SPEC_EXPO_WEB_LOCAL_PREVIEW.md](specify/SPEC_EXPO_WEB_LOCAL_PREVIEW.md) — preview en `http://localhost:8081` para PC y agentes MCP.

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
