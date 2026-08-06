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
| `openrouter.env.sample` | `openrouter.env` (IA PHP legado) |
| `gemini.env.sample` | `gemini.env` (IA FastAPI agentic; `GOOGLE_API_KEY`) |
| (manual) `gcp-oauth-client.json` | JSON OAuth desde consola GCP — **no** versionar |

Para desarrollo local, inyecta Gemini en `.env.poc` (gitignored) desde `.secrets/gemini.env`:

```powershell
Get-Content .secrets\gemini.env | ForEach-Object {
  if ($_ -match '^\s*GOOGLE_API_KEY\s*=') { $_ }
}
# o copia manualmente GOOGLE_API_KEY=... a .env.poc
```

Ver [SPEC_AI_GEMINI_GATEWAY.md](../.cursor/specify/SPEC_AI_GEMINI_GATEWAY.md).

**Fuera de alcance:** Oracle OCI, Cloudflare R2 y Cloud Run como hosting de producto. Stack canónico: DreamHost PHP + Supabase + `web/media/`.
