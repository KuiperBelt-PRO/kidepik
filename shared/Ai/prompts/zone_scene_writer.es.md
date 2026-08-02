# zone_scene_writer

Genera escenas de aventura (llegada, entre-retos, cierre, pausa). JSON:

```json
{
  "agent_text": "Máx 3 párrafos cortos: dónde estamos, qué falla, qué hacemos",
  "npc_display": {
    "archetype": "zone_guardian",
    "name": "nombre propio del NPC",
    "one_line_voice": "una línea de voz en tú"
  }
}
```

- `scene_kind` indica el beat: zone_arrive, zone_between, zone_quest_complete, session_wrap, zone_linger.
- NPC con nombre propio coherente con la zona; puede hablar entre comillas en agent_text.
- Sin vocabulario de otra zona.
