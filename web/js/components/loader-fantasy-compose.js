/**
 * Composición por grafo de construcción ordenada.
 *
 * Los castillos/palacios se ensamblan colocando **módulos** (piezas sueltas)
 * en nodos de un grafo con dependencias (`after`) y secuencia (`order`).
 * Cada módulo emite una o más partes al {@link ElementAssembler}.
 *
 * @module loader-fantasy-compose
 */

/**
 * @typedef {{
 *   id: string;
 *   module: string;
 *   cx: number;
 *   baseY: number;
 *   params?: Record<string, unknown>;
 *   order?: number;
 *   after?: string[];
 * }} ComposeNode
 */

/**
 * @typedef {{
 *   nodes: ComposeNode[];
 *   meta: Record<string, unknown>;
 * }} ConstructionGraph
 */

/**
 * @typedef {{
 *   rng: () => number;
 *   profile: import('./loader-fantasy-castle-factions.js').FactionProfile;
 *   imperfection: number;
 *   jitterAmt: number;
 *   ruined: boolean;
 *   palace: boolean;
 *   asm: import('./loader-fantasy-element.js').ElementAssembler;
 *   arches: { gothic: number; romanesque: number; flat: number; trefoil: number };
 *   counters: { doorCount: number; windowCount: number; slitCount: number };
 * }} ComposeContext
 */

/**
 * @typedef {(ctx: ComposeContext, node: ComposeNode) => void} ModuleFn
 */

/** @type {Record<string, ModuleFn>} */
export const MODULE_REGISTRY = {};

/**
 * @param {string} id
 * @param {ModuleFn} fn
 */
export function registerModule(id, fn) {
  MODULE_REGISTRY[id] = fn;
}

/**
 * @param {Record<string, unknown>} [meta]
 * @returns {ConstructionGraph}
 */
export function createGraph(meta = {}) {
  return { nodes: [], meta: { ...meta } };
}

/**
 * @param {ConstructionGraph} graph
 * @param {ComposeNode} node
 */
export function addNode(graph, node) {
  graph.nodes.push(node);
}

/**
 * Ordena nodos respetando `after` y desempata con `order`.
 * @param {ComposeNode[]} nodes
 * @returns {ComposeNode[]}
 */
export function sortGraphNodes(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  /** @type {ComposeNode[]} */
  const result = [];
  const visited = new Set();

  /** @param {ComposeNode} n */
  function visit(n) {
    if (visited.has(n.id)) return;
    for (const depId of n.after ?? []) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    visited.add(n.id);
    result.push(n);
  }

  const sorted = [...nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const n of sorted) visit(n);
  return result;
}

/**
 * Ejecuta un grafo de construcción sobre un ensamblador.
 * @param {ConstructionGraph} graph
 * @param {ComposeContext} ctx
 */
export function executeGraph(graph, ctx) {
  const ordered = sortGraphNodes(graph.nodes);
  for (const node of ordered) {
    const fn = MODULE_REGISTRY[node.module];
    if (!fn) {
      throw new Error(`Módulo desconocido: ${node.module}`);
    }
    fn(ctx, node);
  }
}
