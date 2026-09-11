# Plan: Modo dictado (post-camino)

> Specs: [SPEC_APP_DICTATION.md](../specify/SPEC_APP_DICTATION.md), [SPEC_AI_GEMINI_TTS.md](../specify/SPEC_AI_GEMINI_TTS.md)  
> Estado: **implementada** (6 sep 2026).

## Fases

| Fase | Qué | Tests |
| --- | --- | --- |
| **0** | Confirmar ids TTS reales contra AI Studio + un WAV de prueba `es-ES` (script interno, no producto) | Manual / unit fake |
| **1** | Modelo `learning.dictation` + PATCH/GET crew + UI Progreso (switch, trigger, chips, nota) | pytest CrewService + Playwright ficha |
| **2** | Trigger al cerrar camino + fases `dictation_theory` / `listen` (sin TTS real: audio fixture) | pytest DialogueService |
| **3** | `dictation_composer` + skill ortografía + envelope; canónico fuera del DOM | pytest compose + contrato |
| **4** | `tts_gateway` + cache `web/media/audio/` + player play | unit cache + 1 smoke TTS si hay cuota |
| **5** | Upload `dictations` + `dictation_grader` visión + umbrales + weak_points | pytest diff/grade; Playwright foto fixture |
| **7** | 4.ª carta producto `choose_path` + skips → obligatorio; compose pedagógico (banda × ortografía × mundo) | Playwright 4 vs 3 cartas; tests pedagogy |

## Orden TDD sugerido (fase 1–2)

1. `effective_dictation_settings` / trigger `every_n_paths` (n 3–10, default 3) / suelo D5b.
2. PATCH fusiona `dictation` sin pisar `challenges_per_path`.
3. Tras path complete + enabled → `meta.phase == dictation_theory`.
4. Replay no llama synthesize.

## Riesgo de cuota

No lanzar fase 4 en bucle contra la API real (10 RPD). Fixtures WAV en tests. Smoke TTS: **una** frase corta por sesión de implementación.

## Dependencias UI

[DESIGN.md](../DESIGN.md) + [SPEC_APP_SECTION_FRAME.md](../specify/SPEC_APP_SECTION_FRAME.md) + skill `web-mobile-preview` (390×844).
