# Spec: MCP Oracle Cloud (FastMCP + OCI SDK)

> Estado: **borrador para aprobación**  
> Implementación prevista: `kidepik/.cursor/mcp-oci/`

## Objetivo

Exponer operaciones OCI frecuentes para agentes Cursor mediante un servidor **MCP stdio** en Python ([FastMCP](https://gofastmcp.com/)), sin depender de la consola web. Usa el **SDK Python `oci`** (misma API que `oci` CLI); el CLI queda disponible en el venv para depuración manual.

## Entrada

- Variables en `kidepik/.secrets/oci.env` y `kidepik/.secrets/oci.config` (plantillas en `.secrets.sample/`).
- Venv: `kidepik/.cursor/.venv-mcp` — `py .cursor/mcp-oci/scripts/bootstrap_venv.py` (usa uv por dentro).

## Salida

- Proceso MCP registrado en `kidepik/.cursor/mcp.json`.
- Tools invocables desde Cursor con respuestas JSON resumidas (sin volcar secretos).

## Arquitectura

```
Cursor Agent
     │ stdio MCP
     ▼
┌─────────────────────────┐
│  mcp-oci/server.py      │  FastMCP
│  oci_client.py          │  SDK oci.*
│  env_loader.py          │  lee .secrets/oci.env
└───────────┬─────────────┘
            │ HTTPS API
            ▼
   Oracle Cloud (eu-madrid-1)
```

## Tools (contrato v1)

| Tool | Descripción | Idempotente |
| --- | --- | --- |
| `oci_status` | Región, tenancy, usuario; lista ADs | Sí |
| `oci_list_instances` | Instancias en compartment (filtro `kidepik`) | Sí |
| `oci_network_ensure` | Crea VCN/subnet/SG si no existen (spec infra) | Sí |
| `oci_launch_arm_instance` | Lanza `VM.Standard.A1.Flex` 1/6 GB | No* |
| `oci_retry_launch_arm` | Bucle reintento Out of capacity | No |
| `oci_instance_get` | Estado + IP pública por display name u OCID | Sí |
| `oci_run_cli` | Ejecuta subcomando `oci` read-only (escape hatch) | Depende |

\*Si ya existe instancia `kidepik-mvp` en RUNNING, devolver existente sin duplicar.

## Comportamiento

### Carga de credenciales (`env_loader.py`)

1. Leer `kidepik/.secrets/oci.env` y resolver rutas relativas al repo (`KIDEPIK_REPO` o detección por marcador `.secrets/oci.env`).
2. No sobrescribir variables ya definidas en el entorno del proceso MCP.
3. Cargar SDK con `oci.config.from_file(file_location=<repo>/.secrets/oci.config)` o config en memoria desde `oci.env`.
4. Si faltan `OCI_USER_OCID` o `OCI_FINGERPRINT`, `oci_status` devuelve error accionable (no stack trace crudo).

### Respuestas

- JSON con campos `ok`, `data`, `error` (mensaje corto).
- Nunca incluir contenido de `.pem` ni tokens en la respuesta.
- Truncar listas largas (máx. 20 ítems).

### Seguridad

- `oci_run_cli` solo permite comandos en allowlist: `iam region list`, `iam availability-domain list`, `compute instance list`, `network vcn list`, etc.
- Prohibido: `instance terminate`, `volume delete` sin flag explícito futuro `confirm_destroy=true` (fuera de v1).

## Errores

| Condición | Respuesta MCP |
| --- | --- |
| Fichero `oci.env` ausente | Instrucciones + ruta sample |
| SDK auth falla | Comprobar fingerprint y User OCID |
| Out of capacity | `error_code: OUT_OF_CAPACITY`, `ad` intentado |
| Rate limit OCI | Reintentar con backoff 5 s |

## Edge cases

- Windows: rutas `OCI_KEY_FILE` con backslashes; normalizar en loader.
- MCP arrancado desde workspace multi-root: resolver raíz `kidepik` por `KIDEPIK_REPO` o cwd.
- Múltiples perfiles OCI: solo `DEFAULT` en v1.

## Estructura de ficheros (implementación)

```
kidepik/.cursor/
  .venv-mcp/                 # gitignore
  mcp-oci/
    server.py
    oci_client.py
    env_loader.py
    requirements-mcp.txt
    oci.env.sample
    README.md
    scripts/
      smoke_test.py
      bootstrap_venv.py      # uv venv + pip install + smoke_test
  mcp.json                   # entrada servidor oci-kidepik
```

## Dependencias (`requirements-mcp.txt`)

```
fastmcp>=2.2.0,<3
oci>=2.150.0,<3
oci-cli>=3.51.0,<4
```

## Configuración Cursor (`mcp.json` ejemplo)

```json
{
  "mcpServers": {
    "oci-kidepik": {
      "command": "C:\\Users\\eduse\\OneDrive\\Escritorio\\work\\dev\\kidepik\\.cursor\\.venv-mcp\\Scripts\\python.exe",
      "args": [
        "C:\\Users\\eduse\\OneDrive\\Escritorio\\work\\dev\\kidepik\\.cursor\\mcp-oci\\server.py"
      ],
      "env": {
        "KIDEPIK_REPO": "C:\\Users\\eduse\\OneDrive\\Escritorio\\work\\dev\\kidepik"
      }
    }
  }
}
```

## Tests (fase implementación)

| Test | Verifica |
| --- | --- |
| `test_env_loader_missing_user` | Error claro sin User OCID |
| `test_oci_status_mock` | Formato respuesta |
| `scripts/smoke_test.py` | `oci_status` contra API real (manual/CI con secretos) |

## Referencias

- Patrón hub: `Vibe-Coding/.cursor/mcp-github-rest/`
- Infra: [SPEC_OCI_INFRA_ALWAYS_FREE.md](SPEC_OCI_INFRA_ALWAYS_FREE.md)
- Skill agente: [../skills/oci-mcp-ops/SKILL.md](../skills/oci-mcp-ops/SKILL.md)
