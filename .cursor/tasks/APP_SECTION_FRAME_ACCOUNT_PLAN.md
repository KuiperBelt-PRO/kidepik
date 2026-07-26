# Plan: Marco de sección + Cuenta padre

> Specs: [SPEC_APP_SECTION_FRAME.md](../specify/SPEC_APP_SECTION_FRAME.md), [SPEC_APP_ACCOUNT_SECTION.md](../specify/SPEC_APP_ACCOUNT_SECTION.md)  
> Estado: en implementación (julio 2026)

## Orden TDD

1. **API PHP** — `GET|PATCH|DELETE /api/v1/parents/me` + PHPUnit
2. **Helpers web** — `shouldCompressWorldBands`, validación alias, tests Node
3. **Section frame** — componente + CSS
4. **Escena account** — panel, modal, navegación bandas desde shell
5. **Validate** — PHPUnit + `node --test` + Playwright 390×844

## Notas

- Borrado Auth: SQL `auth.users` vía `DATABASE_URL` (local); opcional Admin API si hay `SUPABASE_SERVICE_ROLE_KEY`
- Legal no adopta marco glass
- Cache-bust `?v=176` en assets tocados
