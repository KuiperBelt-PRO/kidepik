# Current Specs

## Bootstrap del repositorio

- Estructura `.cursor/` alineada con el resto del workspace KuiperbeltPRO (2026-06).
- Spec de arranque: [specify/REPO_BOOTSTRAP_SPEC.md](specify/REPO_BOOTSTRAP_SPEC.md).

## Producto

- Visión y stack: [docs/kidepik.md](../docs/kidepik.md) (documento maestro).

## Infraestructura Oracle Cloud (en curso)

Validación Always Free + MCP para agentes. **Estado: MCP implementado; venv con uv; smoke test OCI OK; launch ARM pendiente (`OUT_OF_CAPACITY` en MAD).**

**Plan B hosting (0 €):** [docs/kidepik.md](../docs/kidepik.md) §10.5.1 — Oracle AMD Micro, GCP Cloud Run + Neon/Supabase, local Docker; detalle operativo en [operations/OCI_ALWAYS_FREE_VALIDATION.md](operations/OCI_ALWAYS_FREE_VALIDATION.md) § Plan B.

| Spec | Descripción |
| --- | --- |
| [specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](specify/SPEC_OCI_INFRA_ALWAYS_FREE.md) | Criterios validación VM ARM 1 OCPU/6 GB en `eu-madrid-1` |
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
