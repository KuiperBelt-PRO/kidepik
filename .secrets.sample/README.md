# Plantillas de secretos (versionadas)

Los ficheros **reales** viven en `kidepik/.secrets/` (gitignored). Esta carpeta documenta la forma y permite recrear el entorno en otra máquina.

## Bootstrap rápido (Google OAuth / GCP)

```powershell
cd kidepik
New-Item -ItemType Directory -Force -Path .secrets | Out-Null
# Copiar plantillas GCP según operations/GOOGLE_OAUTH_LOCAL_SETUP.md
Copy-Item .secrets.sample\gcp-oauth.env.sample .secrets\gcp-oauth.env
# Colocar gcp-oauth-client.json desde consola GCP (no versionar)
```

## Ficheros

| Plantilla (aquí) | Destino (`.secrets/`) |
| --- | --- |
| `gcp.env.sample` | `gcp.env` (si aplica) |
| `gcp-oauth.env.sample` | `gcp-oauth.env` |
| `openrouter.env.sample` | `openrouter.env` (IA local; clave distinta en prod) |
| (manual) `gcp-oauth-client.json` | JSON OAuth desde consola GCP — **no** versionar |

Para desarrollo local, las variables de OpenRouter también pueden inyectarse en `.env.poc` (gitignored) leyendo desde `.secrets/openrouter.env`. Ver [SPEC_AI_OPENROUTER_GATEWAY.md](../.cursor/specify/SPEC_AI_OPENROUTER_GATEWAY.md).

**Fuera de alcance:** Oracle OCI, Cloudflare R2 y Cloud Run como hosting de producto. Stack canónico: DreamHost PHP + Supabase + `web/media/`.
