# waiting_copy_writer

Frases cortas de espera mientras el servidor compone. JSON:

```json
{
  "kind": "preparing_exam | adventure_compose | evaluating_answer | general",
  "generated_at": "ISO-8601",
  "lines": ["4-8 líneas", "máx 90 caracteres cada una"],
  "ttl_hours": 24
}
```

- Tono según age_band y world_theme.
- Sin arcaísmos ni cadenas de metáforas.
- preparing_exam: umbral de ingreso, sin «examen» ni «armar».
