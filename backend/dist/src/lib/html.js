const ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
/** Escape untrusted text before interpolating it into an HTML email. */
export const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
//# sourceMappingURL=html.js.map