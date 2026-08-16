/**
 * @module play-baggage-offer.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  renderBaggageOfferStripHtml,
  shouldShowBaggageOfferStrip,
} from "../js/lib/play-baggage-offer.js";

test("shouldShowBaggageOfferStrip only on challenge phases", () => {
  const offers = [{ item_row_id: "1", label_child: "Pergamino", can_use: true }];
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "path_challenge" }), true);
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "path_intro", retry: true }), true);
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "choose_path" }), false);
  assert.equal(shouldShowBaggageOfferStrip([], { phase: "path_challenge" }), false);
});

test("renderBaggageOfferStripHtml includes chips and ver todo", () => {
  const html = renderBaggageOfferStripHtml([
    {
      item_row_id: "abc",
      label_child: "Pergamino",
      effect_id: "challenge_hint",
      icon_id: "item-scroll",
      can_use: true,
    },
  ]);
  assert.match(html, /data-baggage-offer-chip="abc"/);
  assert.match(html, /Pergamino/);
  assert.match(html, /data-baggage-offer-more/);
});
