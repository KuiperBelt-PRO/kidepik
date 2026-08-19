/**
 * @module play-baggage-offer.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  renderBaggageOfferStripHtml,
  shouldShowBaggageOfferStrip,
  effectActionLabel,
  offerToBaggageItem,
} from "../js/lib/play-baggage-offer.js";

test("shouldShowBaggageOfferStrip only on challenge phases", () => {
  const offers = [{ item_row_id: "1", label_child: "Pergamino", can_use: true }];
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "path_challenge" }), true);
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "path_intro", retry: true }), true);
  assert.equal(shouldShowBaggageOfferStrip(offers, { phase: "choose_path" }), false);
  assert.equal(shouldShowBaggageOfferStrip([], { phase: "path_challenge" }), false);
});

test("effectActionLabel uses Usar ahora for hints", () => {
  assert.equal(effectActionLabel("challenge_hint"), "Usar ahora");
  assert.equal(effectActionLabel("challenge_retry"), "Reintentar");
});

test("renderBaggageOfferStripHtml includes catalog slots and ver equipaje completo", () => {
  const html = renderBaggageOfferStripHtml([
    {
      item_row_id: "abc",
      label_child: "Elixir de suma",
      effect_id: "challenge_hint",
      icon_id: "item-scroll",
      can_use: true,
      rarity: "uncommon",
    },
    {
      item_row_id: "def",
      label_child: "Pergamino de runas",
      effect_id: "challenge_hint",
      icon_id: "item-scroll",
      can_use: true,
    },
  ]);
  assert.match(html, /data-baggage-offer-slot="abc"/);
  assert.match(html, /data-baggage-offer-slot="def"/);
  assert.match(html, /Elixir de suma/);
  assert.match(html, /data-baggage-offer-more/);
  assert.match(html, /data-baggage-offer-preview/);
  assert.match(html, /Ver equipaje completo/);
  assert.match(html, /Usar ahora/);
  assert.match(html, /Equipaje \(2\)/);
  assert.match(html, /data-baggage-hotbar-toggle/);
});

test("offerToBaggageItem defaults usable_now for play detail status", () => {
  const item = offerToBaggageItem({
    item_row_id: "abc",
    label_child: "Anillo",
    effect_id: "challenge_hint",
    can_use: true,
  });
  assert.equal(item.usable_now, true);
  assert.equal(item.can_use, true);
});

test("renderBaggageOfferStripHtml supports collapsed state", () => {
  const html = renderBaggageOfferStripHtml(
    [{ item_row_id: "1", label_child: "Obj", can_use: true, effect_id: "challenge_hint" }],
    { collapsed: true },
  );
  assert.match(html, /play-baggage-hotbar--collapsed/);
  assert.match(html, /data-baggage-hotbar-body hidden/);
});
