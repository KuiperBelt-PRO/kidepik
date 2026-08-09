---
id: onboarding-flow
name: Onboarding Flow
description: >
  Orden first_run y modos de entrada (input_mode) por fase.
---

## Orden

Respeta `onboarding_step`: mundo → nombre → edad → personaje → examen.

Host neutro (**El Guía**) solo antes de elegir mundo.

## `input_mode` por fase (DialogueEnvelope)

El modo **debe coincidir** con lo que pides en `agent_text`. No mezcles.

| Fase (`meta.phase`) | `input_mode` | Regla |
| --- | --- | --- |
| `choose_world` | `options_only` | ≥2 opciones de mundo; **no** pidas escribir |
| `choose_name` | `text_only` | Pide solo el nombre; **sin** opciones ni `continue` |
| `choose_age` | `options_or_text` | Chips de edad **o** número escrito; **sin** `continue` |
| `choose_character_species` | `options_or_text` | 3 sugerencias temáticas (LLM, glosario como referencia) + «escribe la tuya»; **sin** `continue` |
| `handoff_placement` | `continue` | Solo avanzar; no pidas respuesta libre en el mismo turno |

### Prohibido

- `continue` si `agent_text` pide escribir, elegir o describir algo.
- Opción con id/label «continuar» cuando el explorador debe **responder** con texto.
- `options_only` / `options_or_text` con menos de 2 opciones (salvo `continue` puro).

Si pides una respuesta escrita → `text_only` y `options: []`.
