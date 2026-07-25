import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, RefreshCw } from "lucide-react";
import { lookupVerses, prewarmBible } from "@/lib/bible/refs";

/**
 * Delegated hover/tap Bible verse popover for any [data-bible-ref] inside
 * containerRef.current. Handles touch devices, scroll reposition and errors.
 */
export default function BibleRefPopover({ containerRef }) {
  const [state, setState] = useState({
    open: false,
    anchor: null,
    ref: null,
    data: null,
    loading: false,
    error: false,
  });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const hideTimer = useRef(null);
  const cache = useRef(new Map());
  const isCoarse = typeof window !== "undefined" && window.matchMedia?.("(hover: none)")?.matches;

  useEffect(() => {
    prewarmBible();
  }, []);

  const fetchRef = useCallback(async (reference) => {
    if (cache.current.has(reference)) {
      const cached = cache.current.get(reference);
      setState((s) => (s.ref === reference ? { ...s, data: cached, loading: false, error: false } : s));
      return;
    }
    try {
      const data = await lookupVerses(reference);
      cache.current.set(reference, data);
      setState((s) => (s.ref === reference ? { ...s, data, loading: false, error: false } : s));
    } catch {
      setState((s) => (s.ref === reference ? { ...s, data: null, loading: false, error: true } : s));
    }
  }, []);

  const computePos = useCallback((el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const isMobile = window.innerWidth < 480;
    if (isMobile) {
      return { top: 0, left: 8, mobile: true };
    }
    const width = 320;
    const top = Math.min(window.innerHeight - 20, rect.bottom + 6);
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
    return { top, left, mobile: false };
  }, []);


  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const clearHide = () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
    const scheduleHide = () => {
      clearHide();
      hideTimer.current = setTimeout(() => setState((s) => ({ ...s, open: false })), 180);
    };

    const show = (el) => {
      const reference = el.getAttribute("data-bible-ref");
      if (!reference) return;
      clearHide();
      const p = computePos(el);
      if (p) setPos(p);
      const cached = cache.current.get(reference);
      setState({
        open: true,
        anchor: el,
        ref: reference,
        data: cached || null,
        loading: !cached,
        error: false,
      });
      if (!cached) fetchRef(reference);
    };

    const onMouseOver = (e) => {
      if (isCoarse) return;
      const el = e.target.closest?.("[data-bible-ref]");
      if (el && container.contains(el)) show(el);
    };
    const onMouseOut = (e) => {
      if (isCoarse) return;
      const el = e.target.closest?.("[data-bible-ref]");
      if (el) scheduleHide();
    };
    const onClick = (e) => {
      const el = e.target.closest?.("[data-bible-ref]");
      if (el && container.contains(el)) {
        e.preventDefault();
        show(el);
      }
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
  }, [containerRef, fetchRef, computePos, isCoarse]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!state.open || !state.anchor) return;
    const update = () => {
      const p = computePos(state.anchor);
      if (p) setPos(p);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [state.open, state.anchor, computePos]);

  if (!state.open || !state.anchor) return null;

  const onEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  const onLeave = () => {
    if (!isCoarse) setState((s) => ({ ...s, open: false }));
  };
  const onRetry = () => {
    if (!state.ref) return;
    cache.current.delete(state.ref);
    setState((s) => ({ ...s, loading: true, error: false, data: null }));
    fetchRef(state.ref);
  };
  const onClose = () => setState((s) => ({ ...s, open: false }));

  const isMobile = pos.mobile;
  const style = isMobile
    ? {
        position: "fixed",
        bottom: 8,
        left: 8,
        right: 8,
        maxWidth: "calc(100vw - 16px)",
        zIndex: 60,
      }
    : {
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 320,
        zIndex: 60,
      };

  const scrollHeight = isMobile ? "min(52vh, 360px)" : "min(60vh, 320px)";

  const stop = (e) => e.stopPropagation();
  const stopScrollPropagation = (e) => e.stopPropagation();

  return createPortal(
    <div
      data-bible-popover
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={stop}
      onTouchStart={stop}
      style={style}
      className="pointer-events-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-3 flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 mb-1">
        <div className="text-xs font-semibold text-primary">
          {state.data?.ref
            ? `${state.data.ref.book} ${state.data.ref.chapter}${
                state.data.ref.verses.length
                  ? ":" +
                    state.data.ref.verses
                      .map((v) => (v.start === v.end ? v.start : `${v.start}-${v.end}`))
                      .join(",")
                  : ""
              } · KJV`
            : `${state.ref} · KJV`}
        </div>
        {(isCoarse || isMobile) && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground -mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {state.loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading verse…
        </div>
      ) : state.error ? (
        <div className="text-xs">
          <div className="text-muted-foreground mb-1.5">Couldn't load verse. Check your connection.</div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      ) : state.data?.notFound || !state.data?.verses?.length ? (
        <div className="text-xs text-muted-foreground">Verse not found.</div>
      ) : (
        <div
          className="min-h-0 overflow-y-auto overscroll-contain pr-1 text-sm leading-relaxed [scrollbar-gutter:stable]"
          onWheel={stopScrollPropagation}
          onTouchMove={stopScrollPropagation}
          style={{
            maxHeight: scrollHeight,
            height: scrollHeight,
            touchAction: "pan-y",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
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


