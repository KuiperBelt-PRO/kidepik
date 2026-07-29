# Spec: POC — entorno Docker local (única vía de desarrollo)

> Estado: **propuesta para aprobación** (julio 2026)  
> Relacionado: [SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md](SPEC_POC_PHP_DREAMHOST_ARCHITECTURE.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [SPEC_WEB_DEV_PREVIEW.md](SPEC_WEB_DEV_PREVIEW.md)

## Objetivo

Definir el **único** entorno de desarrollo y pruebas de la POC: todo corre en **Docker**; el host Windows **no** levanta servidores de aplicación (`php -S`, `uvicorn`, `npx serve`, etc.).

Los cambios en código PHP, HTML, CSS, JS y ficheros en `web/media/` deben verse **en caliente** vía volúmenes bind-mount, sin reconstruir la imagen salvo cambios en `Dockerfile` o dependencias Composer.

## Principio rector

```
Desarrollador / agente edita ficheros en el repo
        │
        ▼
  Bind mount → contenedor nginx / php-fpm
        │
        ▼
  http://localhost:8082  (única URL de app para humanos y Playwright)
```

## Servicios Docker (compose objetivo)

| Servicio | Imagen / build | Puerto host | Rol |
| --- | --- | --- | --- |
| `web` | `nginx:alpine` + config repo | **8082:80** | Sirve `web/` (estáticos + `/media/`) + proxy PHP |
| `php` | `docker/php/Dockerfile` (php-fpm 8.2+) | interno 9000 | Ejecuta `api/` y `shared/`; escribe en `web/media/` |

**Sin MinIO** en MVP — media local bajo `web/media/` ([SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md)).

### Supabase local

Supabase CLI (`supabase start`) levanta **contenedores Docker**. Válido porque no es un servidor en el host.

| Servicio | Puerto host |
| --- | --- |
| Supabase API | **54321** |
| Supabase DB (direct) | 54322 |

## Volúmenes (hot reload)

```yaml
services:
  web:
    volumes:
      - ../web:/var/www/html:ro
      - ../api/public:/var/www/api/public:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
  php:
    volumes:
      - ../api:/var/www/api
      - ../shared:/var/www/shared
      - ../web/media:/var/www/html/media    # rw — uploads POC
```

| Carpeta host | Montaje | Recarga |
| --- | --- | --- |
| `web/` (excepto media writes) | `/var/www/html` | F5 |
| `web/media/` | `/var/www/html/media` (php rw, nginx ro o rw según config) | Tras upload, GET inmediato |
| `api/`, `shared/` | contenedor php | F5 en endpoints |

### PHP opcache en desarrollo

```ini
opcache.enable=1
opcache.validate_timestamps=1
opcache.revalidate_freq=0
```

## URLs canónicas (desde el host Windows)

| Uso | URL |
| --- | --- |
| **App completa (cliente + API)** | `http://localhost:8082` |
| API health | `http://localhost:8082/api/v1/health` |
| Media (lectura directa) | `http://localhost:8082/media/{categoria}/...` |
| Supabase API | `http://localhost:54321` |

**Prohibido:** `localhost:8080` (FastAPI legacy), `localhost:9000` (MinIO legacy).

## Variables de entorno

Fichero `.env.poc` (plantilla `.env.poc.sample`):

| Variable | Ejemplo local | Consumidor |
| --- | --- | --- |
| `SUPABASE_URL` | `http://host.docker.internal:54321` | PHP |
| `SUPABASE_ANON_KEY` | desde `supabase status` | PHP + `config.js` |
| `DATABASE_URL` | connection string local | PHP |
| `STORAGE_DRIVER` | `local` | PHP |
| `MEDIA_ROOT` | `/var/www/html/media` | PHP |
| `MEDIA_PUBLIC_BASE_URL` | `/media` o vacío (rutas relativas) | PHP + cliente |
| `APP_ENV` | `local` | PHP |

Solo `STORAGE_DRIVER=local`. Sin variables S3/R2.

## Scripts

| Script | Comportamiento |
| --- | --- |
| `poc-up.ps1` | `supabase start` + migraciones + `docker compose up -d` + `config.js` |
| `poc-down.ps1` | `docker compose down`; opcional `supabase stop` |
| `poc-web-preview.ps1` | Electron contra `:8082` |

## Generación `web/js/config.js`

```javascript
export const config = {
  API_URL: '/api/v1',
  MEDIA_BASE_URL: '/media',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: '<desde supabase status>',
};
```

## Pruebas

- Playwright: `http://localhost:8082`, viewport 390×844, capturas en `tmp/playwright-output/`.
- PHPUnit: `docker compose exec php vendor/bin/phpunit`.
- Smoke storage: upload POC → GET `/media/poc/...` → 200.

## Criterios de aceptación

1. `poc-up.ps1` → app en `:8082` sin MinIO ni servidores en host.
2. Hot reload en `web/`, `api/`, `shared/`.
3. Upload escribe en `web/media/` visible al refrescar URL pública.

## Aprobación

- [ ] Usuario aprueba **8082** como puerto único de aplicación.
- [x] Usuario aprueba **sin MinIO**; media en `web/media/`.
