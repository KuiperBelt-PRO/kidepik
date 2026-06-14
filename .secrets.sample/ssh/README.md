# Claves SSH para VMs Oracle (KidepiK)

Generar en `kidepik/.secrets/ssh/` (no versionar):

```powershell
cd kidepik
New-Item -ItemType Directory -Force -Path .secrets\ssh | Out-Null
ssh-keygen -t ed25519 -f .secrets\ssh\kidepik_oci -N '""'
```

- **Privada:** `.secrets/ssh/kidepik_oci` — solo local, nunca en git.
- **Pública:** `.secrets/ssh/kidepik_oci.pub` — se pasa a OCI al crear la instancia.

Referencia en `oci.env`: `OCI_SSH_PUBLIC_KEY_FILE` / `OCI_SSH_PRIVATE_KEY_FILE`.
