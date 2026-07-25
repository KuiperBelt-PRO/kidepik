/**
 * Morph loader → auth:
 * - logo: deja de girar y solo se traslada (mismo tamaño)
 * - anillo (track/progreso): fade out
 * - eslogan circular (SVG): FLIP letra a letra → dos líneas rectas
 * @module loader-auth-morph
 */

import { GATE_COPY, GATE_MORPH_MS } from "./loader-gate-constants.js?v=162";

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * @param {HTMLElement} el
 * @returns {DOMRect}
 */
function rectOf(el) {
  return el.getBoundingClientRect();
}

/**
 * Congela la matriz computada de un elemento animado por CSS.
 * @param {HTMLElement} el
 */
function freezeComputedTransform(el) {
  const computed = getComputedStyle(el).transform;
  el.style.animation = "none";
  el.style.transform = computed && computed !== "none" ? computed : "none";
}

/**
 * @typedef {{
 *   ch: string;
 *   cx: number;
 *   cy: number;
 *   rot: number;
 *   role: 'sci' | 'fantasy';
 * }} CircularGlyph
 */

/**
 * Lee posición/rotación en pantalla de cada glifo del textPath SVG.
 * @param {SVGTextElement} textEl
 * @param {'sci' | 'fantasy'} role
 * @param {string} expected
 * @returns {CircularGlyph[]}
 */
function captureTextGlyphs(textEl, role, expected) {
  /** @type {CircularGlyph[]} */
  const out = [];
  const chars = [...expected];
  let count = 0;
  try {
    count = textEl.getNumberOfChars();
  } catch {
    return out;
  }
  if (count <= 0 || chars.length === 0) return out;

  let ei = 0;
  for (let i = 0; i < count && ei < chars.length; i += 1) {
    try {
      const extent = textEl.getExtentOfChar(i);
      const ctm = textEl.getScreenCTM();
      if (!ctm) continue;

      if (extent.width < 0.01) {
        if (chars[ei] === " ") ei += 1;
        continue;
      }

      while (ei < chars.length && chars[ei] === " ") ei += 1;
      if (ei >= chars.length) break;

      const rot = textEl.getRotationOfChar(i);
      const p1 = new DOMPoint(extent.x, extent.y).matrixTransform(ctm);
      const p2 = new DOMPoint(
        extent.x + extent.width,
        extent.y + extent.height,
      ).matrixTransform(ctm);

      out.push({
        ch: chars[ei],
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
        rot,
        role,
      });
      ei += 1;
    } catch {
      // Glifo no medible: se omite del FLIP.
    }
  }
  return out;
}

/**
 * @param {HTMLElement} ringWrap
 * @param {string} sciText
 * @param {string} fantasyText
 * @returns {CircularGlyph[]}
 */
function captureCircularGlyphs(ringWrap, sciText, fantasyText) {
  /** @type {CircularGlyph[]} */
  const glyphs = [];
  const sci = ringWrap.querySelector(".loader-ring__text--sci");
  const fantasy = ringWrap.querySelector(".loader-ring__text--fantasy");
  if (sci instanceof SVGTextElement) {
    glyphs.push(...captureTextGlyphs(sci, "sci", sciText));
  }
  if (fantasy instanceof SVGTextElement) {
    glyphs.push(...captureTextGlyphs(fantasy, "fantasy", fantasyText));
  }
  return glyphs;
}

/**
 * @param {string} text
 * @param {'sci' | 'fantasy'} role
 * @returns {{ line: HTMLParagraphElement; spans: HTMLSpanElement[] }}
 */
function buildSloganLine(text, role) {
  const line = document.createElement("p");
  line.className = `loader-auth-slogan__line loader-auth-slogan__line--${role}`;

  /** @type {HTMLSpanElement[]} */
  const spans = [];
  for (const ch of text) {
    const span = document.createElement("span");
    span.className = "loader-auth-slogan__glyph";
    span.textContent = ch === " " ? "\u00a0" : ch;
    if (ch === " ") span.classList.add("is-space");
    line.appendChild(span);
    spans.push(span);
  }

  const period = document.createElement("span");
  period.className = "loader-auth-slogan__glyph loader-auth-slogan__glyph--period";
  period.textContent = ".";
  line.appendChild(period);

  return { line, spans };
}

/**
 * @param {CircularGlyph[]} circular
 * @param {HTMLSpanElement[]} linear
 * @returns {{ from: CircularGlyph; to: HTMLSpanElement }[]}
 */
function pairGlyphs(circular, linear) {
  /** @type {{ from: CircularGlyph; to: HTMLSpanElement }[]} */
  const pairs = [];
  let ci = 0;
  for (const span of linear) {
    if (span.classList.contains("is-space")) continue;
    const want = span.textContent ?? "";
    while (ci < circular.length) {
      const g = circular[ci];
      ci += 1;
      if (g.ch === " ") continue;
      if (g.ch === want) {
        pairs.push({ from: g, to: span });
        break;
      }
    }
  }
  return pairs;
}

/**
 * @param {{
 *   scene: HTMLElement;
 *   chrome: HTMLElement;
 *   ringWrap: HTMLElement;
 *   logoWrap: HTMLElement;
 *   durationMs?: number;
 *   onComplete?: () => void;
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function runLoaderAuthMorph({
  scene,
  chrome,
  ringWrap,
  logoWrap,
  durationMs = GATE_MORPH_MS,
  onComplete,
}) {
  let finished = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {HTMLElement | null} */
  let sloganEl = null;

  const ms = Math.max(0, durationMs);

  function finish() {
    if (finished) return;
    finished = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }

    logoWrap.style.transition = "";
    logoWrap.style.transform = "";

    if (sloganEl) {
      for (const glyph of sloganEl.querySelectorAll(".loader-auth-slogan__glyph")) {
        if (glyph instanceof HTMLElement) {
          glyph.style.transition = "";
          glyph.style.transform = "";
          glyph.style.opacity = "";
          glyph.classList.remove("is-morphing");
        }
      }
    }

    if (ringWrap.isConnected) {
      ringWrap.style.transition = "";
      ringWrap.style.opacity = "";
      ringWrap.remove();
    }

    onComplete?.();
  }

  try {
    const ringSpin = ringWrap.querySelector(".loader-ring-spin");
    const textSvg = ringWrap.querySelector(".loader-ring__svg--text");

    if (ringSpin instanceof HTMLElement) {
      freezeComputedTransform(ringSpin);
      ringSpin.classList.remove("is-orbiting");
    }

    logoWrap.classList.remove("is-ambi-active");
    freezeComputedTransform(logoWrap);
    logoWrap.style.transition = "none";
    logoWrap.style.transform = "none";
    void logoWrap.offsetWidth;

    const firstLogo = rectOf(logoWrap);
    const sciText = GATE_COPY.sloganLine1.replace(/\.$/, "");
    const fantasyText = GATE_COPY.sloganLine2.replace(/\.$/, "");
    const circularGlyphs = captureCircularGlyphs(ringWrap, sciText, fantasyText);

    let stack = chrome.querySelector(".loader-auth-stack");
    if (!(stack instanceof HTMLElement)) {
      stack = document.createElement("div");
      stack.className = "loader-auth-stack";
      chrome.appendChild(stack);
    }

    let brand = stack.querySelector(".loader-auth-brand");
    if (!(brand instanceof HTMLElement)) {
      brand = document.createElement("div");
      brand.className = "loader-auth-brand";
      stack.appendChild(brand);
    }

    sloganEl = document.createElement("div");
    sloganEl.className = "loader-auth-slogan";
    sloganEl.setAttribute("aria-hidden", "true");

    const sciLine = buildSloganLine(sciText, "sci");
    const fantasyLine = buildSloganLine(fantasyText, "fantasy");
    sloganEl.append(sciLine.line, fantasyLine.line);

    if (logoWrap.parentElement !== brand) {
      brand.insertBefore(logoWrap, brand.firstChild);
    }
    const existingSlogan = brand.querySelector(".loader-auth-slogan");
    if (existingSlogan) existingSlogan.remove();
    brand.appendChild(sloganEl);

    logoWrap.classList.add("is-auth-positioned");
    logoWrap.style.width = `${firstLogo.width}px`;
    logoWrap.style.height = `${firstLogo.height}px`;
    logoWrap.style.inset = "auto";

    const lastLogo = rectOf(logoWrap);
    const logoDx = firstLogo.left - lastLogo.left;
    const logoDy = firstLogo.top - lastLogo.top;
    logoWrap.style.transition = "none";
    logoWrap.style.transform = `translate(${logoDx}px, ${logoDy}px)`;

    const pairs = [
      ...pairGlyphs(
        circularGlyphs.filter((g) => g.role === "sci"),
        sciLine.spans,
      ),
      ...pairGlyphs(
        circularGlyphs.filter((g) => g.role === "fantasy"),
        fantasyLine.spans,
      ),
    ];

    for (const { from, to } of pairs) {
      const last = rectOf(to);
      const dx = from.cx - (last.left + last.width / 2);
      const dy = from.cy - (last.top + last.height / 2);
      to.style.transition = "none";
      to.style.transform = `translate(${dx}px, ${dy}px) rotate(${from.rot}deg)`;
      to.classList.add("is-morphing");
    }

    for (const period of sloganEl.querySelectorAll(
      ".loader-auth-slogan__glyph--period",
    )) {
      if (period instanceof HTMLElement) {
        period.style.transition = "none";
        period.style.opacity = "0";
      }
    }

    sloganEl.classList.add("is-visible");

    if (textSvg instanceof SVGElement) {
      textSvg.style.opacity = "0";
      textSvg.style.visibility = "hidden";
      textSvg.style.pointerEvents = "none";
    }

    // Quitar invert inline: la WAAPI controla el transform.
    logoWrap.style.transform = "";
    for (const { to } of pairs) {
      to.style.transform = "";
    }

    void logoWrap.offsetWidth;
    void sloganEl.offsetWidth;

    scene.classList.add("is-auth-morph");
    ringWrap.classList.add("is-auth-exit");

    // Fade del anillo completo (track + resto del SVG); el texto ya está en HTML.
    ringWrap.style.opacity = "1";
    ringWrap.style.transition = `opacity ${ms || GATE_MORPH_MS}ms ${EASE}`;
    void ringWrap.offsetWidth;
    ringWrap.style.opacity = "0";

    // Play FLIP con Web Animations (más fiable que transition + rAF).
    /** @type {Animation[]} */
    const anims = [];

    if (ms > 0 && typeof logoWrap.animate === "function") {
      anims.push(
        logoWrap.animate(
          [
            { transform: `translate(${logoDx}px, ${logoDy}px)` },
            { transform: "translate(0px, 0px)" },
          ],
          { duration: ms, easing: EASE, fill: "forwards" },
        ),
      );

      for (const { from, to } of pairs) {
        const last = rectOf(to);
        const dx = from.cx - (last.left + last.width / 2);
        const dy = from.cy - (last.top + last.height / 2);
        anims.push(
          to.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) rotate(${from.rot}deg)` },
              { transform: "translate(0px, 0px) rotate(0deg)" },
            ],
            { duration: ms, easing: EASE, fill: "forwards" },
          ),
        );
      }

      for (const period of sloganEl.querySelectorAll(
        ".loader-auth-slogan__glyph--period",
      )) {
        if (period instanceof HTMLElement) {
          anims.push(
            period.animate(
              [{ opacity: 0 }, { opacity: 1 }],
              {
                duration: Math.max(1, Math.round(ms * 0.45)),
                delay: Math.round(ms * 0.55),
                easing: EASE,
                fill: "forwards",
              },
            ),
          );
        }
      }
    } else {
      logoWrap.style.transform = "translate(0px, 0px)";
      for (const { to } of pairs) {
        to.style.transform = "translate(0px, 0px) rotate(0deg)";
      }
      for (const period of sloganEl.querySelectorAll(
        ".loader-auth-slogan__glyph--period",
      )) {
        if (period instanceof HTMLElement) period.style.opacity = "1";
      }
    }

    if (ms <= 0) {
      finish();
    } else {
      timer = setTimeout(() => {
        for (const a of anims) {
          try {
            if (typeof a.commitStyles === "function") a.commitStyles();
            a.cancel();
          } catch {
            /* ignore */
          }
        }
        finish();
      }, ms + 40);
    }
  } catch (err) {
    console.error("[loader-auth-morph]", err);
    finish();
  }

  return {
    destroy() {
      if (timer != null) clearTimeout(timer);
      finished = true;
    },
  };
}

/**
 * Monta logo + eslogan recto sin animación morph (home post-login).
 * @param {HTMLElement} brand
 * @param {HTMLElement} logoWrap
 */
export function mountStaticAuthBrand(brand, logoWrap) {
  brand.className = "loader-auth-brand is-static";

  if (logoWrap.parentElement !== brand) {
    brand.insertBefore(logoWrap, brand.firstChild);
  }

  const existingSlogan = brand.querySelector(".loader-auth-slogan");
  if (existingSlogan) existingSlogan.remove();

  const sloganEl = document.createElement("div");
  sloganEl.className = "loader-auth-slogan is-visible";
  sloganEl.setAttribute("aria-hidden", "true");

  const sciLine = buildSloganLine(GATE_COPY.sloganLine1.replace(/\.$/, ""), "sci");
  const fantasyLine = buildSloganLine(GATE_COPY.sloganLine2.replace(/\.$/, ""), "fantasy");
  sloganEl.append(sciLine.line, fantasyLine.line);
  brand.appendChild(sloganEl);

  logoWrap.classList.add("is-auth-positioned", "is-ready");
}
