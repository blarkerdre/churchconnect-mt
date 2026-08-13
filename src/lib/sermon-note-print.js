// Print / PDF export for sermon notes.
// Builds a clean print document in a hidden iframe and triggers the browser
// print dialog (where the user can choose "Save as PDF").
import { toImageDataUrl } from "@/lib/logo-data-url";

export function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "SPAN", "DIV",
  "H1", "H2", "H3", "H4", "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE",
  "HR", "IMG", "A", "MARK", "SUP", "SUB",
]);

/**
 * Whitelist-scrub note HTML for printing: drop unknown tags, all event
 * handlers, and non-http(s)/data URLs. Bible references become plain text.
 */
export function sanitizeNoteHtml(html) {
  if (typeof document === "undefined") return "";
  const root = document.createElement("div");
  root.innerHTML = String(html || "");

  const walk = (node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const tag = child.tagName;
      if (!ALLOWED_TAGS.has(tag)) {
        // Keep the text content, drop the element wrapper.
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        walk(node);
        return;
      }

      Array.from(child.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "");
        if (name.startsWith("on")) {
          child.removeAttribute(attr.name);
          return;
        }
        if ((name === "src" || name === "href") && !/^(https?:|data:image\/|mailto:|#)/i.test(value.trim())) {
          child.removeAttribute(attr.name);
          return;
        }
        if (!["src", "href", "alt", "style", "colspan", "rowspan", "class"].includes(name)) {
          child.removeAttribute(attr.name);
        }
      });

      // Bible references / links print as plain text.
      if (tag === "A") {
        const span = document.createElement("span");
        span.className = "ref";
        span.innerHTML = child.innerHTML;
        child.replaceWith(span);
        walk(node);
        return;
      }

      walk(child);
    });
  };

  walk(root);
  return root.innerHTML;
}

function buildHtml({ note, logo, churchName }) {
  const meta = [
    note.speaker ? ["Speaker", note.speaker] : null,
    note.category ? ["Category", note.category] : null,
    note.folderName ? ["Folder", note.folderName] : null,
    note.serviceDate ? ["Service date", note.serviceDate] : null,
  ].filter(Boolean);

  const printedOn = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<title>${escHtml(note.title || "Sermon Note")}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 12pt; line-height: 1.55; margin: 0; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e2a4a; padding-bottom: 10px; margin-bottom: 16px; }
  header img { max-height: 56px; max-width: 160px; object-fit: contain; }
  header .church { font-family: Arial, Helvetica, sans-serif; font-size: 13pt; font-weight: bold; color: #1e2a4a; letter-spacing: .3px; }
  h1 { font-size: 19pt; margin: 0 0 6px; color: #1e2a4a; }
  .meta { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #444; margin-bottom: 16px; }
  .meta span { margin-right: 14px; }
  .meta b { color: #111; }
  .body h1, .body h2, .body h3 { color: #1e2a4a; page-break-after: avoid; }
  .body h2 { font-size: 14pt; margin: 14px 0 6px; }
  .body p { margin: 0 0 8px; }
  .body ul, .body ol { margin: 0 0 8px 20px; }
  .body img { max-width: 100%; }
  .body .ref { font-weight: 600; color: #1e2a4a; text-decoration: none; }
  footer { margin-top: 22px; border-top: 1px solid #ccc; padding-top: 6px; font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #666; }
</style></head>
<body>
  <header>
    ${logo ? `<img src="${logo}" alt="" />` : ""}
    <div class="church">${escHtml(churchName || "")}</div>
  </header>
  <h1>${escHtml(note.title || "Untitled note")}</h1>
  ${meta.length ? `<div class="meta">${meta.map(([k, v]) => `<span><b>${escHtml(k)}:</b> ${escHtml(v)}</span>`).join("")}</div>` : ""}
  <div class="body">${sanitizeNoteHtml(note.content)}</div>
  <footer>Printed ${escHtml(printedOn)}</footer>
</body></html>`;
}

/**
 * Print a sermon note. `note` = { title, speaker, category, folderName,
 * serviceDate, content }.
 */
export async function printSermonNote(note, { logoUrl, churchName } = {}) {
  let logo = null;
  try {
    if (logoUrl) {
      const img = await toImageDataUrl(logoUrl);
      logo = img?.dataUrl || null;
    }
  } catch {
    logo = null;
  }

  const html = buildHtml({ note, logo, churchName });

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    throw new Error("Unable to open the print view.");
  }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve) => setTimeout(resolve, 250));
  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } finally {
    cleanup();
  }
}
