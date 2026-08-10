import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  memberCardTone,
  memberCornerStateLabel,
  memberTypeLine,
  memberWorldModifier,
  memberPlayCtaLabel,
  memberTextBoxContent,
  genderSelectOptions,
} from "../js/lib/crew-member-card.js";

/** @type {import('../js/lib/crew-api.js').CrewListItem} */
const baseMember = {
  id: "abc",
  display_name: "Nora",
  age_years: 8,
  age_band: "age_7",
  world_theme: "fantasy",
  status: "active",
  onboarding_step: "complete",
  placement_status: "completed",
  tutor_label: null,
};

describe("crew-member-card", () => {
  it("memberCardTone ready cuando onboarding complete", () => {
    assert.equal(memberCardTone(baseMember), "ready");
  });

  it("memberCardTone exam durante placement", () => {
    assert.equal(
      memberCardTone({ ...baseMember, onboarding_step: "placement", placement_status: "in_progress" }),
      "exam",
    );
  });

  it("memberWorldModifier refleja mundo", () => {
    assert.equal(memberWorldModifier(baseMember), "crew-card--world-fantasy");
    assert.equal(memberWorldModifier({ ...baseMember, world_theme: null }), "crew-card--world-neutral");
  });

  it("memberTypeLine combina mundo y edad", () => {
    assert.equal(memberTypeLine(baseMember), "Fantasía · Chico · 8 años");
  });

  it("memberTypeLine usa etiqueta de género explícita", () => {
    assert.equal(
      memberTypeLine({ ...baseMember, explorer_gender: "female", explorer_gender_label: "Chica" }),
      "Fantasía · Chica · 8 años",
    );
  });

  it("genderSelectOptions adapta labels por edad", () => {
    assert.equal(genderSelectOptions(8)[0].label, "Chico");
    assert.equal(genderSelectOptions(30)[0].label, "Hombre");
  });

  it("memberTextBoxContent prioriza nota tutor", () => {
    assert.equal(memberTextBoxContent({ ...baseMember, tutor_label: "La de Marta" }), "La de Marta");
  });

  it("memberCornerStateLabel corto para lista", () => {
    assert.equal(memberCornerStateLabel(baseMember), "Listo");
    assert.equal(
      memberCornerStateLabel({ ...baseMember, onboarding_step: "pending_entry", placement_status: "not_started" }),
      "Nuevo",
    );
  });

  it("buildCrewMemberCardInner no duplica estado en el pie", async () => {
    const { buildCrewMemberCardInner } = await import("../js/lib/crew-member-card.js");
    const html = buildCrewMemberCardInner(baseMember);
    assert.match(html, /crew-card__status-gem/);
    assert.doesNotMatch(html, /corner--state/);
  });

  it("memberPlayCtaLabel distingue primera entrada y retomar", () => {
    assert.equal(memberPlayCtaLabel(baseMember), "Continuar aventura");
    assert.equal(
      memberPlayCtaLabel({ ...baseMember, onboarding_step: "pending_entry", placement_status: "not_started" }),
      "Comenzar aventura",
    );
  });

  it("buildCrewListCardInner integra CTA play en la carta", async () => {
    const { buildCrewListCardInner } = await import("../js/lib/crew-member-card.js");
    const html = buildCrewListCardInner(baseMember);
    assert.match(html, /crew-card__play/);
    assert.match(html, /Continuar aventura/);
    assert.match(html, /crew-card__open/);
  });
});
