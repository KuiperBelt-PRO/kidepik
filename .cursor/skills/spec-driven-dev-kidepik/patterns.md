# Patrones para SDD + TDD (kidepik)

Complemento local de [SKILL.md](SKILL.md). El **método** (fases, TDD, reglas) vive en `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md`; aquí solo convenciones acotadas a **kidepik**.

Patrones Python genéricos (herramientas, scripts): `Vibe-Coding/.cursor/skills/python-engineering/patterns.md`.

---

## Backend de producto (PHP)

```
api/
  public/index.php
  src/                # dominio HTTP
  tests/              # PHPUnit
shared/               # Storage local, DB, Config
docker/compose.yaml   # nginx + php-fpm
web/media/            # media filesystem
```

Nuevos módulos: bajo `api/src/` + `shared/`; tests en `api/tests/`. Spec: [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md).

**Descartado:** FastAPI, R2/S3, MinIO, OCI — ver [SPEC_POC_LOCAL_ARCHITECTURE.md](../../specify/SPEC_POC_LOCAL_ARCHITECTURE.md) (aviso).

---

## Spec como contrato

- Contratos HTTP y storage: specs en `.cursor/specify/` + tests PHPUnit / Playwright.
- Índice vivo: [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Antes de proponer: puerta de descubrimiento en [SKILL.md § Inventario documental](SKILL.md#inventario-documental--consultar-antes-de-proponer).
- Orientación rápida: [.cursor/diagrams/](../../diagrams/README.md) — actualizar al cerrar si cambió el flujo representado.

### Checklist rápido — nueva iniciativa

| Paso | Hecho cuando… |
| --- | --- |
| Leído CURRENT_SPECS + diagrama 14 | Sé si ya existe spec/diagrama del área |
| Buscado en `.cursor/specify/` por prefijo | No duplico `SPEC_APP_*` / `SPEC_LOADER_*` existente |
| Leído diagrama `0N-*.md` del área | El Mermaid coincide con lo que voy a proponer |
| Spec nueva o delta redactado | Contrato revisable antes de código |
| Aprobación del usuario | Solo entonces Fase 2+ |
| Al cerrar: spec + CURRENT_SPECS + diagrama | Documentación alineada con el código |

### Mapa spec ↔ diagrama (atajos)

| Área de trabajo | Specs típicas | Diagrama(s) |
| --- | --- | --- |
| Stack / Docker / puerto | `SPEC_POC_*`, `SPEC_POC_DOCKER_*` | 01, 02, 03 |
| API PHP / Router | `SPEC_PHP_BACKEND_*` | 04 |
| Auth / tablas / migraciones | `SPEC_APP_AUTH*`, `SPEC_PHP_DB_*` | 05 |
| Cliente `web/` / módulos | `SPEC_WEB_FRONTEND_*` | 06 |
| Rutas hash / shell | `SPEC_APP_SHELL_*`, `SPEC_APP_SECTION_*` | 07 |
| Mundo dual / temas | `SPEC_WORLD_*` | 08 |
| Loader / gate / OAuth | `SPEC_LOADER_*`, `SPEC_APP_AUTH*` | 09 |
| Cuenta / crew / ajustes / legal | `SPEC_APP_*_SECTION`, `SPEC_LEGAL_*` | 10 |
| Play / examen / diálogo | `SPEC_APP_PLAY_*`, `SPEC_APP_ADVENTURE_*` | 11 |
| Media filesystem | `SPEC_MEDIA_*` | 12 |
| Tests / validación UI | `SPEC_WEB_DEV_PREVIEW` | 13 |
| ¿Qué abrir primero? | — | 14 |
