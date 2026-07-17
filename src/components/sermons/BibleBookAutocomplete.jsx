import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getBookSuggestions } from "@/lib/bible/refs";

const TOKEN_RE = /(?:^|[\s(\[.,;!?"'])((?:(?:[1-3])\s?|(?:I{1,3})\s?)?[A-Za-z][A-Za-z]{1,20})$/;

export default function BibleBookAutocomplete({ editor }) {
  const [state, setState] = useState({ open: false, items: [], index: 0, x: 0, y: 0, caretTop: 0, from: 0, to: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const menuRef = useRef(null);

  const close = useCallback(
    () => setState((s) => (s.open ? { ...s, open: false, items: [] } : s)),
    []
  );

  const compute = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { state: es } = editor;
    const { $from, empty } = es.selection;
    if (!empty) return close();
    if (editor.isActive("bibleRef") || editor.isActive("codeBlock") || editor.isActive("code")) return close();

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

    const nextChar = $from.parent.textBetween(
      $from.parentOffset,
      Math.min($from.parent.content.size, $from.parentOffset + 1)
    );
    if (nextChar && /\S/.test(nextChar)) return close();

    const items = getBookSuggestions(token, 6);
    if (!items.length) return close();

    const pos = $from.pos;
    const from = pos - token.length;
    const to = pos;

    let x = 0, y = 0, caretTop = 0;
    try {
      const coords = editor.view.coordsAtPos(from);
      x = coords.left;
      y = coords.bottom;
      caretTop = coords.top;
    } catch { /* ignore */ }

    setState((prev) => ({
      open: true,
      items,
      index: prev.open && prev.items.join("|") === items.join("|") ? Math.min(prev.index, items.length - 1) : 0,
      x, y, caretTop, from, to,
    }));
  }, [editor, close]);

  const insert = useCallback((name) => {
    const s = stateRef.current;
    if (!editor || !s.open) return;
    editor.commands.insertContentAt({ from: s.from, to: s.to }, `${name} `);
    close();
  }, [editor, close]);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => compute();
    editor.on("selectionUpdate", onUpdate);
    editor.on("update", onUpdate);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("update", onUpdate);
    };
  }, [editor, compute]);

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

  // Outside tap/click closes menu.
  useEffect(() => {
    if (!state.open) return;
    const onDown = (e) => {
      const menu = menuRef.current;
      const edDom = editor?.view?.dom;
      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      if (menu && path.includes(menu)) return;
      if (edDom && path.includes(edDom)) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [state.open, editor, close]);

  // Clamp within viewport after render.
  useLayoutEffect(() => {
    if (!state.open || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = state.x;
    let top = state.y + 4;
    if (left + rect.width > vw - 8) left = Math.max(8, vw - rect.width - 8);
    if (left < 8) left = 8;
    if (top + rect.height > vh - 8) {
      // Flip above caret
      top = Math.max(8, state.caretTop - rect.height - 4);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [state.open, state.x, state.y, state.caretTop, state.items]);

  if (!state.open || !state.items.length) return null;

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      className="fixed z-[9999] min-w-[180px] max-w-[260px] rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
      style={{ left: state.x, top: state.y + 4 }}
    >
      <div
        className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 select-none"
        onPointerDown={(e) => e.preventDefault()}
      >
        Bible books
      </div>
      {state.items.map((name, i) => (
        <button
          key={name}
          type="button"
          role="option"
          aria-selected={i === state.index}
          className={`w-full text-left px-2 py-2 min-h-[36px] text-sm select-none touch-manipulation ${i === state.index ? "bg-accent text-accent-foreground" : "hover:bg-accent/60 active:bg-accent"}`}
          onMouseMove={() => setState((p) => (p.index === i ? p : { ...p, index: i }))}
          onPointerDown={(e) => { e.preventDefault(); insert(name); }}
        >
          {name}
        </button>
      ))}
    </div>
  );

  return createPortal(menu, document.body);
}
