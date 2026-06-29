import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateCastle } from "../js/components/loader-fantasy-castle.js";
import {
  CASTLE_FACTIONS,
  getFactionProfile,
  parseDevFaction,
} from "../js/components/loader-fantasy-castle-factions.js";
import { isValidFantasyElement } from "../js/components/loader-fantasy-element.js";

function meanTowerHeight(el) {
  if (el.meta.localTowerMean) return el.meta.localTowerMean;
  const towers = el.parts.filter((p) => p.role === "tower");
  if (!towers.length) return 0;
  return towers.reduce((s, t) => s + (100 - t.baseY), 0) / towers.length;
}

function decorationCount(el) {
  return el.parts.filter((p) => p.role === "decoration").length;
}

describe("loader-fantasy-castle-factions / perfiles", () => {
  it("las cuatro facciones tienen perfil", () => {
    for (const f of CASTLE_FACTIONS) {
      assert.equal(getFactionProfile(f).id, f);
    }
  });

  it("parseDevFaction acepta ids válidos e ignora el resto", () => {
    assert.equal(parseDevFaction("elf"), "elf");
    assert.equal(parseDevFaction("DWARF"), "dwarf");
    assert.equal(parseDevFaction("orc"), undefined);
    assert.equal(parseDevFaction(""), undefined);
    assert.equal(parseDevFaction(null), undefined);
  });
});

describe("loader-fantasy-castle-factions / generación", () => {
  it("cada facción produce elemento válido (30 seeds)", () => {
    for (const faction of CASTLE_FACTIONS) {
      for (let s = 0; s < 30; s++) {
        const el = generateCastle({ seed: s * 41 + 3, faction });
        assert.ok(isValidFantasyElement(el), `${faction} seed ${s}`);
        assert.equal(el.meta.faction, faction);
      }
    }
  });

  it("misma seed + faction → mismo elemento", () => {
    const a = generateCastle({ seed: 9001, faction: "elf" });
    const b = generateCastle({ seed: 9001, faction: "elf" });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("facciones distintas con misma seed difieren", () => {
    const h = generateCastle({ seed: 42, faction: "human" });
    const e = generateCastle({ seed: 42, faction: "elf" });
    assert.notEqual(JSON.stringify(h.parts), JSON.stringify(e.parts));
  });

  it("sin faction explícita, meta.faction es una de las cuatro", () => {
    for (let s = 0; s < 40; s++) {
      const el = generateCastle({ seed: s * 17 + 5 });
      assert.ok(CASTLE_FACTIONS.includes(el.meta.faction), `seed ${s}: ${el.meta.faction}`);
    }
  });

  it("pickFaction es determinista", () => {
    const rng1 = () => 0.1;
    const rng2 = () => 0.1;
    // pickFaction needs real rng from seed - test via generateCastle meta instead
    const el = generateCastle({ seed: 123 });
    const el2 = generateCastle({ seed: 123 });
    assert.equal(el.meta.faction, el2.meta.faction);
  });
});

describe("loader-fantasy-castle-factions / rasgos arquitectónicos", () => {
  it("elfos más altos que enanos (media global)", () => {
    let elfSum = 0;
    let dwarfSum = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      elfSum += generateCastle({ seed: s * 3, faction: "elf" }).meta.localTowerMean;
      dwarfSum += generateCastle({ seed: s * 3, faction: "dwarf" }).meta.localTowerMean;
    }
    assert.ok(elfSum > dwarfSum, `media elf ${elfSum / N} vs enano ${dwarfSum / N}`);
  });

  it("malignos tienen más decoración que humanos (estadístico)", () => {
    let evilWins = 0;
    const N = 40;
    for (let s = 0; s < N; s++) {
      const evil = decorationCount(generateCastle({ seed: s * 11, faction: "evil" }));
      const human = decorationCount(generateCastle({ seed: s * 11, faction: "human" }));
      if (evil > human) evilWins++;
    }
    assert.ok(evilWins >= N * 0.6, `malignos más decorados solo ${evilWins}/${N}`);
  });

  it("enanos usan cuerpo achaflanado (más vértices que rect)", () => {
    for (let s = 0; s < 20; s++) {
      const el = generateCastle({ seed: s * 29, faction: "dwarf" });
      const base = el.parts.find((p) => p.role === "base");
      const pointCount = (base.d.match(/L/g) || []).length + 1;
      assert.ok(pointCount >= 7, `seed ${s}: base con pocos vértices (${pointCount})`);
    }
  });

  it("elfos incluyen arcadas, arbotantes y decoración densa", () => {
    let rich = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      const el = generateCastle({ seed: s * 7, faction: "elf" });
      if (el.parts.filter((p) => p.role === "decoration").length >= 6) rich++;
    }
    assert.ok(rich >= N * 0.55, `elfos con arcadas solo ${rich}/${N}`);
  });

  it("humanos incluyen contrafuertes con frecuencia", () => {
    let withButtress = 0;
    const N = 40;
    for (let s = 0; s < N; s++) {
      const el = generateCastle({ seed: s * 13, faction: "human" });
      if (el.parts.filter((p) => p.role === "decoration").length >= 3) withButtress++;
    }
    assert.ok(withButtress >= N * 0.55, `humanos con contrafuertes solo ${withButtress}/${N}`);
  });

  it("enanos más altos (altura local media)", () => {
    let tallEnough = 0;
    const N = 40;
    for (let s = 0; s < N; s++) {
      const el = generateCastle({ seed: s * 31, faction: "dwarf" });
      if (el.meta.localTowerMean >= 58) tallEnough++;
    }
    assert.ok(tallEnough >= N * 0.65, `enanos bajos solo ${tallEnough}/${N}`);
  });
});
