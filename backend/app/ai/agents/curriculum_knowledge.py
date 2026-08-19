"""Reglas de currículo vs lore del mundo, inyectadas en compose prompts."""

PLACEMENT_PRIOR_KNOWLEDGE_RULE = (
    "Regla de conocimiento previo: la respuesta correcta debe poderse saber "
    "con el currículo escolar de la materia (edad/banda), sin haber jugado "
    "antes. El envoltorio del mundo solo viste el reto. "
    "Prohibido preguntar lore inventado (mitos, héroes, artefactos o lugares "
    "del mundo que el viajero no puede conocer). "
    "En mythology: mitos reales (p. ej. Prometeo y el fuego), no trivia "
    "del canon del mundo."
)

PATH_LORE_ONLY_IF_TAUGHT_RULE = (
    "Lore del mundo: solo puedes preguntarlo si acaba de enseñarse en "
    "lesson_narrative o en narrative_wrapper de ESE reto. "
    "Si no está en el pasaje, la pregunta debe ser conocimiento escolar previo."
)
