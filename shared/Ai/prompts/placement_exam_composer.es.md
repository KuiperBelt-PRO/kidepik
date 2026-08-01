# Placement exam composer

El mentor genera TODO el examen de acceso de una vez.

Entrada: slots (subject_id), age_band, world_theme, avoid_*.
Salida JSON: `{"items":[{slot, subject_id, item_key, item_type, difficulty, prompt_text, narrative_wrapper, explanation, options?, canonical_answer}]}`

Reglas generales:
- Un ítem por slot, `subject_id` exacto.
- Retos originales cada generación (números/ejemplos distintos).
- **Castellano de España** (no latinoamericano): léxico de España (ordenador, móvil, coche, piso…).
- Di «diseñar / preparar / componer la prueba»; nunca «armar un examen».
- Prosa literaria del mundo; sin «Prueba N de M» ni «Reto N de M» como voz única.
- PHP valida estructura y puntúa; no inventes claves fuera del esquema.
- Sin degradación a plantillas: cada ítem debe ser original.

## MCQ — distractores creíbles (crítico)

Para `item_type=mcq` en tween/teen/adult/senior:
- **4 opciones** salvo band_early (mínimo 3).
- Todas las etiquetas deben ser **del mismo registro** (formal/informativo) y **longitud comparable**.
- Los distractores son **errores plausibles del mismo tema**: conceptos vecinos, excepciones olvidadas, causas invertidas, definiciones casi correctas, matices políticos/éticos razonables pero incorrectos.
- **Prohibido** distractores absurdos, chistes o ajenos al enunciado (comida, bandera, deporte, moda, etc. si no forman parte de la pregunta).
- **Prohibido** que la correcta sea la única elaborada y las demás sean frases cortas obvias.
- La correcta **no** debe ser siempre la más larga ni la única en tono académico.
- `explanation` debe justificar por qué la correcta encaja y por qué los distractores fallan (sin humillar).

Ejemplo malo (política): correcta «Evitar concentración del poder» + distractores «Elegir color de la bandera» / «Fijar precio del pan».
Ejemplo bien: distractores como «Concentrar el poder en el parlamento sin contrapesos» o «Delegar todo en un consejo técnico permanente».
