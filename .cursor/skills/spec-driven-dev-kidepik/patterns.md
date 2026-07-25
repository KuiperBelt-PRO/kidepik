# Patrones para SDD + TDD (kidepik)

Complemento local de [SKILL.md](SKILL.md). El **método** (fases, TDD, reglas) vive en `Vibe-Coding/.cursor/skills/spec-driven-dev/SKILL.md`; aquí solo convenciones acotadas a **kidepik**.

Patrones Python genéricos (herramientas, scripts): `Vibe-Coding/.cursor/skills/python-engineering/patterns.md`.

---

## Backend de producto (PHP — vigente)

Convención del POC / MVP:

```
api/
  public/index.php
  src/                # dominio HTTP
  tests/              # PHPUnit
shared/               # código compartido (Storage, DB, …)
docker/compose.yaml   # nginx + php-fpm
web/media/            # media local MVP
```

Nuevos módulos: bajo `api/src/` + `shared/`; tests en `api/tests/`. Spec: [SPEC_PHP_BACKEND_ARCHITECTURE.md](../../specify/SPEC_PHP_BACKEND_ARCHITECTURE.md).

**No extender** `backend/` (FastAPI legacy).

---

## Backend FastAPI (histórico)

```
backend/
  app/
    main.py           # FastAPI — solo referencia
    routes/
  tests/
  pyproject.toml
```

Conservado en el repo como legado del POC jun 2026. Spec supersedida: [SPEC_POC_LOCAL_ARCHITECTURE.md](../../specify/SPEC_POC_LOCAL_ARCHITECTURE.md).

---

## Spec como contrato

- Contratos HTTP y storage: specs en `.cursor/specify/` + tests PHPUnit / Playwright.
- Type hints Python solo en herramientas (`tools/`, MCP OCI), no en el camino crítico del producto web.
