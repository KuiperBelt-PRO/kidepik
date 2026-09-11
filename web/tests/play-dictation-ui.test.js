/**
 * @module play-dictation-ui.test
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  startDictationLabel,
  formatAudioClock,
  formatAudioRemaining,
  dictationWaitFallback,
  dictationGradeFallback,
  rewindDictationToStart,
} from "../js/lib/play-dictation-ui.js";

test("startDictationLabel is world-specific", () => {
  assert.equal(startDictationLabel("sci-fi"), "Sintonizar el parte");
  assert.equal(startDictationLabel("fantasy"), "Escuchar el recado");
  assert.equal(startDictationLabel(null), "Escuchar el recado");
});

test("formatAudioClock pads seconds", () => {
  assert.equal(formatAudioClock(0), "0:00");
  assert.equal(formatAudioClock(5.9), "0:05");
  assert.equal(formatAudioClock(75), "1:15");
  assert.equal(formatAudioClock(-3), "0:00");
  assert.equal(formatAudioClock(NaN), "0:00");
});

test("formatAudioRemaining uses minus prefix", () => {
  assert.equal(formatAudioRemaining(10, 40), "−0:30");
  assert.equal(formatAudioRemaining(40, 40), "−0:00");
  assert.equal(formatAudioRemaining(0, 0), "–:––");
});

test("rewindDictationToStart pauses at 0:00", () => {
  const audio = {
    paused: false,
    currentTime: 12.4,
    pause() {
      this.paused = true;
    },
  };
  rewindDictationToStart(audio);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.paused, true);
  rewindDictationToStart(null);
});

test("dictationWaitFallback differs by world", () => {
  const sci = dictationWaitFallback("sci-fi")[0];
  const fan = dictationWaitFallback("fantasy")[0];
  assert.ok(sci.includes("baliza") || sci.includes("parte") || sci.includes("transcrip"));
  assert.ok(fan !== sci);
});

test("dictationGradeFallback differs by world", () => {
  const sci = dictationGradeFallback("sci-fi")[0];
  const fan = dictationGradeFallback("fantasy")[0];
  assert.ok(sci.includes("captura") || sci.includes("visor") || sci.includes("Analizando"));
  assert.ok(fan !== sci);
});
