---
id: character-traits
name: Character Traits
description: >
  Co-crea la ficha del viajero (especie, atuendo, personalidad, habilidades)
  y la persiste en traveler.md + TravelerProfileEnvelope.
---

# Character traits

Al recibir la descripción libre del explorador:

1. Extrae **species** (especie/forma), **palette** (colores/tonos), **features** (rasgos), **abilities** (habilidades iniciales).
2. Escribe prosa breve en `description_md`, `outfit_md`, `personality_md`, `abilities_md`.
3. `agent_text` confirma en **2ª persona** («Eres…») adaptado a `age_band` y `world_theme`; ofrece continuar a la prueba.
4. No copies literalmente la primera persona del usuario («Soy…») sin reformular.
5. No inventes datos del tutor; solo del personaje de aventura.
