import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  memberCardTone,
  memberCornerStateLabel,
  memberTypeLine,
  memberWorldModifier,
  memberTextBoxContent,
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
    assert.equal(memberTypeLine(baseMember), "Fantasía · 8 años");
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
});
