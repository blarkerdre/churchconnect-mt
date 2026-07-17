import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBookSuggestions } from "@/lib/bible/refs";

// Matches the word/token immediately before the cursor.
// Captures optional leading "1 ", "2 ", "3 ", "I", "II", "III" prefix + letters.
const TOKEN_RE = /(?:^|[\s(\[.,;!?"'])((?:(?:[1-3])\s?|(?:I{1,3})\s?)?[A-Za-z][A-Za-z]{1,20})$/;

export default function BibleBookAutocomplete({ editor, containerRef }) {
  const [state, setState] = useState({ open: false, items: [], index: 0, x: 0, y: 0, from: 0, to: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const close = useCallback(() => setState((s) => (s.open ? { ...s, open: false, items: [] } : s)), []);

  const compute = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { state: es } = editor;
    const { $from, empty } = es.selection;
    if (!empty) return close();
    // Only fire inside plain text nodes (not in bibleRef mark, code, headings we allow but skip codeBlock)
    if (editor.isActive("bibleRef") || editor.isActive("codeBlock") || editor.isActive("code")) return close();

    const pos = $from.pos;
    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - 30),
      $from.parentOffset,
      "\n",
      "\0"
    );
    const m = textBefore.match(TOKEN_RE);
    if (!m) return close();
    const token = m[1];
    if (token.length < 2) return close();

    // If a digit follows the token in the doc (e.g., user typed "John 3"), stop suggesting.
    const nextChar = $from.parent.textBetween($from.parentOffset, Math.min($from.parent.content.size, $from.parentOffset + 1));
    if (nextChar && /\S/.test(nextChar)) return close();

    const items = getBookSuggestions(token, 6);
    if (!items.length) return close();

    const from = pos - token.length;
    const to = pos;

    let x = 0, y = 0;
    try {
      const coords = editor.view.coordsAtPos(from);
      x = coords.left;
      y = coords.bottom;
    } catch { /* ignore */ }

    setState((prev) => ({
      open: true,
      items,
      index: prev.open && prev.items.join("|") === items.join("|") ? Math.min(prev.index, items.length - 1) : 0,
      x, y, from, to,
    }));
  }, [editor, close]);

  const insert = useCallback((name) => {
    const s = stateRef.current;
    if (!editor || !s.open) return;
    editor.chain().focus().insertContentAt({ from: s.from, to: s.to }, `${name} `).run();
    close();
  }, [editor, close]);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => compute();
    editor.on("selectionUpdate", onUpdate);
    editor.on("update", onUpdate);
    editor.on("blur", close);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("update", onUpdate);
      editor.off("blur", close);
    };
  }, [editor, compute, close]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onKeyDown = (e) => {
      const s = stateRef.current;
      if (!s.open || !s.items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setState((p) => ({ ...p, index: (p.index + 1) % p.items.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setState((p) => ({ ...p, index: (p.index - 1 + p.items.length) % p.items.length }));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        insert(s.items[s.index]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    dom.addEventListener("keydown", onKeyDown, true);
    return () => dom.removeEventListener("keydown", onKeyDown, true);
  }, [editor, insert, close]);

  if (!state.open || !state.items.length) return null;

  const menu = (
    <div
      role="listbox"
      className="fixed z-[9999] min-w-[180px] max-w-[260px] rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
      style={{ left: state.x, top: state.y + 4 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {state.items.map((name, i) => (
        <button
          key={name}
          type="button"
          role="option"
          aria-selected={i === state.index}
          className={`w-full text-left px-2 py-1 text-sm ${i === state.index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
          onMouseEnter={() => setState((p) => ({ ...p, index: i }))}
          onClick={() => insert(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
