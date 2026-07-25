# Google OAuth local (KidepiK + Supabase)

Configuración de **«Continuar con Google»** en desarrollo local. Secretos en `kidepik/.secrets/` (gitignored).

## 1. Google Cloud Console

Proyecto recomendado: `kidepik` (o el que uses en GCP).

1. [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) — modo **Testing**; añade tu email como test user.
2. [Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials** → **OAuth client ID** → **Web application**.
3. Configura:

| Campo | Valor |
| --- | --- |
| Authorized JavaScript origins | `http://localhost:8082` |
| Authorized redirect URIs | `http://127.0.0.1:54321/auth/v1/callback` (obligatorio: Supabase CLI usa 127.0.0.1, no localhost) |

Opcional (por si cambia el bind): añade también `http://localhost:54321/auth/v1/callback`.

4. Descarga el JSON del cliente o copia **Client ID** y **Client secret**.

## 2. Secretos en el repo (local)

**Opción A — JSON (recomendada)**

```powershell
cd kidepik
# Guarda el JSON descargado como:
# .secrets/gcp-oauth-client.json
./scripts/sync-google-oauth-env.ps1
```

**Opción B — variables**

```powershell
Copy-Item .secrets.sample/gcp-oauth.env.sample .secrets/gcp-oauth.env
# Edita GCP_OAUTH_CLIENT_ID y GCP_OAUTH_CLIENT_SECRET
./scripts/sync-google-oauth-env.ps1
```

El script genera `supabase/.env` con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (leídos por `supabase/config.toml`).

## 3. Arranque

```powershell
./scripts/setup-google-oauth.ps1   # bootstrap + sync + supabase stop/start
# o
./scripts/poc-up.ps1               # sync (si hay secretos) + stack completo
```

## 4. Verificación

1. Abre `http://localhost:8082` (viewport móvil 390×844).
2. Loader → tap → **Continuar con Google**.
3. Tras login → `#/home` con tu email.
4. Comprueba fila en `parent_accounts` (opcional):

```sql
select * from public.parent_accounts;
```

## 5. Producción (DreamHost + Supabase cloud)

En el dashboard del proyecto Supabase (`Authentication → Providers → Google`):

- Mismo Client ID/Secret (o credencial prod con redirect `https://{ref}.supabase.co/auth/v1/callback`).
- **Site URL** y **Redirect URLs** con tu dominio DreamHost.

## Troubleshooting

| Síntoma | Causa habitual |
| --- | --- |
| `redirect_uri_mismatch` | Redirect en GCP debe ser **exactamente** `http://127.0.0.1:54321/auth/v1/callback` (no `localhost`, no puerto `8082`) |
| Provider disabled | Falta `supabase/.env` o no reiniciaste Supabase tras sync |
| Login OK pero sin fila padre | Revisa `POST /api/v1/parents/bootstrap` y logs PHP |
| App en 127.0.0.1 | Añade también `http://127.0.0.1:8082` en origins y redirect URLs de Supabase (`config.toml`) |
