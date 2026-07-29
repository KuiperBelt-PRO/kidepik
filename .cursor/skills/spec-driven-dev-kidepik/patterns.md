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
- Orientación rápida: [.cursor/diagrams/](../../diagrams/README.md).
