import { Mark, mergeAttributes, markPasteRule, markInputRule } from "@tiptap/core";
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
    // Trigger when the user types a space/punctuation right after a reference.
    return [
      {
        find: /(?:^|\s)((?:(?:1|2|3|I{1,3})\s*)?(?:Song\s+of\s+Solomon|Song\s+of\s+Songs|[A-Za-z][A-Za-z.]{1,20}(?:\s+of\s+[A-Za-z]+)?)\.?\s+\d{1,3}(?::\d{1,3}(?:\s*-\s*\d{1,3})?(?:\s*,\s*\d{1,3}(?:\s*-\s*\d{1,3})?)*)?)([\s.,;!?)])$/,
        handler: ({ state, range, match, chain }) => {
          const raw = match[1];
          const trailing = match[2];
          if (!REFERENCE_REGEX.test(raw.trim())) return null;
          // Compute the exact positions of the reference substring in the matched range.
          const full = match[0];
          const refStartInMatch = full.indexOf(raw);
          const from = range.from + refStartInMatch;
          const to = from + raw.length;
          chain()
            .setTextSelection({ from, to })
            .setMark(this.type, { reference: raw.trim() })
            .setTextSelection(range.to)
            .unsetMark(this.type)
            .insertContent(trailing)
            .run();
          return true;
        },
      },
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: (text) => {
          const hits = findReferencesInText(text);
          return hits.map((h) => ({
            index: h.start,
            text: h.match,
            data: { reference: h.match },
          }));
        },
        type: this.type,
        getAttributes: (match) => ({ reference: match.data.reference }),
      }),
    ];
  },
});

export default BibleRef;
