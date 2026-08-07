import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderMarkdown, renderDialogueMarkdown, normalizeDialogueMarkdownInput } from "../js/lib/markdown.js";

describe("renderMarkdown", () => {
  it("renderiza reglas horizontales", () => {
    const html = renderMarkdown("Antes\n\n---\n\nDespués");
    assert.match(html, /<hr>/);
    assert.doesNotMatch(html, /<p>---<\/p>/);
  });

  it("renderiza tablas GFM", () => {
    const md = [
      "| Concepto | Detalle |",
      "| --- | --- |",
      "| **Responsable** | KidepiK |",
    ].join("\n");
    const html = renderMarkdown(md);
    assert.match(html, /<table class="legal-md-table">/);
    assert.match(html, /<td><strong>Responsable<\/strong><\/td>/);
    assert.match(html, /<td>KidepiK<\/td>/);
    assert.doesNotMatch(html, /\| --- \|/);
  });

  it("deja líneas con pipe sueltas como párrafo si no son tabla", () => {
    const html = renderMarkdown("Esto | no | es | tabla");
    assert.match(html, /<p>Esto \| no \| es \| tabla<\/p>/);
  });

  it("renderDialogueMarkdown resalta negrita en burbujas", () => {
    const html = renderDialogueMarkdown("Graba tu nombre en la **piedra rúnica**.");
    assert.match(html, /<strong>piedra rúnica<\/strong>/);
    assert.doesNotMatch(html, /\*\*/);
  });

  it("normaliza asteriscos escapados del LLM", () => {
    const html = renderDialogueMarkdown(
      "Graba tu nombre en la **\\*\\*piedra rúnica\\*\\***.",
    );
    assert.match(html, /<strong>piedra rúnica<\/strong>/);
    assert.doesNotMatch(html, /\\\*/);
  });

  it("normalizeDialogueMarkdownInput colapsa envoltorios duplicados", () => {
    assert.equal(
      normalizeDialogueMarkdownInput("****hola****"),
      "**hola**",
    );
  });
});
