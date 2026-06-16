# Expo Web — vista previa local (kidepik)

## Cuándo usar

- Desarrollo diario de UI en **PC** (`mobile/`: loader, galería, mockups, temas).
- El usuario o un **agente Cursor** debe **probar la app en navegador**, tomar capturas o automatizar clics (MCP `cursor-ide-browser` o Playwright).
- Tras cambios observables en `mobile/` cuando **no** haga falta validar nativo (haptics, DPI, Expo Go).

## Cuándo NO usar

- Validación nativa final (Expo Go, emulador) → [expo-go-mobile-preview](../expo-go-mobile-preview/SKILL.md).
- Solo backend/API sin superficie móvil.

---

## Flujo obligatorio del agente

Ejecutar **tú** el arranque; no limitarse a instrucciones manuales.

### 1. Comando canónico

Desde la raíz de `kidepik`:

```powershell
Set-Location c:\Users\eduse\OneDrive\Escritorio\work\dev\kidepik
./scripts/poc-expo-web.ps1
```

- **En background** (`block_until_ms: 0`): Metro web es un proceso largo.
- El script: escribe `mobile/.env` con `localhost`, libera puerto 8081, arranca `expo start --web --port 8081`.

**Con backend** (POC arquitectura, Supabase, MinIO):

```powershell
./scripts/poc-expo-web.ps1 -Backend
```

### 2. URL y pruebas MCP

| Dato | Valor |
| --- | --- |
| App web | `http://localhost:8081` |
| API (si `-Backend`) | `http://localhost:8080/health` |
| Capturas agente | `kidepik/tmp/playwright-output/` |

Flujo MCP mínimo (regla canónica: `Vibe-Coding/.cursor/rules/cursor-browser-mcp-testing-ide.mdc`):

1. `browser_navigate` → `http://localhost:8081`
2. Esperar loader → galería (unos segundos)
3. `browser_snapshot` — comprobar título/galería visible
4. Interacción: abrir mockup o toggle tema
5. `browser_take_screenshot` → `tmp/playwright-output/kidepik-web-<paso>.png`

Viewport recomendado: móvil (~390×844) vía CDP o tamaño de ventana estrecho.

### 3. Solo UI (sin script)

```powershell
Set-Location kidepik\mobile
# .env con localhost (ver .env.sample)
pnpm web
```

### 4. Informar al usuario

Incluir siempre: URL `http://localhost:8081`, si backend está levantado, ruta de capturas si las generaste.

### 5. Troubleshooting breve

| Problema | Acción |
| --- | --- |
| JSON en `:8081` | Metro nativo sin `--web`; usar `poc-expo-web.ps1` o `pnpm web` |
| Puerto ocupado | El script mata proceso en 8081; reiniciar script |
| POC arquitectura falla | `./scripts/poc-expo-web.ps1 -Backend` o `./scripts/poc-up.ps1` antes |
| Paridad nativa | Cerrar con smoke en Expo Go si el cambio es visual crítico |

---

## Referencias

- Script: `scripts/poc-expo-web.ps1`
- Guía: `docs/POC_LOCAL.md` § Expo Web
- Spec: `.cursor/specify/SPEC_EXPO_WEB_LOCAL_PREVIEW.md`
- Regla: `.cursor/rules/expo-web-local-preview.mdc`
- Móvil físico: `.cursor/skills/expo-go-mobile-preview/SKILL.md`
