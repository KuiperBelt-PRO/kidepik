/**
 * Clasificación de espera / timeout para turnos de play que disparan compose IA.
 * @module play-thinking-kind
 */

/** @typedef {'preparing_exam' | 'evaluating_answer' | 'adventure_compose' | 'dictation_compose' | 'dictation_grade' | 'general'} PlayThinkingKind */

/**
 * @param {string} phase
 * @param {Record<string, unknown> | undefined | null} [meta]
 * @returns {boolean}
 */
export function triggersPathPackCompose(phase, meta = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  if (phase === "adventure_ready") return true;
  if (phase === "compose_failed") return true;
  if (phase === "placement_feedback") {
    const next = Number(m.next_index);
    const total = Number(m.total);
    return Number.isFinite(next) && Number.isFinite(total) && total > 0 && next >= total;
  }
  if (phase === "placement_item") {
    const index = Number(m.index);
    const total = Number(m.total);
    return Number.isFinite(index) && Number.isFinite(total) && total > 0 && index + 1 >= total;
  }
  return false;
}

/**
 * @param {string} phase
 * @param {Record<string, unknown> | undefined | null} [meta]
 * @returns {PlayThinkingKind}
 */
export function resolveRewindThinkingKindForPhase(phase, meta = {}) {
  if (phase === "placement_item" || phase === "placement_feedback") {
    if (triggersPathPackCompose(phase, meta)) return "adventure_compose";
    return "evaluating_answer";
  }
  if (phase === "handoff_placement" || phase === "placement_compose") {
    return "preparing_exam";
  }
  if (phase === "dictation_theory" || phase === "dictation_listen" || phase === "dictation_result") {
    return "dictation_compose";
  }
  if (
    triggersPathPackCompose(phase, meta) ||
    phase === "choose_zone" ||
    phase === "admission_map" ||
    phase === "zone_arrive" ||
    phase === "zone_between" ||
    phase === "adventure_challenge"
  ) {
    return "adventure_compose";
  }
  return "general";
}

/**
 * @param {string} phase
 * @param {Record<string, unknown> | undefined | null} [meta]
 * @param {{ kind?: string, option_id?: string }} [reply]
 * @param {string} [onboardingStep]
 * @returns {PlayThinkingKind}
 */
export function resolvePlayThinkingKind(phase, meta = {}, reply = {}, onboardingStep = "") {
  const replyKind = typeof reply.kind === "string" ? reply.kind : "";
  const optionId = typeof reply.option_id === "string" ? reply.option_id : "";

  if (
    phase === "handoff_placement" ||
    optionId === "start_placement" ||
    (replyKind === "continue" &&
      onboardingStep === "placement" &&
      phase !== "placement_item" &&
      !triggersPathPackCompose(phase, meta))
  ) {
    return "preparing_exam";
  }

  if (triggersPathPackCompose(phase, meta)) {
    return "adventure_compose";
  }

  if (replyKind === "photo") {
    return "dictation_grade";
  }

  if (
    optionId === "debug_start_dictation" ||
    optionId === "start_path_dictation" ||
    optionId === "start_dictation"
  ) {
    return "dictation_compose";
  }

  if (phase === "placement_item" || phase === "placement_feedback") {
    return "evaluating_answer";
  }

  if (
    phase === "choose_zone" ||
    phase === "admission_map" ||
    phase === "zone_arrive" ||
    phase === "zone_between" ||
    phase === "adventure_challenge"
  ) {
    return "adventure_compose";
  }

  return "general";
}
