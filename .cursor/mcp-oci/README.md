# MCP Oracle Cloud (oci-kidepik)

Servidor MCP stdio para operaciones OCI en el proyecto KidepiK.

## Estado

- **Specs:** [../specify/SPEC_OCI_MCP_SERVER.md](../specify/SPEC_OCI_MCP_SERVER.md), [../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md)
- **Implementación:** pendiente (tras aprobación de specs)

## Secretos

Copiar plantillas desde [`.secrets.sample/`](../../.secrets.sample/README.md) → `kidepik/.secrets/`.

## Arranque local

```powershell
py .cursor\mcp-oci\scripts\bootstrap_venv.py
```

Usa **uv** (`py -3 -m uv`), no pip. Ver script para detalle.

## Cursor

Ver `kidepik/.cursor/mcp.json` (entrada `oci-kidepik`).
