import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baggageGlyphId, renderBaggageHtml } from "../js/lib/baggage-ui.js";

describe("baggage-ui", () => {
  it("mapea glifos de ítem y no cae al saco genérico", () => {
    assert.equal(baggageGlyphId("item-scroll"), "item-scroll");
    assert.equal(baggageGlyphId("currency"), "currency");
    assert.equal(baggageGlyphId("unknown"), "baggage");
  });

  it("pinta moneda con icono e instance_name en el slot", () => {
    const html = renderBaggageHtml(
      {
        wallet: { label_tutor: "Monedas del reino", balance: 130, icon_id: "currency" },
        items: [
          {
            id: "1",
            label: "Pergamino de la segunda voz",
            label_child: "Pergamino de la segunda voz",
            icon_id: "item-scroll",
            usable_now: true,
            rarity: "uncommon",
            qty: 1,
          },
        ],
        slot_count: 1,
        slot_soft_max: 20,
      },
      { audience: "tutor" },
    );
    assert.match(html, /crew-baggage__wallet-icon/);
    assert.match(html, /data-icon="currency"/);
    assert.match(html, /Pergamino de la segunda voz/);
    assert.match(html, /data-icon="item-scroll"/);
    assert.doesNotMatch(html, /data-icon="baggage"/);
  });
});
