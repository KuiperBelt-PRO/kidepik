# Operativa: GCP Cloud Run + MCP (KidepiK)

> **Decisión compute MVP:** Cloud Run (proyecto `kidepik`, región `europe-west1`)  
> Spec: [../specify/SPEC_HOSTING_FREE_TIER_STACK.md](../specify/SPEC_HOSTING_FREE_TIER_STACK.md)  
> MCP: `gcp-cloudrun-kidepik` en [../mcp.json](../mcp.json)

## Resumen del stack

| Capa | Servicio |
| --- | --- |
| DB + Auth | Supabase (`mohmbwlbozvnespnofuu`) |
| Media | Cloudflare R2 |
| **API** | **Cloud Run** (`kidepik-api`, pendiente despliegue) |

---

## Fase 1 — Facturación (obligatorio, no implica cargos)

GCP exige cuenta de facturación para Cloud Run aunque uses free tier.

1. [Vincular facturación al proyecto kidepik](https://console.cloud.google.com/billing/linkedaccount?project=kidepik)
2. Acepta que **solo pagarás** si superas las cuotas free (con los candados de abajo, el MVP debería quedarse en 0 €).

### Alerta de presupuesto (hazlo justo después)

1. [Crear presupuesto](https://console.cloud.google.com/billing/budgets/create?project=kidepik)
2. Configuración recomendada:

| Campo | Valor |
| --- | --- |
| Nombre | `kidepik-mvp-alert` |
| Proyectos | Solo **kidepik** |
| Importe | **0,01 €** (o 1 € si no deja tan bajo) |
| Umbrales | **50 %, 90 %, 100 %** |
| Notificación | Email `edusernalonso@gmail.com` |

3. Opcional: [quotas Cloud Run](https://console.cloud.google.com/iam-admin/quotas?project=kidepik) — revisar límites.

---

## Fase 2 — APIs (consola, sin gcloud)

Habilita cada API (botón **Habilitar**):

| API | Enlace directo |
| --- | --- |
| Cloud Run Admin API | [run.googleapis.com](https://console.cloud.google.com/apis/library/run.googleapis.com?project=kidepik) |
| Artifact Registry API | [artifactregistry.googleapis.com](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com?project=kidepik) |
| Cloud Build API | [cloudbuild.googleapis.com](https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com?project=kidepik) |

---

## Fase 3 — IAM (ya hecho)

| Principal | Roles |
| --- | --- |
| `edusernalonso@gmail.com` | Propietario + **Usuario de la herramienta de MCP** |

[Ver IAM](https://console.cloud.google.com/iam-admin/iam?project=kidepik)

---

## Fase 4 — OAuth client para Cursor MCP

**No uses «Aplicación web»** — Google rechaza `cursor://anysphere.cursor-mcp/oauth/callback` (no es un dominio `.com`).

Usa **Aplicación de escritorio** (app local = Cursor en tu PC). Documentación: [Authenticate to Google MCP](https://docs.cloud.google.com/mcp/authenticate-mcp).

1. [Crear cliente OAuth](https://console.cloud.google.com/auth/clients/create?project=kidepik)
2. Tipo: **Aplicación de escritorio** (Desktop app)
3. Nombre: `cursor-mcp-kidepik`
4. **No hace falta** URI de redirección (el tipo Desktop no la pide)
5. Crear → copiar **ID de cliente** y **Secreto de cliente**

`mcp-remote` usa callback local `http://localhost:8787/oauth/callback` (puerto `8787` en `mcp.json`).

Si en el futuro Google te deja añadir URIs al cliente Desktop, usa:

```
http://localhost:8787/oauth/callback
```

---

## Fase 5 — Conectar MCP en Cursor

`mcp.json` ya incluye:

```json
"gcp-cloudrun-kidepik": {
  "command": "pnpm",
  "args": [
    "dlx", "mcp-remote@latest",
    "https://run.googleapis.com/mcp",
    "8787",
    "--header", "x-goog-user-project:kidepik"
  ]
}
```

**Importante:** cierra ventanas extra de Cursor durante el primer OAuth (solo una ventana, para que el puerto `8787` no quede ocupado).

Pasos:

1. `Ctrl+Shift+P` → **Developer: Reload Window**
2. **Settings → Tools & MCP** → `gcp-cloudrun-kidepik`
3. Si pide credenciales → pegar Client ID y Client secret (Fase 4)
4. Login Google con `edusernalonso@gmail.com` → autorizar
5. Servidor en **verde**

Verificación: pedir al agente *«Lista servicios Cloud Run en europe-west1»*.

---

## Fase 6 — Variables locales (opcional)

```powershell
cd kidepik
Copy-Item .secrets.sample\gcp.env.sample .secrets\gcp.env
[System.Environment]::SetEnvironmentVariable("GCP_PROJECT_ID", "kidepik", "User")
[System.Environment]::SetEnvironmentVariable("GCP_REGION", "europe-west1", "User")
```

Reiniciar Cursor tras variables de entorno de usuario.

---

## Candados coste 0 al desplegar (cuando exista Dockerfile)

| Parámetro | Valor |
| --- | --- |
| Región | `europe-west1` |
| `min-instances` | `0` |
| `max-instances` | `1` (máx. `2`) |
| `concurrency` | `80` |
| Memoria | `1Gi`–`2Gi` |
| CPU | `1` |
| Ingress | Solo tráfico autenticado o público según necesidad |
| **Egress** | API devuelve **URLs R2**, no binarios |

Regla KidepiK: FastAPI **no** proxy de imágenes → protege el free tier egress GCP (~1 GB/mes).

---

## Resultado validación

| Campo | Valor |
| --- | --- |
| Fecha | — |
| GCP Project ID | `kidepik` |
| Principal | `edusernalonso@gmail.com` |
| Billing vinculado | — |
| Presupuesto alerta | — |
| APIs habilitadas | — |
| IAM MCP Tool User | ✅ |
| OAuth client Cursor | — |
| MCP conectado | — |
| Región | `europe-west1` |
| Servicios Cloud Run | — (vacío hasta primer deploy) |

---

## Troubleshooting

| Síntoma | Acción |
| --- | --- |
| API pide billing | Completar Fase 1 |
| Streamable HTTP / SSE | `mcp-remote` ya configurado; Reload Window |
| 403 MCP | `roles/mcp.toolUser` + APIs Fase 2 |
| OAuth no aparece | Settings → MCP → borrar credenciales cacheadas y reconectar |
| Proyecto equivocado | Header `x-goog-user-project:kidepik` en mcp.json |

## Referencias

- [Cloud Run MCP](https://cloud.google.com/run/docs/reference/mcp)
- [Configurar MCP en Cursor (Google)](https://cloud.google.com/run/docs/tutorials/deploy-remote-mcp-server) — redirect URI Cursor
