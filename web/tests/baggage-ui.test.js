import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baggageGlyphId, renderBaggageDetailHtml, renderBaggageHtml } from "../js/lib/baggage-ui.js";

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
            can_use: true,
            rarity: "uncommon",
            qty: 1,
            effects: ["challenge_hint"],
            subject_labels: ["Comprensión lectora"],
            description_tutor: "Ayuda en retos de lectura.",
          },
        ],
        slot_count: 1,
        slot_soft_max: 20,
      },
      { audience: "tutor" },
    );
    assert.match(html, /crew-baggage__section--wallet/);
    assert.match(html, /crew-baggage__section-title-icon/);
    assert.match(html, /data-icon="currency"/);
    assert.match(html, /crew-baggage__section--findings/);
    assert.match(html, /Pergamino de la segunda voz/);
    assert.match(html, /data-icon="item-scroll"/);
    assert.match(html, /data-baggage-body/);
    assert.doesNotMatch(html, /data-icon="baggage"/);
  });

  it("usa copy claro para tutor en el detalle inline", () => {
    const html = renderBaggageDetailHtml(
      {
        label: "Poción de palabras",
        description_tutor: "Ayuda a ordenar las palabras.",
        subject_labels: ["Lengua y gramática", "Comprensión lectora"],
        effects: ["challenge_hint"],
        usable_now: true,
        can_use: true,
      },
      "tutor",
    );
    assert.match(html, /Disponible en la aventura/);
    assert.match(html, /Pide una pista durante un reto/);
    assert.doesNotMatch(html, /Usable en play/);
  });
});
