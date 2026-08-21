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
