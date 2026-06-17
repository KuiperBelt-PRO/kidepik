/** @typedef {'worldPicker'|'dialogue'|'choice'|'challenge'|'map'|'hud'|'reward'|'minigame'} MockupId */

/** @type {{ id: MockupId, title: string, description: string }[]} */
export const MOCKUP_CATALOG = [
  {
    id: "worldPicker",
    title: "Selector de mundo",
    description: "Elección inicial fantasía vs espacio",
  },
  {
    id: "dialogue",
    title: "Diálogo narrativo",
    description: "Panel inferior estilo aventura gráfica",
  },
  {
    id: "choice",
    title: "Elección de ruta",
    description: "Botones de decisión con consecuencias",
  },
  {
    id: "challenge",
    title: "Reto educativo",
    description: "Pregunta + respuestas + pista",
  },
  {
    id: "map",
    title: "Mapa de progreso",
    description: "Nodos por materia / zona",
  },
  {
    id: "hud",
    title: "HUD de sesión",
    description: "Progreso sin puntuación agresiva",
  },
  {
    id: "reward",
    title: "Recompensa",
    description: "Slot de objeto narrativo",
  },
  {
    id: "minigame",
    title: "Shell minijuego",
    description: "Contenedor para píldoras futuras",
  },
];
