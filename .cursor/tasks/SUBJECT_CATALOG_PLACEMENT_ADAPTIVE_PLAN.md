# Plan: Catálogo 14 materias + placement adaptativo + prosa mentor

> Specs: SPEC_APP_SUBJECT_CATALOG, SPEC_APP_MENTOR_PLACEMENT_ADAPTIVE (aprobadas 31 jul 2026)  
> OK implementación: 31 jul 2026 (sesión)

## Orden TDD

1. `SubjectCatalog` + `SubjectCatalogTest`
2. `PlacementBank` (active_subjects, dificultad, pesos) + tests
3. `MentorProseRules` / `PlacementNarrator` + templates + tests
4. `PlacementItemWriter` enriquecido + `PlacementService` prosa
5. `DialogueService` sugerencia active_subjects al fijar edad
6. `CrewService` PATCH learning + `ParentSettingsService` catálogo 14
7. UI crew-panel checklist + parent-settings defaults
8. PHPUnit suite + Playwright smoke
