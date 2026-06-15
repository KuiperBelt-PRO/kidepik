# Spec: Arquitectura «Modern Free Tier Stack» (MVP producción)

> Estado: **aprobada para MVP** (junio 2026) · Relacionado: [docs/kidepik.md](../../docs/kidepik.md) §10.5–10.8  
> Contexto: stock ARM Oracle (`OUT_OF_CAPACITY` en `eu-madrid-1`) — no bloquear piloto.

## Decisión

Mientras no haya VM ARM Oracle disponible, el **MVP en producción** usa servicios gestionados a **coste 0** con esta composición fija:

| Capa | Servicio | Rol |
| --- | --- | --- |
| **Base de datos** | **Supabase** (Postgres + pgvector) | Datos relacionales, RAG, progreso |
| **Autenticación** | **Supabase Auth** | Login email / Google / Apple; JWT hacia FastAPI |
| **Almacenamiento** | **Cloudflare R2** | Avatares, audios, PDFs — **no** Supabase Storage |
| **Backend** | **FastAPI + LangGraph** en contenedor | Agentes IA, orquestación, validación JWT |
| **Compute backend** | **GCP Cloud Run** (`kidepik`, `europe-west1`) | Oracle AMD Micro como respaldo si hace falta |

**North Star** (sin cambiar): monolito Oracle ARM 1 OCPU / 6 GB con Postgres local en Docker cuando haya stock. El stack free-tier es **paralelo**, no sustituto definitivo del diseño §10.4 producción ARM.

## Backend: Cloud Run vs Oracle Micro (abierto)

| Criterio | GCP Cloud Run | Oracle `VM.Standard.E2.1.Micro` |
| --- | --- | --- |
| RAM asignable | Hasta 2 GB+ por contenedor (free tier por uso) | ~1 GB fijo |
| Región EU free | Sí (Cloud Run global; desplegar en EU) | Sí (`eu-madrid-1`) |
| Cold start | Sí (`min-instances=0`) | No (siempre encendida) |
| Sysadmin | Mínimo (solo contenedor) | SSH, Docker, firewall, SSL |
| Egress GCP | **Riesgo** si el API sirve binarios — ver §Egress | Tráfico desde MAD |

**Criterio de elección:** implementar el mismo `Dockerfile` FastAPI; desplegar primero donde haya disponibilidad (probable Cloud Run si Oracle micro también falla por stock). Documentar la opción elegida en `OCI_ALWAYS_FREE_VALIDATION.md` o runbook GCP.

## Neon vs Supabase (por qué Supabase para KidepiK)

| Característica | Neon | Supabase |
| --- | --- | --- |
| Producto | Postgres serverless puro | BaaS: DB + Auth + Storage + APIs auto |
| Escala a cero DB | Sí, rápido | Free: pausa tras ~7 días inactividad |
| Auth | No — programar en FastAPI | Sí (email, Google, Apple) |
| Storage | No | Sí (pero ver límites — **no usamos**) |
| Branching DB | Sí (Git-like) | No nativo en free |
| pgvector | Sí | Sí |

**Decisión:** **Supabase** para DB + Auth (menos código MVP). **Neon** queda como alternativa si Supabase free no cubre pgvector o límites de conexión.

## Cloudflare R2 (storage)

- S3-compatible (`boto3` en FastAPI con endpoint R2).
- Free tier (orientativo): **10 GB** almacenamiento, **10M** lecturas/mes, **1M** escrituras/mes, **egress ilimitado**.
- La BD guarda **URLs** a objetos R2, no blobs.

### Por qué no Supabase Storage

| | Supabase Storage (free) | Cloudflare R2 (free) |
| --- | --- | --- |
| Almacenamiento | 1 GB | 10 GB |
| Egress | **2 GB/mes** (cuello de botella B2C) | Ilimitado |
| Seguridad | Integrada con Auth (RLS) | URLs firmadas desde FastAPI |
| Uso en KidepiK | Descartado para media | **Elegido** |

Con ~200 KB por avatar, 2 GB egress ≈ 10k visualizaciones/mes — insuficiente para tracción modesta. R2 evita factura por viralidad de imágenes.

## Flujo de datos (egress a coste 0)

```
App Expo ──JWT──► FastAPI (Cloud Run u Oracle Micro)
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    Supabase      OpenRouter    R2 (put/get URL)
    Postgres      (IA)         solo desde app
         │
    JSON con URL pública o firmada de avatar — FastAPI NO proxy de imágenes
```

**Regla:** FastAPI **nunca** descarga de R2 para reenviar al móvil. Solo devuelve JSON con la URL; el cliente descarga directo de R2/Cloudflare.

## Cloud Run — candados coste 0

| Parámetro | Valor recomendado | Motivo |
| --- | --- | --- |
| `min-instances` | `0` | Escala a cero |
| `max-instances` | `1`–`2` | Anti-DDoS / picos que queman free tier |
| `concurrency` | `80` | FastAPI async; menos instancias |
| Región | EU (p. ej. `europe-west1`) | Latencia con Supabase EU |
| Memoria | 1–2 GiB | LangGraph holgado vs e2-micro 1 GB |

**Always Free (orientativo):** ~2M requests/mes, 360k GiB-seconds, 180k vCPU-seconds, **1 GB egress/mes** desde GCP — de ahí la regla de no servir media desde Cloud Run.

**Presupuesto GCP:** alerta en Billing con objetivo **0,01 €** al 50 % / 90 % / 100 %.

## Compute Engine e2-micro

Descartado para FastAPI + LangGraph: 1 GB RAM, free solo en US (`us-central1`, `us-east1`, `us-west1`). Válido solo para experimentos marginales.

## Criterios de éxito MVP (stack free-tier)

1. App obtiene JWT vía Supabase Auth.
2. FastAPI valida JWT y lee/escribe Postgres Supabase (`DATABASE_URL` solo servidor).
3. Avatares/audios en R2; URLs en tablas Postgres.
4. Backend desplegado en **Cloud Run** *o* **Oracle AMD Micro** con HTTPS.
5. Sin cargos recurrentes: cuotas free respetadas + alerta billing GCP si aplica.

## Pendiente

- [ ] Elegir compute: Cloud Run vs Oracle Micro (o ambos con feature flag).
- [ ] `Dockerfile` FastAPI + healthcheck Cloud Run.
- [ ] Proyectos Supabase + R2 + (opcional) GCP con secretos en `.secrets/`.
- [ ] Seguir bucle `retry_provision_loop.py` para ARM (objetivo largo plazo).
