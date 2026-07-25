# Operativa: validación Oracle Always Free (KidepiK)

> Spec ARM: [../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md)  
> Spec MVP hosting: [../specify/SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md)  
> MCP: [../specify/SPEC_OCI_MCP_SERVER.md](../specify/SPEC_OCI_MCP_SERVER.md)

## Contexto (actualizado jul 2026)

- **MVP producción activo:** DreamHost PHP + Supabase (DB + Auth) + media local (`web/media/`). Ver [SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md). **No** R2 ni FastAPI en MVP.
- **North star OCI:** monolito ARM 6 GB cuando haya stock (`OUT_OF_CAPACITY` en MAD). Oracle Micro = opción de compute futura, no backend FastAPI obligatorio.
## Prerrequisitos (usuario)

- [x] Cuenta Oracle Cloud, home region **MAD** (`eu-madrid-1`)
- [x] Tenancy OCID en `kidepik/.secrets/oci.env`
- [x] API private key en `kidepik/.secrets/oracle_private.pem`
- [x] `oci.env` + `oci.config` en `kidepik/.secrets/`
- [ ] Par SSH en `kidepik/.secrets/ssh/kidepik_oci` (ver `.secrets.sample/ssh/README.md`)

### Obtener User OCID y fingerprint

1. [cloud.oracle.com](https://cloud.oracle.com) → perfil → **User settings**.
2. Copiar **OCID** → `OCI_USER_OCID` en `oci.env`.
3. **API Keys** → clave usada → copiar **Fingerprint** → `OCI_FINGERPRINT`.

## Fase 1 — Entorno local

```powershell
cd kidepik
py .cursor\mcp-oci\scripts\bootstrap_venv.py
```

## Fase 2 — Registrar MCP en Cursor

1. Copiar/adaptar `kidepik/.cursor/mcp.json` (o fusionar en configuración del workspace).
2. Reiniciar MCP / Cursor.
3. Invocar tool `oci_status` desde el agente.

## Fase 3 — Red + VM ARM (objetivo largo plazo)

Orden recomendado vía MCP:

1. `oci_status`
2. `oci_network_ensure`
3. `oci_launch_arm_instance` — si falla capacidad → `oci_retry_launch_arm`
4. `oci_instance_get` — anotar IP pública
5. SSH manual o script post-provisión

Equivalente CLI (depuración):

```powershell
oci iam availability-domain list --compartment-id <TENANCY_OCID>
oci compute instance list --compartment-id <TENANCY_OCID>
```

## Fase 4 — Validación SSH (ARM)

```powershell
ssh -i $env:USERPROFILE\.ssh\kidepik_oci ubuntu@<IP_PUBLICA> "uname -m; free -h; df -h"
```

Esperado: `aarch64`, ~6 Gi memoria.

---

## Resultado ARM (rellenar tras validación)

| Campo | Valor |
| --- | --- |
| Fecha | 2026-06-14 |
| Región | `eu-madrid-1` |
| AD usado | `bzjm:EU-MADRID-1-AD-1` (único AD en MAD) |
| VCN OCID | `ocid1.vcn.oc1.eu-madrid-1.amaaaaaaznfgjeiap7vqitbmkzzgn5t6uasbfcrzpsy3u5hcyhju76xhdema` |
| Subnet OCID | `ocid1.subnet.oc1.eu-madrid-1.aaaaaaaaaerm5oxptcboyam6jmu2ckkydab2klgfxoqq6y34mt2weo5hnvzq` |
| Instancia OCID | — (pendiente: Out of host capacity) |
| IP pública | — |
| SSH OK | — |
| Notas | Red creada OK. Launch ARM falló `OUT_OF_CAPACITY`. Reintentar con scripts de bucle. |

---

## MVP — DreamHost PHP + Supabase (activo jul 2026)

Arquitectura fija del producto: **DreamHost PHP** + **Supabase** (Postgres + Auth) + **media local**. Ver [SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md).

### Evolución / alternativas (no MVP)

| Opción | Cuándo | Notas |
| --- | --- | --- |
| **Cloudflare R2** | Escala media | `STORAGE_DRIVER=s3` — SPEC_MEDIA_STORAGE |
| **GCP Cloud Run / Oracle Micro** | Si se retoma compute distinto de DreamHost | Histórico FastAPI; no extender `backend/` sin decisión nueva |
| **Oracle ARM monolito** | Stock Always Free | North star § Resultado |

**No usar en MVP:** Supabase Storage (egress), MinIO en Docker, FastAPI como API canónica.

### Checklist servicios

- [ ] Proyecto Supabase (EU): DB + Auth
- [ ] Dominio DreamHost + PHP deploy
- [ ] Media en `web/media/` (local y prod)
- [ ] (Futuro) Bucket R2 si se migra storage

Detalle: [SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md).

### GCP Cloud Run MCP

Ver [GCP_CLOUD_RUN_MCP.md](GCP_CLOUD_RUN_MCP.md) — OAuth client Cursor, `roles/mcp.toolUser`, APIs y `gcp-cloudrun-kidepik` en `mcp.json`.

### Oracle AMD Micro (compute opcional / futuro)

Shape `VM.Standard.E2.1.Micro`, display name `kidepik-api-micro`. Reutiliza la VCN/subnet ya creada. **No** implica desplegar FastAPI como MVP (producto = PHP en DreamHost).

**Un intento:**

```powershell
cd kidepik
$env:KIDEPIK_REPO = (Get-Location).Path
.cursor\.venv-mcp\Scripts\python.exe -u .cursor\mcp-oci\scripts\provision_micro.py
```

**Bucle con reintentos** (recomendado si hay `OUT_OF_CAPACITY`):

```powershell
cd kidepik
$env:KIDEPIK_REPO = (Get-Location).Path
.cursor\.venv-mcp\Scripts\python.exe -u .cursor\mcp-oci\scripts\retry_provision_loop.py --profile micro --max-hours 24 --attempts-per-minute 2
```

Supervisor Micro:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .cursor\mcp-oci\scripts\retry_provision_supervisor.ps1 -Profile micro -MaxHours 24
```

Validación SSH (esperado `x86_64`, ~1 GiB RAM):

```powershell
ssh -i $env:USERPROFILE\.ssh\kidepik_oci ubuntu@<IP_PUBLICA> "uname -m; free -h; df -h"
```

### Scripts reintento ARM (paralelo al MVP)

```powershell
cd kidepik
$env:KIDEPIK_REPO = (Get-Location).Path
.cursor\.venv-mcp\Scripts\python.exe -u .cursor\mcp-oci\scripts\retry_provision_loop.py --profile arm --max-hours 24 --attempts-per-minute 2
```

Supervisor:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .cursor\mcp-oci\scripts\retry_provision_supervisor.ps1 -Profile arm -MaxHours 24
```

Log ARM: `tmp/oci-provision/retry-provision-arm.log` (gitignored).  
Log Micro: `tmp/oci-provision/retry-provision-micro.log`.

## Seguridad

- No commitear `.secrets/` (OCI, Supabase, R2, GCP).
- Rotar API keys si se exponen.
- Restringir SSH a tu IP en security list cuando tengas IP fija (Oracle).
- URLs firmadas o políticas R2 para media privada de menores.
