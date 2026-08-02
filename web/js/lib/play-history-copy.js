/**
 * Copy tematizado del botón de historial paginado en play.
 * @module play-history-copy
 */

/** @typedef {'early' | 'child' | 'teen' | 'adult'} HistoryToneBand */
/** @typedef {'neutral' | 'fantasy' | 'sci-fi'} HistoryWorldKey */

/** @type {Record<HistoryWorldKey, Record<HistoryToneBand, { idle: string[], loading: string[] }>>} */
export const PLAY_HISTORY_COPY = Object.freeze({
  fantasy: {
    early: {
      idle: ["Recordar el camino", "¿Qué pasó antes?", "Ver lo de antes", "El camino de atrás"],
      loading: ["Desenrollando el pergamino…", "Un momentito…"],
    },
    child: {
      idle: ["Recordar el camino", "Ecos del sendero", "Lo que quedó atrás", "Recuerdos del viaje"],
      loading: ["Desenrollando el pergamino…", "Buscando en el mapa…"],
    },
    teen: {
      idle: ["Recordar el camino", "Hojas anteriores", "Volver al pergamino", "Ecos del sendero"],
      loading: ["Desenrollando el pergamino…", "Consultando el diario…"],
    },
    adult: {
      idle: ["Recordar el camino", "Hojas anteriores", "Recuerdos del viaje", "Volver al pergamino"],
      loading: ["Desenrollando el pergamino…", "Consultando el diario…"],
    },
  },
  "sci-fi": {
    early: {
      idle: ["Crónicas anteriores", "Ver lo de antes", "¿Qué pasó antes?", "Mensajes de antes"],
      loading: ["Recuperando crónicas…", "Un momentito…"],
    },
    child: {
      idle: ["Crónicas anteriores", "Registros previos", "Recuperar transmisión", "Lo que quedó atrás"],
      loading: ["Recuperando crónicas…", "Leyendo el archivo…"],
    },
    teen: {
      idle: ["Crónicas anteriores", "Registros previos", "Recuperar transmisión", "Ampliar memoria"],
      loading: ["Recuperando crónicas…", "Sincronizando registro…"],
    },
    adult: {
      idle: ["Crónicas anteriores", "Registros previos", "Archivo de misión", "Recuperar transmisión"],
      loading: ["Recuperando crónicas…", "Sincronizando registro…"],
    },
  },
  neutral: {
    early: {
      idle: ["Ver mensajes anteriores", "¿Qué pasó antes?", "Ver lo de antes"],
      loading: ["Cargando…", "Un momentito…"],
    },
    child: {
      idle: ["Ver mensajes anteriores", "Mensajes de antes", "Lo que quedó atrás"],
      loading: ["Cargando…", "Un momentito…"],
    },
    teen: {
      idle: ["Ver mensajes anteriores", "Historial anterior", "Mensajes previos"],
      loading: ["Cargando…"],
    },
    adult: {
      idle: ["Ver mensajes anteriores", "Historial anterior", "Mensajes previos"],
      loading: ["Cargando…"],
    },
  },
});

/** @type {Record<string, HistoryToneBand>} */
const AGE_BAND_TO_TONE = Object.freeze({
  band_early: "early",
  band_child: "child",
  band_tween: "teen",
  band_teen: "teen",
  band_adult: "adult",
  band_senior: "adult",
});

/**
 * @param {string | null | undefined} ageBand
 * @returns {HistoryToneBand}
 */
export function historyToneFromAgeBand(ageBand) {
  if (typeof ageBand === "string" && ageBand in AGE_BAND_TO_TONE) {
    return AGE_BAND_TO_TONE[ageBand];
  }
  return "child";
}

/**
 * @param {'fantasy' | 'sci-fi' | null | undefined} worldTheme
 * @returns {HistoryWorldKey}
 */
export function historyWorldKey(worldTheme) {
  if (worldTheme === "fantasy" || worldTheme === "sci-fi") return worldTheme;
  return "neutral";
}

/**
 * @param {string[]} pool
 * @param {() => number} [random]
 * @returns {string}
 */
export function pickHistoryCopy(pool, random = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return "";
  const index = Math.floor(random() * pool.length);
  return pool[Math.max(0, Math.min(pool.length - 1, index))] ?? pool[0];
}

/**
 * @param {'fantasy' | 'sci-fi' | null | undefined} worldTheme
 * @param {string | null | undefined} ageBand
 * @param {'idle' | 'loading'} kind
 * @param {() => number} [random]
 * @returns {string}
 */
export function resolveHistoryCopy(worldTheme, ageBand, kind, random = Math.random) {
  const world = historyWorldKey(worldTheme);
  const tone = historyToneFromAgeBand(ageBand);
  const pool = PLAY_HISTORY_COPY[world]?.[tone]?.[kind] ?? [];
  return pickHistoryCopy(pool, random);
}

/**
 * @param {'fantasy' | 'sci-fi' | null | undefined} worldTheme
 * @returns {string}
 */
export function historyErrorCopy(worldTheme) {
  const world = historyWorldKey(worldTheme);
  if (world === "fantasy") return "No se pudo recordar el camino";
  if (world === "sci-fi") return "No se pudieron recuperar las crónicas";
  return "No se pudo cargar el historial";
}
