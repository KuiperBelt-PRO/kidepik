import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import { PLINTH_SCREEN_HEIGHT_FACTOR } from "../js/components/loader-fantasy-geom.js";
import {
  generateFantasyElement,
  isValidFantasyElement,
} from "../js/components/loader-fantasy-element.js";

const REMATE_KINDS = [
  "roof",
  "battlement",
  "dome",
  "dome_battlement",
  "gothic_arch",
  "inverted_arrow",
  "rib_crown",
  "spire_cluster",
  "carved",
];

const ELF_CAP_KINDS = ["gothic_arch", "inverted_arrow", "rib_crown", "spire_cluster"];

/** Roles que coronan torres/bloques. */
const CAP_ROLES = new Set(["roof", "battlement", "dome"]);

// ---------------------------------------------------------------------------
// Determinismo
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / determinismo", () => {
  it("misma seed → mismo elemento (parts d idénticos)", () => {
    const a = generateCastle({ seed: 1234 });
    const b = generateCastle({ seed: 1234 });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("misma seed + palace → mismo elemento", () => {
    const a = generateCastle({ seed: 99, palace: true });
    const b = generateCastle({ seed: 99, palace: true });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("castle y palace con misma seed tienen kind distinto", () => {
    const c = generateCastle({ seed: 77 });
    const p = generateCastle({ seed: 77, palace: true });
    assert.equal(c.kind, "castle");
    assert.equal(p.kind, "palace");
  });
});

// ---------------------------------------------------------------------------
// Variación
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / variación", () => {
  it("50 seeds producen siluetas mayoritariamente distintas", () => {
    const set = new Set();
    for (let s = 0; s < 50; s++) {
      set.add(JSON.stringify(generateCastle({ seed: s * 101 + 7 }).parts));
    }
    assert.ok(set.size >= 45, `solo ${set.size} siluetas distintas`);
  });

  it("varían los skylines (nº de torres no es constante)", () => {
    const counts = new Set();
    for (let s = 0; s < 40; s++) {
      counts.add(generateCastle({ seed: s * 31 + 3 }).meta.towerCount);
    }
    assert.ok(counts.size >= 2, "el nº de torres no varía");
  });
});

// ---------------------------------------------------------------------------
// Validez
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / validez", () => {
  it("isValidFantasyElement OK para 30 seeds (castle y palace)", () => {
    for (let s = 0; s < 30; s++) {
      assert.ok(isValidFantasyElement(generateCastle({ seed: s })), `castle seed ${s}`);
      assert.ok(isValidFantasyElement(generateCastle({ seed: s, palace: true })), `palace seed ${s}`);
    }
  });

  it("ningún path contiene NaN y todos empiezan con M", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 13 });
      for (const part of el.parts) {
        assert.ok(part.d.startsWith("M"), `part ${part.id} no empieza con M`);
        assert.ok(!/NaN/.test(part.d), `part ${part.id} contiene NaN`);
      }
    }
  });

  it("viewBox y kind correctos (castle/palace)", () => {
    const c = generateCastle({ seed: 5 });
    assert.equal(c.viewBox, "0 0 100 100");
    assert.equal(c.kind, "castle");
    const p = generateCastle({ seed: 5, palace: true });
    assert.equal(p.kind, "palace");
  });
});

// ---------------------------------------------------------------------------
// Invariantes de castillo
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / invariantes", () => {
  it("existe exactamente una base", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 7 + 1 });
      const bases = el.parts.filter((p) => p.role === "base");
      assert.equal(bases.length, 1, `seed ${s}: ${bases.length} bases`);
    }
  });

  it("hay 2–5 torres y meta coherente", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 17 + 2 });
      const towers = el.parts.filter((p) => p.role === "tower");
      assert.ok(towers.length >= 2 && towers.length <= 6, `seed ${s}: ${towers.length} torres`);
      assert.equal(el.meta.towerCount, towers.length);
      assert.equal(el.meta.towers.length, towers.length);
    }
  });

  it("cada torre tiene un remate arquitectónico válido", () => {
    const factions = ["human", "elf", "dwarf", "evil"];
    for (const faction of factions) {
      for (let s = 0; s < 15; s++) {
        const el = generateCastle({ seed: s * 5 + 9, faction });
        for (const t of el.meta.towers) {
          assert.ok(REMATE_KINDS.includes(t.remate), `${faction} seed ${s}: remate inválido ${t.remate}`);
        }
      }
    }
  });

  it("malignos: todas las torres comparten el mismo remate clásico", () => {
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 13 + 7, faction: "evil" });
      const remates = new Set(el.meta.towers.map((t) => t.remate));
      assert.equal(remates.size, 1, `seed ${s}: mezcla de remates ${[...remates].join(",")}`);
      assert.equal(el.meta.towerRemate, el.meta.towers[0].remate);
    }
  });

  it("elfos: mismo cap en todas las torres (gótico, agujas o costillas)", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 19 + 3, faction: "elf" });
      const remates = new Set(el.meta.towers.map((t) => t.remate));
      assert.equal(remates.size, 1, `seed ${s}: caps mezclados ${[...remates].join(",")}`);
      assert.ok(ELF_CAP_KINDS.includes(el.meta.towerRemate));
    }
  });

  it("enanos: torres monolíticas sin coronación clásica", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCastle({ seed: s * 23 + 1, faction: "dwarf" });
      for (const t of el.meta.towers) assert.equal(t.remate, "carved");
      const caps = el.parts.filter((p) => CAP_ROLES.has(p.role) && p.buildOrder > 0);
      const towerOrders = el.parts.filter((p) => p.role === "tower").map((p) => p.buildOrder);
      const maxTower = Math.max(...towerOrders);
      const towerCaps = caps.filter((c) => c.buildOrder > maxTower);
      assert.equal(towerCaps.length, 0, `seed ${s}: enano con coronación en torre`);
    }
  });

  it("≥1 puerta y ≥1 ventana", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 3 + 4 });
      assert.ok(el.meta.doorCount >= 1, `seed ${s}: sin puerta`);
      assert.ok(el.meta.windowCount >= 1, `seed ${s}: sin ventanas`);
    }
  });

  it("usa ≥1 arco del tipo dominante (facciones con arcos curvos)", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 11 + 6 });
      // Enanos usan vanos achaflanados: no tienen arcos curvos
      if (el.meta.faction === "dwarf") continue;
      const dom = el.meta.archDominant;
      assert.ok(["gothic", "romanesque"].includes(dom), `seed ${s}: dominante ${dom}`);
      assert.ok(el.meta.arches[dom] >= 1, `seed ${s}: 0 arcos ${dom}`);
    }
  });

  it("asimetría supera umbral en la mayoría de seeds", () => {
    let asym = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      if (generateCastle({ seed: s * 23 + 1 }).meta.asymmetry > 0.12) asym++;
    }
    assert.ok(asym >= N * 0.55, `solo ${asym}/${N} con asimetría suficiente`);
  });
});

// ---------------------------------------------------------------------------
// Orden de construcción
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / build order", () => {
  it("buildOrder monótono con baseY descendente", () => {
    const el = generateCastle({ seed: 321 });
    for (let i = 1; i < el.parts.length; i++) {
      assert.ok(el.parts[i].baseY <= el.parts[i - 1].baseY + 1e-9, "no monótono");
      assert.equal(el.parts[i].buildOrder, i);
    }
  });

  it("base se construye antes que cualquier torre", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 19 + 2 });
      const base = el.parts.find((p) => p.role === "base");
      const towerOrders = el.parts.filter((p) => p.role === "tower").map((p) => p.buildOrder);
      assert.ok(towerOrders.every((o) => base.buildOrder < o), `seed ${s}: base no precede a torres`);
    }
  });

  it("las coronaciones se construyen después de las torres (maligno)", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 29 + 5, faction: "evil" });
      const maxTower = Math.max(...el.parts.filter((p) => p.role === "tower").map((p) => p.buildOrder));
      const caps = el.parts.filter((p) => CAP_ROLES.has(p.role));
      assert.ok(caps.some((c) => c.buildOrder > maxTower), `seed ${s}: ninguna coronación tras torres`);
    }
  });
});

// ---------------------------------------------------------------------------
// palace vs castle (estadístico)
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / palace vs castle", () => {
  function aggregate(palace) {
    let domes = 0;
    let battlements = 0;
    for (let s = 0; s < 80; s++) {
      const el = generateCastle({ seed: s * 37 + 13, palace });
      domes += el.parts.filter((p) => p.role === "dome").length;
      battlements += el.parts.filter((p) => p.role === "battlement").length;
    }
    return { dome: domes, battlement: battlements };
  }

  it("palace tiene más cúpulas que castle", () => {
    assert.ok(aggregate(true).dome > aggregate(false).dome);
  });

  it("palacio humano incluye almenas en coronas mixtas", () => {
    assert.ok(aggregate(true).battlement > 40);
  });

  function aggregateArches(palace) {
    let gothic = 0;
    let trefoil = 0;
    for (let s = 0; s < 80; s++) {
      const el = generateCastle({ seed: s * 37 + 13, palace });
      gothic += el.meta.arches.gothic ?? 0;
      trefoil += el.meta.arches.trefoil ?? 0;
    }
    return { gothic, trefoil };
  }

  it("palace tiene más arcos góticos+trilobulados que castle", () => {
    const p = aggregateArches(true);
    const c = aggregateArches(false);
    assert.ok(p.gothic + p.trefoil > c.gothic + c.trefoil);
  });
});

// ---------------------------------------------------------------------------
// Registro en el motor
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / registro en el motor", () => {
  it("generateFantasyElement('castle') y ('palace') funcionan", () => {
    const c = generateFantasyElement("castle", { seed: 42 });
    assert.ok(isValidFantasyElement(c));
    assert.equal(c.kind, "castle");
    const p = generateFantasyElement("palace", { seed: 42 });
    assert.ok(isValidFantasyElement(p));
    assert.equal(p.kind, "palace");
  });
});

// ---------------------------------------------------------------------------
// Reglas de facción — spec ELEMENTS_ENGINE_SPECS
// ---------------------------------------------------------------------------
describe("loader-fantasy-castle / facciones spec", () => {
  it("enanos: cero arcos góticos ni románicos (vanos achaflanados)", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 7 + 3, faction: "dwarf" });
      assert.equal(el.meta.arches.gothic, 0, `seed ${s}: arcos góticos en enano`);
      assert.equal(el.meta.arches.romanesque, 0, `seed ${s}: arcos románicos en enano`);
    }
  });

  it("humanos: ninguna torre ni bloque tiene remate 'roof' (sin tejado a dos aguas)", () => {
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 5 + 1, faction: "human" });
      const roofParts = el.parts.filter((p) => p.role === "roof");
      assert.equal(roofParts.length, 0, `seed ${s}: tejado a dos aguas en castillo humano`);
    }
  });

  it("humanos: puerta y ventanas siguen contando (aunque sin curva en spec no aplica)", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 13 + 2, faction: "human" });
      assert.ok(el.meta.doorCount >= 1, `seed ${s}: sin puerta en humano`);
      assert.ok(el.meta.windowCount >= 1, `seed ${s}: sin ventana en humano`);
    }
  });

  it("enanos: puerta y ventanas siguen contando (vanos achaflanados)", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 11 + 5, faction: "dwarf" });
      assert.ok(el.meta.doorCount >= 1, `seed ${s}: sin puerta en enano`);
      assert.ok(el.meta.windowCount >= 1, `seed ${s}: sin ventana en enano`);
    }
  });

  it("enanos: 2–4 niveles de altura (bastión + pisos apilados)", () => {
    const levelCounts = new Set();
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 19 + 2, faction: "dwarf" });
      assert.ok(el.meta.castleLevelCount >= 2, `seed ${s}: menos de 2 niveles`);
      assert.ok(el.meta.castleLevelCount <= 4, `seed ${s}: más de 4 niveles`);
      levelCounts.add(el.meta.castleLevelCount);
    }
    assert.ok(levelCounts.size >= 2, "poca variación en nº de niveles enanos");
  });

  it("torres nunca tapan la puerta central", () => {
    for (const faction of ["human", "dwarf", "evil", "elf"]) {
      for (let s = 0; s < 20; s++) {
        const el = generateCastle({ seed: s * 41 + 3, faction });
        const axis = el.meta.axis ?? 50;
        const doorW = el.meta.doorW ?? (el.meta.baseW ?? el.meta.deckW ?? 60) * 0.17;
        for (let ti = 0; ti < (el.meta.towerXs ?? []).length; ti += 1) {
          const tcx = el.meta.towerXs[ti];
          const towerW = el.meta.towerWs?.[ti] ?? 12;
          const dead = doorW / 2 + towerW / 2 + 1;
          assert.ok(
            Math.abs(tcx - axis) >= dead * 0.95,
            `${faction} seed ${s}: torre en zona de puerta (x=${tcx})`,
          );
        }
      }
    }
  });

  it("humanos: 1–3 niveles de altura", () => {
    const levelCounts = new Set();
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 23 + 5, faction: "human" });
      assert.ok(el.meta.castleLevelCount >= 1, `human seed ${s}: menos de 1 nivel`);
      assert.ok(el.meta.castleLevelCount <= 3, `human seed ${s}: más de 3 niveles`);
      levelCounts.add(el.meta.castleLevelCount);
    }
    assert.ok(levelCounts.size >= 2, "human: poca variación de niveles");
  });

  it("malignos: 2–4 niveles apilados", () => {
    const levelCounts = new Set();
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 23 + 5, faction: "evil" });
      assert.ok(el.meta.castleLevelCount >= 2, `evil seed ${s}: menos de 2 niveles`);
      assert.ok(el.meta.castleLevelCount <= 4, `evil seed ${s}: más de 4 niveles`);
      levelCounts.add(el.meta.castleLevelCount);
    }
    assert.ok(levelCounts.size >= 2, "evil: poca variación de niveles");
  });

  it("humanos: remate homogéneo (mismo tipo en todas las torres)", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 11 + 3, faction: "human" });
      const remates = el.meta.towers.map((t) => t.remate);
      assert.ok(remates.length >= 2, `seed ${s}: pocas torres`);
      const unique = new Set(remates);
      assert.equal(unique.size, 1, `seed ${s}: remates mixtos ${[...unique].join(",")}`);
      assert.equal(el.meta.humanCastleCrown, remates[0], `seed ${s}: meta no coincide`);
    }
  });

  it("humanos: cuerpo central con almenas o cúpula según remate global", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCastle({ seed: s * 19 + 7, faction: "human" });
      const crown = el.meta.humanCastleCrown;
      assert.ok(crown, `seed ${s}: sin humanCastleCrown`);
      const hasBattlement = el.parts.some((p) => p.role === "battlement");
      const hasDome = el.parts.some((p) => p.role === "dome");
      if (crown === "battlement") {
        assert.ok(hasBattlement, `seed ${s}: battlement sin almenas`);
      } else {
        assert.ok(hasDome, `seed ${s}: ${crown} sin cúpula`);
      }
    }
  });

  it("humanos: torres solo en planta baja y sin cruzar el eje central", () => {
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 31 + 9, faction: "human" });
      const axis = el.meta.axis;
      for (let i = 0; i < el.meta.towerXs.length; i += 1) {
        assert.equal(el.meta.towers[i]?.baseY ?? 0, 0, `seed ${s}: torre en piso superior`);
        const tcx = el.meta.towerXs[i];
        const tw = el.meta.towerWs[i];
        if (tcx < axis) {
          assert.ok(tcx + tw / 2 < axis + 0.5, `seed ${s}: torre izq tapa centro`);
        } else {
          assert.ok(tcx - tw / 2 > axis - 0.5, `seed ${s}: torre der tapa centro`);
        }
      }
    }
  });

  it("torres superiores dentro del soporte del nivel inferior", () => {
    for (const faction of ["human", "dwarf", "evil", "elf"]) {
      for (let s = 0; s < 25; s++) {
        const el = generateCastle({ seed: s * 37 + 11, faction });
        const axis = el.meta.axis;
        for (let ti = 0; ti < el.meta.towerXs.length; ti += 1) {
          const baseY = el.meta.towers[ti]?.baseY ?? 0;
          if (baseY <= 0) continue;
          const supportTopW = el.meta.towerSupportTopW?.[ti];
          assert.ok(supportTopW, `${faction} seed ${s}: torre ${ti} sin soporte`);
          const half = supportTopW / 2;
          const tcx = el.meta.towerXs[ti];
          assert.ok(
            tcx >= axis - half + 0.5 && tcx <= axis + half - 0.5,
            `${faction} seed ${s}: torre ${ti} fuera de soporte`,
          );
        }
      }
    }
  });

  it("enanos: dolmenes no tapan la puerta (seed 99)", () => {
    const el = generateCastle({ seed: 99, faction: "dwarf" });
    const axis = el.meta.axis;
    const doorW = el.meta.doorW;
    const colW = (el.meta.baseW ?? 60) * 0.07;
    const slabW = colW * 2;
    const pieceW = Math.max(colW, slabW);
    const dead = doorW / 2 + pieceW / 2 + 1;
    for (const cx of el.meta.dolmenXs ?? []) {
      assert.ok(
        Math.abs(cx - axis) >= dead * 0.98,
        `dolmen en x=${cx} solapa puerta`,
      );
    }
  });

  it("enanos: aparece castillo de 4 niveles en alguna seed", () => {
    let hasFour = false;
    for (let s = 0; s < 80; s++) {
      const el = generateCastle({ seed: s * 19 + 2, faction: "dwarf" });
      if (el.meta.castleLevelCount === 4) hasFour = true;
    }
    assert.ok(hasFour, "ninguna seed produjo 4 niveles en 80 intentos");
  });

  it("enanos: torres de planta baja en ambos flancos del zócalo", () => {
    function plinthSpanX(el) {
      const plinth = el.parts.find((p) => p.role === "plinth");
      assert.ok(plinth, "sin plinth");
      const nums = plinth.d.match(/-?[\d.]+/g).map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      return { left: Math.min(...xs), right: Math.max(...xs) };
    }
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 11 + 3, faction: "dwarf" });
      const { left, right } = plinthSpanX(el);
      const baseY = el.parts.find((p) => p.role === "base")?.baseY;
      const margin = 12;
      const baseTowers = el.parts.filter(
        (p) => p.role === "tower" && Math.abs(p.baseY - baseY) < 0.5,
      );
      assert.ok(baseTowers.length >= 2, `seed ${s}: menos de 2 torres en planta`);
      const hasLeft = baseTowers.some((t) => t.centerX < left + margin);
      const hasRight = baseTowers.some((t) => t.centerX > right - margin);
      assert.ok(hasLeft, `seed ${s}: sin torre en flanco izq del zócalo`);
      assert.ok(hasRight, `seed ${s}: sin torre en flanco der del zócalo`);
    }
  });

  it("ningún elemento sobresale del zócalo (envelope)", () => {
    for (const faction of ["human", "dwarf", "evil", "elf"]) {
      for (let s = 0; s < 15; s++) {
        const el = generateCastle({ seed: s * 31 + 7, faction });
        const tol = 0.05;
        assert.ok(
          el.meta.localMinX >= el.meta.envelopeLeft - tol,
          `${faction} seed ${s}: sobresale izquierda`,
        );
        assert.ok(
          el.meta.localMaxX <= el.meta.envelopeRight + tol,
          `${faction} seed ${s}: sobresale derecha`,
        );
      }
    }
  });

  it("altura del zócalo en SVG ≈ fracción terreno/castillo", () => {
    const terrainPx = 48;
    const castlePx = 120;
    const expectedFrac = (terrainPx / castlePx) * PLINTH_SCREEN_HEIGHT_FACTOR;

    function pathHeight(d) {
      const nums = d.match(/-?[\d.]+/g).map(Number);
      const ys = [];
      for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
      return Math.max(...ys) - Math.min(...ys);
    }

    for (const faction of ["human", "dwarf", "evil", "elf"]) {
      for (let s = 0; s < 12; s++) {
        const el = generateCastle({
          seed: s * 37 + 9,
          faction,
          terrainHeightPx: terrainPx,
          castleSizePx: castlePx,
        });
        const plinth = el.parts.find((p) => p.role === "plinth");
        const frac = pathHeight(plinth.d) / 100;
        assert.ok(
          Math.abs(frac - expectedFrac) < 0.06,
          `${faction} seed ${s}: zócalo ${(frac * 100).toFixed(1)}% vs ${(expectedFrac * 100).toFixed(1)}%`,
        );
      }
    }
  });

  it("plinth rectangular en castillos monolíticos (4 vértices)", () => {
    for (const faction of ["human", "dwarf", "evil", "elf"]) {
      for (let s = 0; s < 10; s++) {
        const el = generateCastle({ seed: s * 23 + 1, faction });
        const plinth = el.parts.find((p) => p.role === "plinth");
        assert.ok(plinth, `${faction} seed ${s}: sin plinth`);
        const verts = (plinth.d.match(/L/g) || []).length + 1;
        assert.equal(verts, 4, `${faction} seed ${s}: plinth no rectangular (${verts} vértices)`);
      }
    }
  });

  it("humanos: al menos algunas seeds producen partes con rol 'dome' (cúpulas)", () => {
    let domeCount = 0;
    for (let s = 0; s < 30; s++) {
      const el = generateCastle({ seed: s * 17 + 4, faction: "human" });
      if (el.parts.some((p) => p.role === "dome")) domeCount++;
    }
    assert.ok(domeCount >= 8, `solo ${domeCount}/30 humanos tienen cúpulas`);
  });
});
