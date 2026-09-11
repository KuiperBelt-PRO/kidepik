# Spec: Síntesis de voz Gemini (TTS) — dictado y audio de producto

> Estado: **aprobada** (6 sep 2026)  
> Relacionado: [SPEC_APP_DICTATION.md](SPEC_APP_DICTATION.md), [SPEC_AI_GEMINI_GATEWAY.md](SPEC_AI_GEMINI_GATEWAY.md), [SPEC_MEDIA_STORAGE.md](SPEC_MEDIA_STORAGE.md), [SPEC_APP_FILE_LOGGING.md](SPEC_APP_FILE_LOGGING.md)  
> **Ops:** [GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md](../operations/GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md)  
> **Docs Google:** [Speech generation](https://ai.google.dev/gemini-api/docs/speech-generation) · [Pricing TTS](https://ai.google.dev/gemini-api/docs/pricing) · [Cloud Gemini-TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts)

## Contexto

El modo dictado ([SPEC_APP_DICTATION](SPEC_APP_DICTATION.md)) **no puede existir** sin un modelo que genere audio de voz. El stack de producto ya usa **Google AI Studio** (`GOOGLE_API_KEY`) y se niega a OpenRouter / plantillas ([SPEC_AI_GEMINI_GATEWAY](SPEC_AI_GEMINI_GATEWAY.md) G4–G5).

Esta spec fija: investigación de modelos **gratis**, contrato de síntesis, cache y fallback. No define pedagogía ni UI de dictado.

## 0. Glosario (qué es cada cosa)

Hay **dos productos Google distintos** que generan voz. En kidepik solo usamos el primero.

| Nombre | Qué es | ¿Lo usamos? |
| --- | --- | --- |
| **Gemini TTS** | Los modelos de voz de **Gemini / AI Studio**, con la misma `GOOGLE_API_KEY` que ya genera texto del mentor. P. ej. `gemini-3.1-flash-tts-preview`. | **Sí (POC)** |
| **Cachear el audio** | Google genera el dictado **una sola vez**. El servidor guarda un WAV en `web/media/audio/`. «Oír otra vez» reproduce ese fichero: **0 llamadas** a Gemini, 0 cuota. | **Sí, obligatorio** |
| **Cloud Text-to-Speech** | Otro servicio de **Google Cloud** (voces Standard, WaveNet, Chirp). Requiere activar esa API y una **cuenta de facturación** GCP. No vale la clave de AI Studio. Cuota distinta (caracteres/mes). | **No en POC** |

Sin cache, cada replay gastaría uno de los ~10 audios/día del tier free: el dictado se volvería inutilizable. Cloud TTS sería un plan B de producción si algún día el RPD de Gemini TTS no basta; **no** forma parte de este corte.

## Investigación (sep 2026)

### A. Gemini API (AI Studio) — **canónico POC**

Misma clave que el resto de agentes. Modelos TTS **distintos** de Flash de texto.

| Modelo (UI / id típico) | Free en proyecto kidepik (captura ago 2026) | Notas |
| --- | --- | --- |
| Gemini 2.5 Flash TTS | **3 RPM · 10K TPM · 10 RPD** | Preview; id a verificar (`gemini-2.5-flash-preview-tts` / `gemini-2.5-flash-tts`) |
| Gemini 3.1 Flash TTS | **3 RPM · 10K TPM · 10 RPD** | Docs actuales: `gemini-3.1-flash-tts-preview`; **sí** aparece con free tier en pricing |
| Gemini 2.5 Pro TTS | No asumir free | Docs de terceros: sin free tier |

Fuente interna: tabla «Multimodal / generación» de [GEMINI_API_FREE_TIER_LIMITS_KIDEPIK](../operations/GEMINI_API_FREE_TIER_LIMITS_KIDEPIK.md). Los ids **se confirman** contra [modelos](https://ai.google.dev/gemini-api/docs/models) en implementación; no hardcodear RPD.

Capacidades útiles para dictado:

- Salida audio (`response_format: audio` / `responseModalities: AUDIO`).
- Voces prebuilt en pool mixto (p. ej. `Kore`, `Aoede`, `Puck`, `Fenrir`); **una** voz por `dictation_id` (hash estable).
- Prompt de estilo («Speak slowly, pause between sentences»).
- Idiomas: la línea Gemini TTS documenta **90+** con detección; **es-ES** está en Cloud Gemini-TTS como GA. Forzar `language: es-ES` cuando el SDK lo exponga.
- PCM 24 kHz típico → envolver WAV en servidor.

Cuota: **10 generaciones/día por modelo**. Dos modelos en lista ≈ **20/día** si rotan. Replay **no** debe llamar a la API.

### B. Cloud Text-to-Speech (Chirp 3 / Standard / WaveNet) — **reserva**

| Voz | Free típico (caracteres/mes) | Requisito |
| --- | --- | --- |
| Standard | ~4 M | API Cloud TTS + proyecto GCP **con facturación** (el free no evita activar billing) |
| WaveNet / Chirp 3 HD | ~1 M c/u | Idem; `es-ES` y `es-US` disponibles |

**No** entra en POC: otra autenticación (`gcloud` ADC / service account), no el `GEMINI_API_KEY`. Reabrir solo si el RPD de Gemini TTS asfixia el dictado en uso real.

### C. Gemini Live / Native Audio Dialog — **descartado para dictado**

Pensado para conversación full-duplex, no para un WAV cacheable de un párrafo. Complejidad y producto distintos.

### D. Web Speech API (`speechSynthesis`) — **descartado como primario**

No es modelo Google, calidad `es-ES` depende del OS, no hay cache de servidor ni logs `ai`.

## Objetivo

1. Lista ordenada de modelos TTS Gemini free (`AI_GEMINI_TTS_MODEL_LIST`).
2. Síntesis **una vez** por `dictation_id`; persistir bajo `web/media/audio/`.
3. Clasificar 429/cuota igual que el gateway de texto; no mezclar ids TTS en `GEMINI_PURPOSE_MODEL_DEFAULTS` de diálogo.
4. El cliente solo hace `GET /media/audio/...`.

---

## 1. Decisiones

| # | Decisión | Valor |
| --- | --- | --- |
| T1 | Proveedor POC | Gemini API AI Studio (misma `GOOGLE_API_KEY`) |
| T2 | Primario | `gemini-3.1-flash-tts-preview` (ajustar id si Google renombra) |
| T3 | Fallback | `gemini-2.5-flash-preview-tts` / `gemini-2.5-flash-tts` |
| T4 | Cloud TTS | **Fuera de POC** |
| T5 | Cache | Obligatorio. Clave = `dictation_id`. Replay = fichero |
| T6 | Formato disco | WAV PCM 16-bit 24 kHz mono (o OGG si el SDK entrega opus estable) |
| T7 | Voz | Aleatoria entre pool **femenino** (Kore, Aoede, Leda, Callirrhoe) y **masculino** (Puck, Charon, Fenrir, Orus). Estable por `dictation_id` (replay = misma voz). Idioma `es-ES`. Sin selector tutor en MVP |
| T8 | Estilo | Prompt: dictado escolar, ritmo lento, pausa entre oraciones, sin teatralidad |
| T9 | Mock | Prohibido en Docker producto. Tests: fake bytes + no red |
| T10 | Fallo total de lista | `ai_quota_exhausted` / `ai_provider_unavailable`; **no hay dictado** esa vez; el viaje **sigue** ([SPEC_APP_DICTATION](SPEC_APP_DICTATION.md) D7) |

---

## 2. Configuración

| Variable | Default | Uso |
| --- | --- | --- |
| `AI_GEMINI_TTS_MODEL_LIST` | CSV T2,T3 | Override |
| `AI_TTS_VOICE` | p. ej. `Kore` | Id de voz prebuilt |
| `AI_TTS_LANGUAGE` | `es-ES` | Si el SDK lo soporta |

Añadir a `.env.poc.sample` (sin secretos).

`GEMINI_PURPOSE_MODEL_DEFAULTS["dictation_tts"]` = lista TTS **solo**. No interpolar Flash de texto: un id no-TTS con `AUDIO` falla 400.

---

## 3. Servicio

```
backend/app/ai/
  tts_gateway.py     # lista TTS, classify errors, synthesize
backend/app/services/
  dictation_audio.py # cache path, write WAV, public_url
```

Firma mínima:

```python
def synthesize_dictation_audio(
    *,
    dictation_id: str,
    text: str,
    style_instruction: str,
    user_id: str,
) -> SynthesizeResult:  # audio_url | skipped_quota | error
```

Si el fichero ya existe → return URL, **cero** llamadas.

Logs `ai`: `llm_attempt` con `purpose=dictation_tts`, `ok`, `model`, `duration_ms`, `chars`. Sin volcar el texto canónico en `info`.

---

## 4. Media

Categoría existente `audio` ([SPEC_MEDIA_STORAGE](SPEC_MEDIA_STORAGE.md)). Escritura **servidor** (no `prepare-upload` del niño).

Ruta: `/media/audio/{user_id}/{dictation_id}.wav`

nginx ya sirve `/media/`. Auth de lectura: en POC el path no es adivinable (uuid); no es secreto. No listar directorios.

---

## 5. Criterios de aceptación

1. Smoke local: un párrafo es-ES → WAV reproducible en el player de play (mock o clave real en staging).
2. Segunda petición mismo `dictation_id` → 0 llamadas Gemini (test con fake).
3. Primario 429 RPD → intenta el segundo; ambos en log.
4. Lista agotada → D7 del dictado, no 500 opaco.
5. `dictation_tts` no aparece en la lista de `mentor_guide`.

## Aprobación

- [x] Gemini TTS Flash (AI Studio) como único motor POC *(6 sep 2026)*
- [x] Cache por dictation_id
- [x] Cloud TTS / Live API / Web Speech fuera de este corte
