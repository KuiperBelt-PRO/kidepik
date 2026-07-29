# Spec: Almacenamiento de media — filesystem local

> Estado: **aprobada** (julio 2026; actualizada jul 2026 — sin R2/S3)  
> Relacionado: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md)

## Decisión

Los ficheros de media viven en el **filesystem del servidor web** (DreamHost: espacio del plan; local Docker: `web/media/`).

**No se usará** Cloudflare R2, MinIO, Supabase Storage ni driver S3. El único driver soportado es `local` (`STORAGE_DRIVER=local`).

## Usos

| Uso | Ejemplos |
| --- | --- |
| Media de la app | Avatares, audios, PDFs, ilustraciones |
| No blobs en Postgres | Supabase guarda **solo URLs** (`text` / `varchar`) |
| Lectura directa por el cliente | El navegador/app descarga desde **`/media/...`** (nginx), sin proxy PHP |

## Estructura en disco (bajo el document root)

```
web/
  media/                      # NO versionar ficheros subidos; sí .gitkeep por subcarpeta
    avatars/
    audio/
    pdf/
    illustrations/
    poc/                      # Uploads de prueba POC
```

**Convención de rutas públicas:** `/media/{categoria}/{user_id}/{uuid}.{ext}`

- `{user_id}`: UUID Supabase del usuario autenticado (upload).
- `{uuid}`: generado en servidor; nunca confiar en el nombre original del cliente.
- Extensiones permitidas: lista blanca por categoría.

## Flujo de datos

### Lectura

```
Cliente  ──GET /media/avatars/...──►  nginx (DreamHost / Docker)
                                         └── fichero en disco
```

PHP **no** reenvía bytes en lectura.

### Escritura (`STORAGE_DRIVER=local`)

```
1. Cliente (JWT) ──POST /api/v1/storage/prepare-upload──► PHP
2. PHP responde JSON con upload_url (POST multipart) + public_url
3. Cliente ──POST upload_url + fichero──► PHP escribe en web/media/...
4. Cliente (o backend) persiste public_url en Postgres
```

## Contrato API

### `POST /api/v1/storage/prepare-upload`

**Auth:** Bearer Supabase.

**Body:** `{ "filename": "foto.jpg", "category": "avatars" }`  
`category`: `avatars` | `audio` | `pdf` | `illustrations` | `poc`.

**Respuesta 200:**

```json
{
  "upload": {
    "url": "/api/v1/storage/upload",
    "method": "POST",
    "fields": {
      "token": "<one-time-token>",
      "category": "avatars"
    }
  },
  "public_url": "/media/avatars/550e8400-e29b-41d4-a716-446655440000/a1b2c3d4.jpg",
  "expires_in": 900
}
```

### `POST /api/v1/storage/upload`

Multipart + `token` de un solo uso; escribe fichero; responde `{ "public_url": "..." }`.

## Interfaz PHP (`shared/Storage/`)

```
StorageDriver (interface)
└── LocalFilesystemDriver   ← STORAGE_DRIVER=local (único)
```

Factory: `StorageDriverFactory::create()` — rechaza cualquier driver distinto de `local`.

## Variables de entorno

| Variable | Valor |
| --- | --- |
| `STORAGE_DRIVER` | `local` |
| `MEDIA_ROOT` | `/var/www/html/media` (Docker) o ruta DreamHost |
| `MEDIA_PUBLIC_BASE_URL` | `/media` o URL absoluta del dominio |

## Postgres — solo URLs

Nunca `bytea` ni base64 de ficheros en tablas de producto.

## Seguridad

- Uploads autenticados; token one-time; lista blanca de extensiones; sin ejecución PHP bajo `media/`.

## Criterios de éxito

1. `prepare-upload` + `upload` escriben bajo `web/media/`.
2. `GET /media/...` sirve el fichero vía nginx.
3. Sin dependencias S3/R2/MinIO en el repo.

## Descartado (no reabrir sin decisión explícita)

Cloudflare R2, MinIO, alias `presign-upload`, `S3ObjectStorageDriver`, FastAPI storage.
