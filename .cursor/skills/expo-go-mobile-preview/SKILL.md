# Expo Go — vista previa móvil (kidepik)

## Cuándo usar

- El usuario quiere **ver la app en el móvil físico** (Expo Go), validar haptics, DPI o paridad nativa.
- Tras cambios visuales **críticos** antes de cerrar (complemento de [expo-web-local-preview](../expo-web-local-preview/SKILL.md)).
- El usuario pide «ábrelo en Expo Go», «prepara el QR», «quiero probarlo en el móvil».

## Cuándo NO usar

- Desarrollo diario de UI en PC o pruebas de agentes → **Expo Web**: [expo-web-local-preview](../expo-web-local-preview/SKILL.md).
- Solo backend/API sin superficie móvil.

---

## Flujo obligatorio del agente

Ejecutar **tú** el arranque; no limitarse a decirle al usuario que ejecute el script.

### 1. Comando canónico

Desde la raíz de `kidepik`:

```powershell
Set-Location c:\Users\eduse\OneDrive\Escritorio\work\dev\kidepik
./scripts/poc-expo-go.ps1
```

- **En background** (`block_until_ms: 0`): Metro es un proceso largo.
- El script: detecta IP LAN, escribe `mobile/.env`, reinicia API Docker (presigned MinIO), libera puerto 8081, genera `tmp/expo-go-qr.png`, abre el PNG en Windows y arranca Metro con `EXPO_OFFLINE=1` (evita fallos si Expo API no responde).

### 2. Solo UI (sin backend)

Si el usuario solo valida **galería de diseño** y no necesita POC arquitectura:

```powershell
Set-Location kidepik\mobile
$env:REACT_NATIVE_PACKAGER_HOSTNAME = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^127\.|^169\.254\.' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress)
pnpm start --host lan
```

Regenerar QR si hace falta:

```powershell
pnpm qr
# o: node mobile/scripts/generate-qr.mjs <IP-LAN>
```

### 3. Informar al usuario

En el mensaje final incluir siempre:

| Dato | Origen |
| --- | --- |
| IP LAN | salida del script |
| URL Expo | `exp://<IP-LAN>:8081` |
| QR | `kidepik/tmp/expo-go-qr.png` (debe existir) |
| Requisito | Móvil + PC misma Wi‑Fi, app [Expo Go](https://expo.dev/go) SDK 54 |
| Smoke opcional | Navegador móvil → `http://<IP-LAN>:8080/health` (solo si backend levantado) |

### 4. Si Metro ya corre

- Si el puerto 8081 está ocupado con bundle viejo tras cambios en `mobile/`, **reiniciar** con `poc-expo-go.ps1` (el script mata el proceso en 8081).
- Comprobar que `tmp/expo-go-qr.png` refleja la IP actual.

### 5. Troubleshooting breve

| Problema | Acción |
| --- | --- |
| No conecta | Firewall: Node + puerto 8081 red privada |
| Redes distintas | `cd mobile; pnpm start --tunnel` |
| `localhost:8081` = JSON | Normal (manifiesto Metro), no es error |

---

## Referencias

- Script: `scripts/poc-expo-go.ps1`
- Web en PC: `.cursor/skills/expo-web-local-preview/SKILL.md`
- Guía: `docs/POC_LOCAL.md` § App móvil con Expo Go
- Regla: `.cursor/rules/expo-go-mobile-preview.mdc`
