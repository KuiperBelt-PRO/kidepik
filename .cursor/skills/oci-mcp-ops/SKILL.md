# Operaciones Oracle Cloud vía MCP (kidepik)

Usar cuando el usuario pida aprovisionar, validar o operar infraestructura **Oracle Always Free** para KidepiK, o cuando mencione OCI CLI, MCP Oracle, VM ARM, o validación de hosting.

## Antes de actuar

1. Leer [SPEC_OCI_INFRA_ALWAYS_FREE.md](../../specify/SPEC_OCI_INFRA_ALWAYS_FREE.md) y [SPEC_OCI_MCP_SERVER.md](../../specify/SPEC_OCI_MCP_SERVER.md).
2. Comprobar que existen `kidepik/.secrets/oci.env` y `oracle_private.pem` (no leer ni volcar el `.pem` en chat).
3. Si faltan `OCI_USER_OCID` o `OCI_FINGERPRINT`, guiar al usuario con [OCI_ALWAYS_FREE_VALIDATION.md](../../operations/OCI_ALWAYS_FREE_VALIDATION.md) § Prerrequisitos — **no** lanzar create hasta auth OK.

## MCP

- Servidor: `oci-kidepik` en `kidepik/.cursor/mcp.json`.
- Venv: `kidepik/.cursor/.venv-mcp`.
- Preferir **tools MCP** frente a invocar `oci` CLI en shell, salvo depuración.

## Flujo validación Always Free

1. `oci_status` — debe devolver `ok: true`.
2. `oci_network_ensure` — VCN `kidepik-vcn`.
3. `oci_launch_arm_instance` o `oci_retry_launch_arm` si Out of capacity.
4. `oci_instance_get` — IP y estado.
5. Documentar en `operations/OCI_ALWAYS_FREE_VALIDATION.md` § Resultado.

## Reglas

- **No** commitear `.secrets/`; plantillas en `.secrets.sample/` sí se versionan.
- **No** terminar instancias ni volúmenes sin confirmación explícita del usuario.
- Región fija: `eu-madrid-1` (home MAD).
- Shape MVP: `VM.Standard.A1.Flex` 1 OCPU, 6 GB RAM, display name `kidepik-mvp`.
- Tras cambios de infra, actualizar spec/operations si el comportamiento real difiere.

## Referencias

- Producto: [docs/kidepik.md](../../../docs/kidepik.md) §10
- Operativa: [../../operations/OCI_ALWAYS_FREE_VALIDATION.md](../../operations/OCI_ALWAYS_FREE_VALIDATION.md)
