# specify

Coloca aquí las especificaciones en markdown de features que deban seguir el flujo SDD (ver [SDD.md](../SDD.md)).

## Antes de crear una spec nueva

1. Consultar [CURRENT_SPECS.md](../CURRENT_SPECS.md) y buscar en esta carpeta por prefijo (`SPEC_LOADER_*`, `SPEC_APP_*`, …).
2. Leer el diagrama del área en [diagrams/](../diagrams/README.md) y [14-agent-decision-tree.md](../diagrams/14-agent-decision-tree.md).
3. Seguir la **puerta de descubrimiento** en [skills/spec-driven-dev-kidepik/SKILL.md](../skills/spec-driven-dev-kidepik/SKILL.md).

Si el contrato ya existe, **ampliar** la spec existente en lugar de duplicar.

## Convención

- Un fichero por iniciativa con contrato propio: `SPEC_<ÁREA>_<TEMA>.md`.
- Enlazar desde [CURRENT_SPECS.md](../CURRENT_SPECS.md) con estado (aprobada, implementada, contrato, …).
- Al cerrar la implementación: actualizar spec, índice y diagrama enlazado si cambió flujo o contrato.
