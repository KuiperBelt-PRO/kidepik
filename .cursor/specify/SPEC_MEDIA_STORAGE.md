# Spec: Almacenamiento de media — filesystem local (MVP) y migración futura a object storage

> Estado: **aprobada** (julio 2026)  
> Relacionado: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_PHP_BACKEND_ARCHITECTURE.md](SPEC_PHP_BACKEND_ARCHITECTURE.md)

## Decisión

**MVP y POC:** los ficheros de media viven en el **filesystem del servidor web** (DreamHost: espacio incluido en el plan; local Docker: carpeta montada bajo `web/media/`).

**No usar Cloudflare R2** (ni MinIO en Docker) en esta fase.

**Migración futura:** el acceso a media se hace solo a través de una **interfaz `StorageDriver`** en PHP. Cambiar a R2/S3 será configurar `STORAGE_DRIVER=s3` y credenciales, sin tocar contratos JSON ni el esquema de URLs en Postgres.

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
    avatars/                  # Imágenes de perfil / avatar (post-MVP visual)
    audio/                    # Narraciones, efectos
    pdf/                      # Documentos
    illustrations/            # Arte de pantallas, assets pesados
    poc/                      # Uploads de prueba POC arquitectura
```

**Convención de rutas públicas:** `/media/{categoria}/{user_id}/{uuid}.{ext}`  
Ejemplo: `/media/avatars/550e8400-e29b-41d4-a716-446655440000/a1b2c3d4.jpg`

- `{user_id}`: UUID Supabase del usuario autenticado (upload).
- `{uuid}`: generado en servidor; nunca confiar en el nombre original del cliente.
- Extensiones permitidas: lista blanca por categoría (p. ej. `jpg`, `png`, `webp`, `mp3`, `pdf`).

## Flujo de datos

### Lectura (siempre igual, local o R2 futuro)

```
Cliente  ──GET /media/avatars/...──►  nginx (DreamHost / Docker)
                                         │
                                         └── fichero en disco (MVP)
                                         └── en futuro: redirect o CDN a R2
```

PHP **no** reenvía bytes en lectura salvo endpoint de upload.

### Escritura (MVP — driver `local`)

```
1. Cliente (JWT) ──POST /api/v1/storage/prepare-upload──► PHP
2. PHP responde JSON con upload_url (POST multipart) + public_url
3. Cliente ──POST upload_url + fichero──► PHP escribe en web/media/...
4. Cliente (o backend) persiste public_url en Postgres
```

### Escritura (futuro — driver `s3` / R2)

Mismo paso 1 y 4. En el paso 2–3, `upload_url` será presigned PUT hacia R2; `public_url` apuntará al bucket/CDN. **El cliente no cambia de contrato**, solo los valores del JSON.

## Contrato API (agnóstico del driver)

### `POST /api/v1/storage/prepare-upload`

Alias de transición: `POST /api/v1/storage/presign-upload` (misma respuesta; nombre legacy de la POC FastAPI).

**Auth:** Bearer Supabase.

**Body:** `{ "filename": "foto.jpg", "category": "avatars" }`  
`category` debe ser una carpeta permitida (`avatars`, `audio`, `pdf`, `illustrations`, `poc`).

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

**Respuesta futura (driver `s3`):** misma forma; `upload.method` = `PUT`, `upload.url` = URL presigned, sin `fields`.

### `POST /api/v1/storage/upload`

Solo driver `local`. Recibe multipart + `token` de un solo uso; valida JWT o token; escribe fichero; responde `{ "public_url": "..." }`.

## Interfaz PHP (`shared/Storage/`)

```
StorageDriver (interface)
├── LocalFilesystemDriver   ← MVP, STORAGE_DRIVER=local
└── S3ObjectStorageDriver   ← futuro, STORAGE_DRIVER=s3 (R2, MinIO, AWS)
```

| Método | Responsabilidad |
| --- | --- |
| `prepareUpload(userId, filename, category): UploadPlan` | Devuelve upload + public_url |
| `completeUpload?(...)` | Solo local vía endpoint upload; S3 completa en PUT directo |
| `publicUrl(objectKey): string` | URL pública estable para guardar en BD |
| `delete?(objectKey): void` | Fase posterior |

Factory: `StorageDriverFactory::fromEnv()` lee `STORAGE_DRIVER`, `MEDIA_ROOT`, `MEDIA_PUBLIC_BASE_URL`, y vars S3 si aplica.

## Variables de entorno

| Variable | MVP (`local`) | Futuro (`s3`) |
| --- | --- | --- |
| `STORAGE_DRIVER` | `local` | `s3` |
| `MEDIA_ROOT` | `/var/www/html/media` (Docker) o ruta DreamHost | — |
| `MEDIA_PUBLIC_BASE_URL` | `https://<dominio>/media` o vacío (rutas relativas) | URL base CDN/R2 |
| `S3_ENDPOINT_URL` | — | endpoint R2 |
| `S3_BUCKET` | — | nombre bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | credenciales |

## Postgres — solo URLs

```sql
-- Ejemplo futuro; POC puede usar solo JSON de prueba
-- avatar_url text  →  '/media/avatars/{user_id}/{uuid}.jpg'
```

Nunca `bytea` ni base64 de ficheros en tablas de producto.

## Seguridad (MVP local)

| Tema | Medida |
| --- | --- |
| Ejecución PHP en `/media/` | **Desactivada** — nginx sirve estáticos; sin `.php` en media |
| Listado directorios | Denegado (`autoindex off`) |
| Upload | Solo categorías en lista blanca; tamaño máximo en PHP/nginx |
| Tokens de upload | Un solo uso, TTL corto, ligados a `user_id` |
| Path traversal | Sanitizar; rutas siempre bajo `MEDIA_ROOT` |

## Docker local

- Carpeta `web/media/` bind-mount como el resto de `web/`.
- **Sin servicio MinIO** en compose MVP.
- `architecture/status` comprueba que `MEDIA_ROOT` existe y es escribible.

## Migración a Cloudflare R2 (checklist futuro)

1. Crear bucket R2 y credenciales.
2. Implementar `S3ObjectStorageDriver` (puede reutilizar `aws/aws-sdk-php`).
3. Script one-off: copiar objetos `web/media/**` → R2 preservando keys lógicas.
4. Actualizar filas Postgres: prefijo de URL si cambia el host público.
5. Cambiar `STORAGE_DRIVER=s3` en producción.
6. Opcional: dejar nginx `/media/` como redirect 302 a CDN.

**Sin cambiar:** rutas API, forma del JSON `prepare-upload`, columnas URL en BD (solo valor del string).

## Criterios de éxito (POC)

1. Upload POC con JWT → fichero en `web/media/poc/` y `public_url` accesible vía GET en `:8082`.
2. Postgres (o pantalla POC) muestra URL, no binario.
3. `STORAGE_DRIVER=local` documentado; interfaz `StorageDriver` presente aunque `S3ObjectStorageDriver` esté stub.

## Aprobación

- [x] Usuario aprueba **filesystem DreamHost** para media (sin Cloudflare en MVP).
- [x] Usuario aprueba diseño **migrable** vía `StorageDriver` + URLs en Postgres.
