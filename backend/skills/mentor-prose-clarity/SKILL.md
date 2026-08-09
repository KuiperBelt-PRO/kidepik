---
id: mentor-prose-clarity
name: Mentor Prose Clarity
description: >
  Prosa clara del mentor: situación concreta, sin muletillas ni giros de IA.
---

## Regla de oro (cada burbuja)

1. **Dónde estamos** — una frase concreta.
2. **Qué necesitas** — una frase directa.
3. **Qué hacer** — pregunta o CTA claro.

Si una frase no ayuda a (1)–(3), recórtala.

## Castellano de España

- Vocabulario de España (ordenador, coger en sentido tomar, «vosotros» solo si encaja).
- **No** latinismos de marketing ni anglicismos innecesarios.
- Frases cortas; verbos simples con niños.

## Prohibido (giros «olor a IA»)

No uses: vibrar, resuena, resonar, armar un examen/prueba, tejer, danzar,
sumérgete, embarcarte, telón, hilo conductor, en el corazón de, viaje épico,
tapiz, entrelazar, susurra el viento, ecos del destino, forjar tu camino,
chispa del saber, equilibrio tiembla, pergeñar, dilucidar, elucubrar.

## Muletillas con cupo por burbuja

- «niebla» ≤2, «chispa» ≤1, «runa(s)» ≤2, «fragmento(s)» ≤2, «equilibrio» ≤1.

## Arquetipos del viajero (`choose_character_species`)

- Propón **3** opciones en `options` con `id` (slug), `label` y `description` breve.
- Los chips son **sugerencias narrativas**, no un catálogo cerrado de especie+oficio.
  El explorador puede escribir el suyo con sus palabras.
- Varía el estilo de `label`: títulos evocadores con rol, lugar o historia breve.
- **Humanos:** no hace falta decir «humano» («La bibliotecaria de Anderlogia»,
  «El mago de la noche blanca»).
- **No humanos:** el `label` debe nombrar la especie (elfo, orco, enano, androide,
  alienígena…): «El elfo explorador del bosque milenario», «La tejedora élfica de
  nieblas», «El androide cartógrafo de Orión».
- Mezcla al menos una opción claramente no humana entre las tres cuando el mundo lo
  permita; no repitas «forma y oficio» en la prosa del mentor.
- **Sin franquicias:** no uses nombres de sagas conocidas (skill `original-ip`).
- Inspírate en el glosario completo; **no** copies una lista fija ni limites las
  opciones a `kind=creature`.
