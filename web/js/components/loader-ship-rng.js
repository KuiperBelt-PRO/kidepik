/**
 * PRNG determinista mulberry32.
 * @param {number} seed
 * @returns {() => number} Valor en [0, 1).
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {() => number} rng
 * @param {number} min
 * @param {number} max
 */
export function randRange(rng, min, max) {
  return min + (max - min) * rng();
}

/**
 * @param {() => number} rng
 * @param {number[]} items
 */
export function randPick(rng, items) {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

/**
 * @param {string} text
 */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
