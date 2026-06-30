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
  it("elfos y enanos generan torres de escala comparable (castillos enanos multi-nivel)", () => {
    let elfSum = 0;
    let dwarfSum = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      elfSum += generateCastle({ seed: s * 3, faction: "elf" }).meta.localTowerMean;
      dwarfSum += generateCastle({ seed: s * 3, faction: "dwarf" }).meta.localTowerMean;
    }
    const elfMean = elfSum / N;
    const dwarfMean = dwarfSum / N;
    assert.ok(elfMean > 45, `media elf baja: ${elfMean}`);
    assert.ok(dwarfMean > 45, `media enana baja: ${dwarfMean}`);
    assert.ok(Math.abs(elfMean - dwarfMean) < 25, "escalas demasiado dispares entre facciones");
  });

  it("malignos tienen más decoración que humanos (media)", () => {
    let evilTotal = 0;
    let humanTotal = 0;
    const N = 40;
    for (let s = 0; s < N; s++) {
      evilTotal += decorationCount(generateCastle({ seed: s * 11, faction: "evil" }));
      humanTotal += decorationCount(generateCastle({ seed: s * 11, faction: "human" }));
    }
    assert.ok(
      evilTotal > humanTotal * 1.08,
      `decoración evil ${evilTotal} vs human ${humanTotal}`,
    );
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

  it("humanos: sin contrafuertes laterales (perfil)", () => {
    const profile = getFactionProfile("human");
    assert.equal(profile.buttressChance, 0);
  });

  it("enanos: torres bajas y anchas — más cortas que elfos", () => {
    const N = 40;
    let dwarfMean = 0;
    let elfMean = 0;
    for (let s = 0; s < N; s++) {
      dwarfMean += generateCastle({ seed: s * 31, faction: "dwarf" }).meta.localTowerMean;
      elfMean += generateCastle({ seed: s * 31, faction: "elf" }).meta.localTowerMean;
    }
    dwarfMean /= N;
    elfMean /= N;
    assert.ok(
      dwarfMean < elfMean,
      `torres enanas (${dwarfMean.toFixed(1)}) no son más cortas que élficas (${elfMean.toFixed(1)})`,
    );
  });

  it("enanos: siempre incluyen columnas dolmen (≥2 piezas decoration extra)", () => {
    for (let s = 0; s < 25; s++) {
      const el = generateCastle({ seed: s * 17 + 3, faction: "dwarf" });
      const deco = el.parts.filter((p) => p.role === "decoration").length;
      assert.ok(deco >= 2, `seed ${s}: enano sin dolmen (solo ${deco} decoraciones)`);
      assert.ok(el.meta.towerCount >= 2, `seed ${s}: enano sin torres`);
    }
  });
});
