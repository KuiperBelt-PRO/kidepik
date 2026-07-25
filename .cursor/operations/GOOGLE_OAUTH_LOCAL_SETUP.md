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
| Correo de Google tras cada login | Ver § [Correos de Google y re-login](#correos-de-google-y-re-login) |

## Correos de Google y re-login

Google envía un correo del tipo **«Has compartido algunos datos de tu cuenta de Google con …»** cuando completas un flujo de **Iniciar sesión con Google** y la app recibe tu perfil básico (nombre, email, foto). Es una **notificación de privacidad de Google**, no un error de KidepiK ni de Supabase.

### Comportamiento esperado en KidepiK

| Situación | ¿Pasa por Google? | ¿Correo de Google? |
| --- | --- | --- |
| Recarga o nueva visita **con sesión Supabase válida** | No — el loader detecta sesión y va a `#/home` | No |
| **Cerrar sesión (temporal)** en home → loader → **Continuar con Google** | Sí — OAuth completo | **Sí** (esperado) |
| Primera vez que autorizas la app | Sí | Sí |

El botón **«Cerrar sesión (temporal)»** (`web/js/scenes/home.js`) llama a `signOut()` y borra la sesión de Supabase en el navegador. El siguiente acceso **debe** volver a autenticarse con Google; no hay forma de evitar el correo en ese flujo sin dejar de usar Sign in with Google.

> **Nota:** no implica que Google muestre la pantalla de consentimiento cada vez. A menudo solo aparece el selector de cuenta; aun así Google puede enviar el resumen de datos compartidos.

### Qué hace el cliente (no fuerza re-consentimiento)

- `web/js/lib/supabase.js`: `signInWithOAuth` **sin** `prompt: 'consent'`; sesión persistida (`persistSession: true`, PKCE).
- `web/js/components/loader-gate.js`: si `getValidSession()` devuelve sesión, salta el CTA Google y navega a `#/home`.

### Otras causas de re-login (y correo) en desarrollo

| Causa | Efecto |
| --- | --- |
| `./scripts/poc-up.ps1` | Ejecuta `supabase db reset --local` y borra `auth.users` / refresh tokens → hay que volver a Google |
| `localhost:8082` vs `127.0.0.1:8082` | Orígenes distintos → `localStorage` distinto → sesión no compartida |
| Incógnito o borrar datos del sitio | Sesión perdida |
| Playwright / contexto de navegador nuevo | Sin sesión previa |

### Nombre «KidepiK Cursor MCP» en el correo

El **OAuth client** de Google Cloud puede llamarse así si se creó para herramientas MCP (p. ej. `gcp-cloudrun-kidepik` en `.cursor/mcp.json`). El mismo Client ID alimenta Supabase Auth en local. Es cosmético en el correo; opcionalmente renombrar la app en [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent) o usar credenciales separadas para web vs MCP.

### Modo Testing en Google Cloud

Con el consent screen en **Testing** y scopes básicos (`openid`, `email`, `profile`), las autorizaciones **no** caducan a los 7 días (excepción documentada por Google para Sign in with Google). Publicar en **In production** reduce fricción en la UI de Google cuando vaya a prod; no elimina el correo tras un logout + login explícito.

### Referencias

- Spec producto: [SPEC_APP_AUTH.md](../specify/SPEC_APP_AUTH.md)
- Spec implementación: [SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md](../specify/SPEC_APP_AUTH_GOOGLE_IMPLEMENTATION.md) — matriz Playwright flujo 4 (cerrar sesión → loader)
