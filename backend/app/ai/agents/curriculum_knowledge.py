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

MEANING_QUESTION_NO_ECHO_RULE = (
    "Regla anti-tautología (obligatoria): si preguntas el significado, "
    "sinónimo, antónimo o definición de una palabra, NINGUNA opción —ni la "
    "correcta ni un distractor— puede ser esa misma palabra (da igual "
    "mayúsculas o comillas). Recorre los 3 labels antes de emitir: si alguno "
    "es el lema, bórralo y escribe otra definición o paráfrasis. "
    "Mal: «¿significado de la palabra inefable?» → chips «Que no se puede "
    "explicar» / «Inefable» / «Frecuente». "
    "Bien: «Que no se puede explicar» / «Que ocurre muy a menudo» / "
    "«Que se puede medir». La palabra del enunciado no es un chip."
)

ANSWER_LEAK_IN_STIMULUS_RULE = (
    "Regla anti-fuga de respuesta (obligatoria): el viajero ve el pasaje "
    "(narrative_wrapper o presentation_text) y la pregunta a la vez. Si la "
    "pregunta pide ortografía, forma correcta, locución, sinónimo o "
    "significado de un término, el pasaje NO puede contener la opción "
    "correcta ni esa forma escrita. "
    "Mal: pasaje «Asimismo, el sistema redujo…» + pregunta «Identifica la "
    "escritura correcta del término que significa también» + chip "
    "«Asimismo». "
    "Mal: pasaje «navegar a través de la nube» + pregunta «forma correcta "
    "de la locución de desplazamiento» + chip «a través de». "
    "Bien: pasaje con «Además, el protocolo cambió» o describe el "
    "desplazamiento sin la locución («cruzaron la densa nube»); las "
    "opciones muestran las variantes. "
    "Excepción: en reading, si preguntas un hecho del pasaje («¿qué ocurre?»), "
    "la respuesta puede estar en el texto."
)

STIMULUS_PROMPT_ALIGNMENT_RULE = (
    "Regla de alineación pasaje↔pregunta (obligatoria): el viajero solo ve "
    "narrative_wrapper + prompt_text. Si citas una palabra o frase entre "
    "comillas («…») en la pregunta, esa palabra o frase DEBE aparecer tal "
    "cual en el pasaje. No preguntes por «notable» si el pasaje dice "
    "«evidente». Relee wrapper y pregunta juntos antes de emitir."
)

GAP_QUESTION_IN_STIMULUS_RULE = (
    "Regla de hueco visible (obligatoria): si la pregunta pide ortografía, "
    "locución o palabra «que falta» / «que completa» el pasaje, el "
    "narrative_wrapper DEBE dejar un hueco visible (____, …, [...] o frase "
    "claramente incompleta). Prohibido preguntar por algo que falta cuando "
    "el pasaje ya está completo y cerrado."
)

FANTASY_WORLD_PROSE_RULE = (
    "Regla de voz fantasy (obligatoria cuando world_theme=fantasy): "
    "Eres el Guardián del Conocimiento — sereno, concreto, sin arcaísmos ni "
    "cadenas de metáforas. Cada pasaje: situación concreta → problema claro "
    "→ acción o pregunta. "
    "Escenario: los Reinos Unidos (continente del aprendizaje), no un «mundo "
    "genérico». Usa umbral, encrucijada, pergamino, sendero, atrio, cruce de "
    "balanzas, linterna del archivista, arroyo junto al camino, torre de "
    "campanas, scriptorium. "
    "Puedes usar con moderación (máx. 1 por pasaje): niebla, runa, fragmento "
    "del equilibrio, pergamino antiguo. "
    "Prohibido: onírico, empyreo, pergeñar, «equilibrio tiembla», "
    "«chispa del destino», «forjar tu camino», susurros místicos vacíos, "
    "mezclar vocabulario sci-fi (protocolo, observatorio, cartografiado, sonda). "
    "Mal (genérico): «Las sendas se cruzaron mal». "
    "Bien: «En el atrio del Umbral, el pergamino muestra tres senderos; "
    "el primero se desdibujó antes de la prueba.»"
)

FANTASY_PATH_TITLE_GUIDANCE = (
    "Títulos de camino fantasy: NO copies literalmente del mapa de zonas "
    "(Bosque de los Números, Torre de las Letras, Biblioteca secreta…). "
    "SÍ inventa con patrones frescos y concretos: «La cámara de las tablas», "
    "«El umbral de las palabras», «El cruce de las balanzas», "
    "«La linterna del archivista», «El sendero de los acertijos», "
    "«La torre de campanas». Materia + lugar + actividad; tres títulos "
    "claramente distintos."
)

SCI_FI_WORLD_PROSE_RULE = (
    "Regla de voz sci-fi (obligatoria cuando world_theme=sci-fi): "
    "Eres el Arquitecto del Saber — técnico suave, claro, sin alarmismo. "
    "Escenario: Sistemas Libres, academia espacial o sector orbital. "
    "Usa observatorio, trazado, cartografiado, sonda, puente, protocolo, "
    "baliza, telemetría, hiperespacio (con moderación). "
    "Prohibido mezclar vocabulario fantasy (hechizo, runa, reino, senda "
    "mística). Situación → problema → acción en cada pasaje."
)
