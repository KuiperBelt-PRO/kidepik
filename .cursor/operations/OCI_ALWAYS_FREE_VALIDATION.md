# Operativa: validación Oracle Always Free (KidepiK)

> Spec: [../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md](../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md)  
> MCP: [../specify/SPEC_OCI_MCP_SERVER.md](../specify/SPEC_OCI_MCP_SERVER.md)

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

## Fase 3 — Red + VM (agente o CLI)

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

## Fase 4 — Validación SSH

```powershell
ssh -i $env:USERPROFILE\.ssh\kidepik_oci ubuntu@<IP_PUBLICA> "uname -m; free -h; df -h"
```

Esperado: `aarch64`, ~6 Gi memoria.

---

## Resultado (rellenar tras validación)

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
| Notas | Red creada OK. Launch ARM falló `OUT_OF_CAPACITY`. Reintentar con `oci_retry_launch_arm` o `provision_arm.py` en bucle. |

---

## Plan B — Sin stock ARM

1. Crear AMD Micro (`VM.Standard.E2.1.Micro`) para script de reintento.
2. O temporalmente: API en Oracle AMD + Postgres Supabase (ver `docs/kidepik.md` §10.5).

## Seguridad

- No commitear `.secrets/`.
- Rotar API key si se expone.
- Restringir SSH a tu IP en security list cuando tengas IP fija.
