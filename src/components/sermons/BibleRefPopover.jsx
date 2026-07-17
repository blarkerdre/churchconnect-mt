import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { lookupVerses, prewarmBible } from "@/lib/bible/refs";

/**
 * Attaches a delegated hover/tap popover to any element with [data-bible-ref]
 * inside `containerRef.current`. Renders a floating card via portal.
 */
export default function BibleRefPopover({ containerRef }) {
  const [state, setState] = useState({ open: false, anchor: null, ref: null, data: null, loading: false });
  const hideTimer = useRef(null);
  const cache = useRef(new Map());

  useEffect(() => { prewarmBible(); }, []);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const clearHide = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
    const scheduleHide = () => { clearHide(); hideTimer.current = setTimeout(() => setState((s) => ({ ...s, open: false })), 180); };

    const show = async (el) => {
      const reference = el.getAttribute("data-bible-ref");
      if (!reference) return;
      clearHide();
      setState({ open: true, anchor: el, ref: reference, data: cache.current.get(reference) || null, loading: !cache.current.has(reference) });
      if (!cache.current.has(reference)) {
        try {
          const data = await lookupVerses(reference);
          cache.current.set(reference, data);
          setState((s) => (s.ref === reference ? { ...s, data, loading: false } : s));
        } catch {
          setState((s) => (s.ref === reference ? { ...s, data: null, loading: false } : s));
        }
      }
    };

    const onMouseOver = (e) => {
      const el = e.target.closest?.("[data-bible-ref]");
      if (el && container.contains(el)) show(el);
    };
    const onMouseOut = (e) => {
      const el = e.target.closest?.("[data-bible-ref]");
      if (el) scheduleHide();
    };
    const onClick = (e) => {
      const el = e.target.closest?.("[data-bible-ref]");
      if (el && container.contains(el)) { e.preventDefault(); show(el); }
    };
    const onDocClick = (e) => {
      if (!e.target.closest?.("[data-bible-ref]") && !e.target.closest?.("[data-bible-popover]")) {
        setState((s) => ({ ...s, open: false }));
      }
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mouseout", onMouseOut);
    container.addEventListener("click", onClick);
    document.addEventListener("click", onDocClick);
    return () => {
      container.removeEventListener("mouseover", onMouseOver);
      container.removeEventListener("mouseout", onMouseOut);
      container.removeEventListener("click", onClick);
      document.removeEventListener("click", onDocClick);
      clearHide();
    };
  }, [containerRef]);

  if (!state.open || !state.anchor) return null;
  const rect = state.anchor.getBoundingClientRect();
  const top = Math.min(window.innerHeight - 20, rect.bottom + 6);
  const left = Math.max(8, Math.min(window.innerWidth - 320 - 8, rect.left));

  const onEnter = () => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } };
  const onLeave = () => setState((s) => ({ ...s, open: false }));

  return createPortal(
    <div
      data-bible-popover
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: "fixed", top, left, width: 320, zIndex: 60 }}
      className="rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-3"
    >
      <div className="text-xs font-semibold text-primary mb-1">
        {state.data?.ref ? `${state.data.ref.book} ${state.data.ref.chapter}${state.data.ref.verses.length ? ":" + state.data.ref.verses.map(v => v.start===v.end?v.start:`${v.start}-${v.end}`).join(",") : ""}` : state.ref} · KJV
      </div>
      {state.loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading verse…</div>
      ) : state.data?.notFound || !state.data?.verses?.length ? (
        <div className="text-xs text-muted-foreground">Verse not found.</div>
      ) : (
        <div className="text-sm leading-relaxed max-h-[240px] overflow-y-auto">
          {state.data.verses.map((v) => (
            <span key={v.n}>
              <sup className="text-[10px] text-muted-foreground mr-0.5">{v.n}</sup>
              {v.text}{" "}
            </span>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
