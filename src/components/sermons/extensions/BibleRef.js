import { Mark, mergeAttributes, markPasteRule, InputRule } from "@tiptap/core";
import { findReferencesInText, REFERENCE_REGEX } from "@/lib/bible/refs";

export const BibleRef = Mark.create({
  name: "bibleRef",
  inclusive: false,
  exitable: true,

  addAttributes() {
    return {
      reference: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-bible-ref"),
        renderHTML: (attrs) => (attrs.reference ? { "data-bible-ref": attrs.reference } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-bible-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "bible-ref",
        role: "button",
        tabindex: "0",
      }),
      0,
    ];
  },

  addInputRules() {
    const type = this.type;
    return [
      new InputRule({
        find: /((?:(?:1|2|3|I{1,3})\s*)?(?:Song\s+of\s+Solomon|Song\s+of\s+Songs|[A-Za-z][A-Za-z.]{1,20}(?:\s+of\s+[A-Za-z]+)?)\.?\s+\d{1,3}(?::\d{1,3}(?:\s*-\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*-\s*\d{1,3})?)*)?)([\s.,;!?)])$/,
        handler: ({ state, range, match }) => {
          const raw = match[1];
          const trailing = match[2] || "";
          if (!REFERENCE_REGEX.test(raw.trim())) return null;
          const start = range.to - match[0].length;
          const refFrom = start + match[0].indexOf(raw);
          const refTo = refFrom + raw.length;
          const tr = state.tr;
          tr.addMark(refFrom, refTo, type.create({ reference: raw.trim() }));
          // Ensure trailing char isn't marked
          tr.removeMark(refTo, refTo + trailing.length, type);
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: (text) => {
          const hits = findReferencesInText(text);
          return hits.map((h) => {
            const arr = [h.match];
            arr.index = h.start;
            arr.input = text;
            arr.data = { reference: h.match };
            return { index: h.start, text: h.match, match: arr, data: { reference: h.match } };
          });
        },
        type: this.type,
        getAttributes: (match) => ({ reference: (match.data && match.data.reference) || match[0] }),
      }),
    ];
  },
});

export default BibleRef;
