# Plan: Bloque 1 — Ajustes + Tripulación (gestión)

> Specs: SPEC_APP_SETTINGS_SECTION (Fase A), SPEC_APP_CREW_SECTION (Fase A)  
> Fecha: julio 2026

## Alcance

| Incluido | Excluido |
| --- | --- |
| `parent_accounts.settings` + GET/PATCH | Play / first-run / examen |
| Escena `#/settings` (apariencia + resumen + crew_defaults) | apply-defaults (B), export, usage IA |
| Tablas children + child_permissions | Horarios / learning overrides UI (B) |
| API crew CRUD + permissions + PIN | `#/play` |
| Escenas lista / alta plaza / ficha + permisos | Traits |

## Orden TDD

1. Migración settings → ParentSettingsService + PHPUnit
2. GET/PATCH settings → Router
3. Wiring shell + escena Settings (tema sync)
4. Migración children → CrewService + PHPUnit
5. API crew completa
6. Escenas Crew
7. Resumen member_count cruzado
8. Validate PHPUnit + npm test + Playwright
