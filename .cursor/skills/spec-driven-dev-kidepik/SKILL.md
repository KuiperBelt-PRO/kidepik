---
name: spec-driven-dev-kidepik
description: >-
  SDD + TDD en el repositorio kidepik (producto Kuiper Belt). Usar cuando el
  cambio sea código de este repo y se pida especificación, tests primero o
  feature con cobertura.
---

## Ámbito del repositorio (kidepik)

- Esta skill gobierna el SDD/TDD **únicamente** para código bajo el repo **kidepik**; no sustituye a `spec-driven-dev-pda`, `spec-driven-dev-kuiper`, `spec-driven-dev-kuiper-auto`, `spec-driven-dev-misc` ni a la skill genérica `spec-driven-dev` de `Vibe-Coding`.
- Coloca specs formales en [.cursor/specify/](../../specify/) y enlázalas desde [CURRENT_SPECS.md](../../CURRENT_SPECS.md).
- Respeta el stack y versiones documentados en `pyproject.toml`, `package.json` u otros manifiestos cuando existan.

# Desarrollo guiado por especificación (SDD + TDD)

## Cuándo usar

- El usuario pide implementar una feature "con tests", "con TDD" o "spec-first".
- Se proporciona una especificación (markdown, requisitos, contrato de API) y se pide implementarla.
- El usuario menciona "spec-driven", "SDD", "TDD", "test-first", "red-green-refactor".
- Hay que crear un módulo o servicio nuevo desde cero con cobertura garantizada.

## Cuándo NO usar

- Para bugs puntuales donde el fix es obvio y no requiere ciclo completo.
- Para cambios de configuración, infra o devops sin lógica testeable.
- Para code review de código existente → `Vibe-Coding/.cursor/skills/code-review/SKILL.md`.
- Para tareas puramente de datos/ETL sin lógica de negocio testeable.

---

## Conceptos clave

**SDD:** la especificación es la fuente de verdad. Se define qué debe hacer el sistema antes de escribir código. La implementación y los tests se derivan de la spec.

**TDD:** ciclo Red-Green-Refactor. Escribir un test que falla, implementar lo mínimo para que pase, refactorizar manteniendo verde.

**Relación:** SDD usa TDD como motor de implementación. La spec genera los tests; TDD garantiza que cada requisito se traduce en código verificado.

---

## Flujo

### Fase 1 — Especificar

Antes de tocar código, la especificación debe existir o construirse.

1. **Si el usuario proporciona spec:** leerla, identificar requisitos funcionales concretos y extraer invariantes (precondiciones, postcondiciones, edge cases).
2. **Si no hay spec explícita:** construir una mínima como bloque markdown o docstring con el usuario. Cubrir: qué entrada recibe, qué salida produce, qué errores maneja, qué efectos secundarios tiene.

Formato de spec mínima (adaptar al contexto):

```markdown
## Spec: <nombre del módulo/función>

**Entrada:** <tipos y restricciones>
**Salida:** <tipos y garantías>
**Comportamiento:**
- <requisito 1>
- <requisito 2>
**Errores:** <qué excepciones y cuándo>
**Edge cases:** <valores límite, vacíos, nulos>
```

No sobrecargar: la spec debe ser proporcional al tamaño de la tarea.

### Fase 2 — Planificar

Descomponer la spec en unidades testeables.

1. Listar las funciones/clases/métodos que implementarán la spec.
2. Para cada unidad, definir los casos de test derivados de la spec.
3. Decidir estructura de archivos: dónde van tests, dónde va el código, fixtures necesarias.

Seguir la convención del proyecto existente. Si no hay convención, aplicar los [patrones Python](patterns.md#estructura-de-archivos) o el stack elegido en la spec.

### Fase 3 — Test First (ciclo TDD)

Ejecutar Red-Green-Refactor por cada unidad, de la más simple a la más compleja.

### Fase 4 — Validar cobertura de la spec

Cruzar cada requisito de la spec con al menos un test que lo verifica.

## Superficie observable (UI, HTTP, demos)

Las políticas generales están en `Vibe-Coding/.cursor/rules/cursor-browser-mcp-testing-ide.mdc` y en [.cursor/rules/cursor-browser-mcp-testing.mdc](../../rules/cursor-browser-mcp-testing.mdc) (URLs locales de este repo).

### Fase 5 — Cerrar

- Ejecutar linter/type checker si el proyecto los tiene.
- Verificar que no se rompieron tests existentes.
- Resumir al usuario: qué se implementó, qué tests se crearon, cobertura de la spec.

---

## Reglas críticas

- **Spec antes que código.**
- **Test antes que implementación** (salvo helpers triviales).
- **Un ciclo Red-Green-Refactor por comportamiento.**
- **Respetar convenciones del proyecto.**
- **Ejecutar tests realmente** tras cada ciclo.

---

## Salida esperada

- Especificación (markdown en `.cursor/specify/` o inline según tamaño).
- Tests que cubren cada requisito de la spec.
- Implementación que pasa todos los tests.

## Referencias

- Patrones Python: [patterns.md](patterns.md).
- Buenas prácticas hub: `Vibe-Coding/.cursor/skills/python-engineering/SKILL.md`.
