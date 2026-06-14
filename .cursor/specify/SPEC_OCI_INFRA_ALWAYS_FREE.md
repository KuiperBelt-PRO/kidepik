# Spec: Validación Oracle Cloud Always Free (KidepiK producción)

> Estado: **borrador para aprobación** · Relacionado: [docs/kidepik.md](../../docs/kidepik.md) §10.4–10.5  
> Depende de: [SPEC_OCI_MCP_SERVER.md](SPEC_OCI_MCP_SERVER.md)

## Objetivo

Validar que la cuenta **eduserna** (home region **MAD** / `eu-madrid-1`) puede aprovisionar la VM **ARM** Always Free prevista como **north star** de hosting monolítico.

El **MVP de producción** (junio 2026) sigue el [SPEC_HOSTING_FREE_TIER_STACK.md](SPEC_HOSTING_FREE_TIER_STACK.md): Supabase + R2 + FastAPI en Cloud Run u Oracle Micro. Esta spec OCI sigue siendo necesaria para el objetivo ARM y para Oracle Micro como compute alternativo.

## Alcance MVP de la validación

| Incluido | Excluido (fase posterior) |
| --- | --- |
| Smoke test credenciales OCI | Despliegue Docker Compose completo (API + Postgres) |
| VCN + subnet pública + security lists | Traefik + Let's Encrypt |
| Instancia `VM.Standard.A1.Flex` 1 OCPU / 6 GB | Terraform/Ansible productivo |
| SSH + comprobación `aarch64` | Backups automatizados Postgres |
| Script reintento «Out of capacity» | Dominio DNS producción |

## Entrada

- Cuenta Oracle Cloud Free Tier activa.
- Tenancy OCID y API key en `kidepik/.secrets/` (ver `oci.env`, `oracle_private.pem`).
- User OCID + fingerprint API (pendiente si no están en `oci.env`).
- Par SSH Ed25519 para acceso (`kidepik_oci` / `kidepik_oci.pub`).

## Salida (criterios de éxito)

1. **`oci_status` OK** — región `eu-madrid-1`, usuario autenticado.
2. **Red `kidepik-vcn`** — IGW, ruta `0.0.0.0/0`, subnet pública, puertos **22**, **80**, **443** abiertos (SSH restringible a IP del desarrollador).
3. **Instancia `kidepik-mvp`** — shape `VM.Standard.A1.Flex`, `{"ocpus":1,"memoryInGBs":6}`, imagen Ubuntu 24.04 ARM.
4. **IP pública** asignada y **SSH** funcional como usuario `ubuntu`.
5. **Informe** en `.cursor/operations/OCI_ALWAYS_FREE_VALIDATION.md` (sección «Resultado») con OCIDs, IP, AD usado y fecha.

## Comportamiento

### F1 — Preparación local

- Instalar dependencias MCP con **uv** (`bootstrap_venv.py`), no pip directo.
- Generar clave SSH en `.secrets/ssh/` si no existe (ver `.secrets.sample/ssh/README.md`).
- Validar `oci.config` en `.secrets/` (no depender de `~/.oci/config`).

### F2 — Red (idempotente)

- Si no existe VCN `kidepik-vcn`, crearla con CIDR `10.0.0.0/16`.
- Subnet pública `10.0.1.0/24`, `map-public-ip-on-launch=true`.
- Security list ingress: TCP 22, 80, 443 desde `0.0.0.0/0` (MVP); egress amplio.
- Etiquetas: `project=kidepik`, `env=validation`.

### F3 — Lanzamiento ARM

- Probar availability domains en orden hasta éxito o agotar reintentos configurables.
- Boot volume: **50 GB** (dentro de bolsa Always Free 200 GB).
- `--ssh-authorized-keys-file` apunta a clave pública local.

### F4 — Validación post-launch

- Esperar estado `RUNNING`.
- `ssh -i <privada> ubuntu@<ip> 'uname -m && free -h'`.
- Esperado: `aarch64`, ~6 GiB RAM visible.

### F5 — Reintento «Out of capacity»

- ARM: `.cursor/mcp-oci/scripts/retry_provision_loop.py --profile arm`
- Micro (backend): `provision_micro.py` o `retry_provision_loop.py --profile micro`
- Supervisor opcional: `retry_provision_supervisor.ps1 -Profile arm|micro`

## Errores

| Error | Acción |
| --- | --- |
| `NotAuthenticated` / 401 | Revisar fingerprint, User OCID, clave `.pem` |
| `Out of capacity` | Otro AD; script reintento; otra región EU no viable (home fija MAD) |
| `LimitExceeded` | Revisar instancias existentes en consola |
| SSH timeout | Security list / `ufw` en instancia; comprobar IP pública |

## Edge cases

- Home region **inmutable** — solo recursos Always Free en `eu-madrid-1`.
- Compartment root = tenancy OCID en cuentas personales pequeñas.
- Imagen ARM debe ser **Always Free-eligible** (Ubuntu 24.04 Minimal aarch64).
- No commitear secretos; solo plantillas en `.cursor/mcp-oci/oci.env.sample`.

## Parámetros acordados (KidepiK)

| Parámetro | Valor |
| --- | --- |
| Display name VM ARM | `kidepik-mvp` |
| Display name VM Micro (backend) | `kidepik-api-micro` |
| Shape ARM | `VM.Standard.A1.Flex` |
| Shape Micro | `VM.Standard.E2.1.Micro` |
| OCPU / RAM | 1 / 6 GB |
| Región | `eu-madrid-1` |
| VCN CIDR | `10.0.0.0/16` |
| Subnet | `10.0.1.0/24` |

## Trazabilidad

- Producto: [docs/kidepik.md](../../docs/kidepik.md)
- MCP: [SPEC_OCI_MCP_SERVER.md](SPEC_OCI_MCP_SERVER.md)
- Operativa: [../operations/OCI_ALWAYS_FREE_VALIDATION.md](../operations/OCI_ALWAYS_FREE_VALIDATION.md)
