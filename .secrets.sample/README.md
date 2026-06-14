# Plantillas de secretos (versionadas)

Los ficheros **reales** viven en `kidepik/.secrets/` (gitignored). Esta carpeta documenta la forma y permite recrear el entorno en otra máquina.

## Bootstrap rápido

```powershell
cd kidepik

# 1. Copiar plantillas
New-Item -ItemType Directory -Force -Path .secrets\ssh | Out-Null
Copy-Item .secrets.sample\oci.env.sample .secrets\oci.env
Copy-Item .secrets.sample\oci.config.sample .secrets\oci.config

# 2. Rellenar OCIDs, fingerprint y rutas en .secrets\oci.env y .secrets\oci.config
# 3. Colocar oracle_private.pem en .secrets\ (desde consola OCI → API Keys)
# 4. Generar SSH (ver ssh/README.md)
# 5. Opcional: script .cursor/mcp-oci/scripts/bootstrap_secrets.ps1
```

## Ficheros

| Plantilla (aquí) | Destino (`.secrets/`) |
| --- | --- |
| `oci.env.sample` | `oci.env` |
| `oci.config.sample` | `oci.config` |
| `ssh/README.md` | `ssh/kidepik_oci` + `kidepik_oci.pub` |

## ¿Y `~/.oci` o `~/.ssh`?

No son obligatorios. El MCP y los scripts del repo leen **solo** `kidepik/.secrets/`. Si quieres usar `oci` CLI a mano fuera del repo, puedes crear un enlace simbólico opcional:

```powershell
# Opcional — comodidad para oci CLI global
oci --config-file .secrets\oci.config iam region list
```

No hace falta copiar nada a `$HOME` salvo preferencia personal.
