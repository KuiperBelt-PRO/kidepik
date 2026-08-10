# Límites Gemini API — proyecto kidepik (tier gratuito)

> **Fuente:** Google AI Studio → Límite de frecuencia de la API de Gemini  
> **Proyecto:** `kidepik`  
> **Período de medición UI:** 28 días  
> **Captura:** agosto 2026  
> **Canónico en vivo:** [AI Studio rate limits](https://aistudio.google.com/rate-limit) (los números pueden cambiar).

## Aviso operativo

- Los límites son **por proyecto GCP**, no por API key.
- **RPD** (requests per day) suele resetear a medianoche **Pacific Time**.
- En esta captura el proyecto mostró **error de límite alcanzado** (Gemini 3 Flash: 22/20 RPD).
- Modelos con `0 / 0` en la UI = **no disponibles** en free para este proyecto (p. ej. Gemini 2 Flash, varios Pro).
- El código **no** debe hardcodear estos números como contrato HTTP; usar clasificación `429` + rotación de modelos ([SPEC_AI_GEMINI_GATEWAY](specify/SPEC_AI_GEMINI_GATEWAY.md)).

---

## Uso reciente vs límite (captura)

| Modelo | RPM (uso/límite) | TPM (uso/límite) | RPD (uso/límite) |
| --- | --- | --- | --- |
| Gemini 2.5 Flash | 3 / 5 | 5.49K / 250K | 5 / **20** |
| Gemini 3 Flash | 3 / 5 | 8.71K / 250K | **22 / 20** ⚠️ |

---

## Límites por modelo — texto de salida

| Modelo | RPM | TPM | RPD |
| --- | --- | --- | --- |
| Gemini 2.5 Flash | 5 | 250K | 20 |
| Gemini 3 Flash | 5 | 250K | 20 |
| Gemini 2.5 Flash Lite | 10 | 250K | 20 |
| Gemini 3.1 Flash Lite | 15 | 250K | **500** |
| Gemini 3.5 Flash | 5 | 250K | 20 |
| Gemini 3.5 Flash Lite | 15 | 250K | **500** |
| Gemini 3.6 Flash | 5 | 250K | 20 |
| Gemini 2 Flash | — | — | — (0/0) |
| Gemini 2 Flash Lite | — | — | — (0/0) |
| Gemini 2.5 Pro | — | — | — (0/0) |
| Gemini 3.1 Pro | — | — | — (0/0) |

### Agentes y otros

| Modelo | RPM | TPM | RPD |
| --- | --- | --- | --- |
| Antigravity | 60 | 100K | 100 |
| Deep Research Pro Preview | 0 | 0 | 0 |
| Gemini Embedding 1 | 100 | 30K | 1K |
| Gemini Embedding 2 | 100 | 30K | 1K |
| Gemma 4 26B | 30 | 16K | 14.4K |
| Gemma 4 31B | 30 | 16K | 14.4K |
| Gemini Robotics ER 1.5 Preview | 10 | 250K | 20 |
| Gemini Robotics ER 1.6 Preview | 5 | 250K | 20 |
| Gemini Robotics ER 2 Preview | 5 | 250K | 20 |

### Multimodal / generación

| Modelo | RPM | TPM / otro | RPD |
| --- | --- | --- | --- |
| Gemini 2.5 Flash TTS | 3 | 10K TPM | 10 |
| Gemini 3.1 Flash TTS | 3 | 10K TPM | 10 |
| Imagen 4 Fast / Generate / Ultra | — | — | 25 c/u |
| Nano Banana (2.5 Flash Preview Image) | 0 | 0 | 0 |
| Nano Banana Pro (3 Pro Image) | 0 | 0 | 0 |
| Nano Banana 2 / 2 Lite (imagen) | 0 | 0 | 0 |
| Veo 3 / 3 Lite | 0 | — | 0 |
| Lyria 3 Clip / Pro | 0 | 0 | 0 |

### API en vivo

| Modelo | RPM | TPM | RPD |
| --- | --- | --- | --- |
| Gemini 2.5 Flash Native Audio Dialog | Ilimitado | 1M | Ilimitado |
| Gemini 3 Flash Live | Ilimitado | 65K | Ilimitado |
| Gemini 3.5 Live Translate | Ilimitado | 20K | Ilimitado |

---

## Fundamentación (grounding) — RPD

| Herramienta / modelo | RPD |
| --- | --- |
| Deep Research Pro Preview | 500 |
| Gemini 2 Flash | 500 |
| Computer Use Preview | 500 |
| Gemini 2.5 Flash / Lite | 500 |
| Gemini 2.5 Pro | 0 |
| Gemini 3 Flash / 3.1 Pro / 3.5 Flash / 3.6 Flash | 0 |
| Gemini 3.1 Flash Lite / TTS | 500 |
| Gemini 3.5 Flash Lite | 500 |
| Robotics ER 1.6 / 2 | 500 |
| Búsqueda Gemini 2 / 2.5 / Default | 1.5K |
| Búsqueda Gemini 3 | 0 |

---

## Implicaciones para kidepik

| Observación | Acción en código |
| --- | --- |
| Flash quality ≈ **20 RPD** | Composes batch (`placement`, `path_composer`) → **lite primero** (500 RPD) |
| 3 llamadas para 3 caminos agota cuota | `path_composer` → **1 llamada** con `paths.length = 3` |
| `gemini-2.0-flash` 0/0 en proyecto | Eliminado de defaults env |
| Rotación por purpose | `GEMINI_PURPOSE_MODEL_DEFAULTS` en `config.py` |

### IDs API usados en defaults (env)

| UI Google | Variable env típica |
| --- | --- |
| Gemini 3 Flash | `gemini-3-flash-preview` |
| Gemini 2.5 Flash | `gemini-2.5-flash` |
| Gemini 3.5 Flash | `gemini-3.5-flash-preview` |
| Gemini 3.6 Flash | `gemini-3.6-flash-preview` |
| Gemini 2.5 Flash Lite | `gemini-2.5-flash-lite` |
| Gemini 3.1 Flash Lite | `gemini-3.1-flash-lite` |
| Gemini 3.5 Flash Lite | `gemini-3.5-flash-lite` |

Verificar ids en [modelos Gemini](https://ai.google.dev/gemini-api/docs/models) si Google renombra previews.

---

## Enlaces

- [Pricing / free tier](https://ai.google.dev/gemini-api/docs/pricing)
- [Rate limits (oficial)](https://ai.google.dev/gemini-api/docs/rate-limits)
- [AI Studio — límites del proyecto](https://aistudio.google.com/rate-limit)
- Spec gateway: [SPEC_AI_GEMINI_GATEWAY.md](../specify/SPEC_AI_GEMINI_GATEWAY.md)
