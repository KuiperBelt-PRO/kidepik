/**
 * Marco glass de sección autenticada (logo + scroll con fade).
 * @module section-frame
 */

const EXIT_MS = 220;

/**
 * @param {HTMLElement} host
 * @param {{ ariaLabel?: string }} [options]
 * @returns {{ root: HTMLElement; contentEl: HTMLElement; logoMountEl: HTMLElement; destroy: () => Promise<void> }}
 */
export function mountSectionFrame(host, options = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exitMs = reducedMotion ? 80 : EXIT_MS;

  const root = document.createElement("div");
  root.className = "section-frame is-entering";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", options.ariaLabel ?? "Sección");

  const header = document.createElement("div");
  header.className = "section-frame__header";

  const logoMount = document.createElement("div");
  logoMount.className = "section-frame__logo-mount";
  logoMount.setAttribute("aria-hidden", "true");
  header.appendChild(logoMount);

  const scroll = document.createElement("div");
  scroll.className = "section-frame__scroll";

  const content = document.createElement("div");
  content.className = "section-frame__content";
  scroll.appendChild(content);

  root.append(header, scroll);
  host.appendChild(root);

  requestAnimationFrame(() => {
    root.classList.remove("is-entering");
  });

  return {
    root,
    contentEl: content,
    logoMountEl: logoMount,
    destroy() {
      return new Promise((resolve) => {
        if (!root.isConnected) {
          resolve();
          return;
        }
        root.classList.add("is-exiting");
        window.setTimeout(() => {
          root.remove();
          resolve();
        }, exitMs);
      });
    },
  };
}
