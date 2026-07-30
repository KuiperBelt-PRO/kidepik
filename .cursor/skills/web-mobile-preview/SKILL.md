---
name: web-mobile-preview
description: >-
  Arranca y valida el cliente web KidepiK (HTML/CSS/JS) en localhost:8082 con
  viewport movil 390x844, Electron preview y MCP Playwright. Activar para
  cambios en web/, scripts poc-web-* o tools/preview-electron.
---

# Preview web móvil — KidepiK

## Cuándo usar

- Cambios en `web/` (UI, temas, escenas, SW).
- Validación agente o humana del cliente producto.

## Arranque (canónico)

```powershell
cd kidepik
./scripts/poc-up.ps1              # Docker nginx + PHP + web → :8082
./scripts/poc-web-preview.ps1     # Electron 390×844 (usa :8082 si ya está arriba)
```

**Arranque canónico:** `./scripts/poc-up.ps1`.  
**Opcional estático (sin API):** `./scripts/poc-web-preview.ps1 -Static` (`pnpm exec serve` en `web/`).

## Playwright (agente)

- URL: `http://localhost:8082`
- Viewport: **390 × 844**
- Capturas: `tmp/playwright-output/`
- Flujos mínimos: loader → tap → auth → legal (términos/privacidad) → volver; `#/auth` ≡ loader

### Auth local (rutas autenticadas sin Google)

El producto usa Google OAuth; en **local** los tests usan email/contraseña contra GoTrue (`SPEC_DEV_LOCAL_AUTH_PLAYWRIGHT.md`).

**Antes de probar `#/crew`, `#/settings`, etc.:**

```powershell
cd kidepik
./scripts/poc-up.ps1
./scripts/e2e-auth-setup.ps1    # genera web/e2e/.auth/tutor.json
```

**MCP Playwright — opción A (recomendada):** ejecutar setup y reutilizar sesión con `browser_run_code_unsafe`:

```javascript
async (page) => {
  const { authenticatePlaywrightPage } = await import(
    "file:///C:/Users/eduse/OneDrive/Escritorio/work/dev/kidepik/web/e2e/helpers/local-auth.js"
  );
  await authenticatePlaywrightPage(page, { targetRoute: "crew" });
  return page.url();
}
```

(Ajustar ruta `file://` al workspace si difiere.)

**Opción B — snippet inline** (sin importar módulo):

```javascript
async (page) => {
  const email = "playwright-tutor@kidepik.local";
  const password = "playwright-local-dev";
  const supabaseUrl = "http://localhost:54321";
  const anonKey = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
  const base = "http://localhost:8082";

  let res = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    data: { email, password },
  });
  if (!res.ok()) {
    await page.request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      data: { email, password, data: { full_name: "Tutor Playwright" } },
    });
    res = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      data: { email, password },
    });
  }
  const session = await res.json();
  await page.goto(base);
  await page.evaluate(
    async ({ supabaseUrl, anonKey, access_token, refresh_token }) => {
      const { createClient } = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );
      const client = createClient(supabaseUrl, anonKey);
      const { error } = await client.auth.setSession({ access_token, refresh_token });
      if (error) throw new Error(error.message);
    },
    {
      supabaseUrl,
      anonKey,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  );
  await page.request.post(`${base}/api/v1/parents/bootstrap`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  await page.goto(`${base}/#/crew`);
  return page.url();
}
```

Credenciales override: `E2E_TUTOR_EMAIL`, `E2E_TUTOR_PASSWORD` en entorno.

## Stack

- Sin React/Vite — ES modules servidos por **Docker nginx** (`poc-up.ps1`)
- Config: `web/js/config.js` (generado por `poc-write-config` / `poc-up`)
- Query params de depuración del loader: ver JSDoc de `parseWorldLayerQuery` en `web/js/components/loader-world-utils.js`
