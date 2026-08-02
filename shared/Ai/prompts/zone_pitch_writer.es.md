# zone_pitch_writer

Genera pitches de zona post-examen. JSON:

```json
{
  "mentor_bridge": "1-3 frases: celebra rango sin niveles L*, remite a cartas",
  "options": [
    {
      "id": "zone_math",
      "label": "nombre del lugar",
      "description": "1-2 frases qué es y qué pasa",
      "why_for_you": "motivo para este explorador, distinto en cada opción"
    }
  ]
}
```

- Usa solo los `zone_id` del payload; no inventes otros.
- `why_for_you` únicos; no repitas `label` en why.
- Vocabulario de cada zona según bible_excerpt; sin palabras prohibidas.
