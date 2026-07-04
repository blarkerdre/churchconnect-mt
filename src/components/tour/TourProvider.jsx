import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveSteps, TOURS } from "./tours";

const TourCtx = createContext(null);
export const useTour = () => useContext(TourCtx);

const PADDING = 8;
const TOOLTIP_W = 340;
const TOOLTIP_H_EST = 220;
const GAP = 12;

function measure(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  const r = el.getBoundingClientRect();
  return {
    top: r.top + window.scrollY - PADDING,
    left: r.left + window.scrollX - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
    viewportTop: r.top - PADDING,
    viewportLeft: r.left - PADDING,
  };
}

function computeTooltipPos(rect) {
  if (!rect) {
    return {
      centered: true,
      top: window.innerHeight / 2 - TOOLTIP_H_EST / 2,
      left: window.innerWidth / 2 - TOOLTIP_W / 2,
    };
  }
  const spaceBelow = window.innerHeight - (rect.viewportTop + rect.height);
  const spaceAbove = rect.viewportTop;
  const placeBelow = spaceBelow >= TOOLTIP_H_EST + GAP || spaceBelow >= spaceAbove;
  const top = placeBelow
    ? rect.top + rect.height + GAP
    : rect.top - TOOLTIP_H_EST - GAP;
  let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  const maxLeft = window.scrollX + window.innerWidth - TOOLTIP_W - 8;
  const minLeft = window.scrollX + 8;
  left = Math.max(minLeft, Math.min(left, maxLeft));
  return { centered: false, top: Math.max(window.scrollY + 8, top), left };
}

function SpotlightOverlay({ tourId, steps, onClose, onComplete }) {
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const rafRef = useRef(0);

  // Skip missing targets forwards; fall back to centered modal if none present.
  const step = steps[i];
  const rect = useMemo(() => measure(step?.selector), [step, tick]);

  useLayoutEffect(() => {
    // re-measure on scroll/resize
    const onChange = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    const ro = new ResizeObserver(onChange);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    // give the page a moment after step change to lay out, then re-measure
    const t = setTimeout(() => setTick((n) => n + 1), 350);
    return () => clearTimeout(t);
  }, [i]);

  const next = useCallback(() => {
    if (i >= steps.length - 1) {
      onComplete?.();
      onClose?.();
    } else {
      setI(i + 1);
    }
  }, [i, steps.length, onClose, onComplete]);

  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { onClose?.(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onClose]);

  if (!step) return null;

  const pos = computeTooltipPos(rect);
  const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
  const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);

  const isMobile = window.innerWidth < 480;
  const tooltipStyle = isMobile
    ? { position: "fixed", left: 8, right: 8, bottom: 8, width: "auto", maxWidth: "calc(100vw - 16px)" }
    : { position: "absolute", top: pos.top, left: pos.left, width: TOOLTIP_W };

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none" aria-live="polite">
      {/* SVG mask for spotlight */}
      <svg width={docW} height={docH} className="absolute top-0 left-0 pointer-events-auto" onClick={onClose}>
        <defs>
          <mask id="tour-mask">
            <rect width={docW} height={docH} fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx="8"
                ry="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width={docW} height={docH} fill="rgba(15, 23, 42, 0.65)" mask="url(#tour-mask)" />
        {rect && (
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx="8"
            ry="8"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="pointer-events-none"
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto rounded-lg border-2 border-primary/40 bg-background shadow-xl p-4"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Step {i + 1} of {steps.length}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-1"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-display font-bold text-base leading-tight mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-3">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Skip</Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={back} disabled={i === 0}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" onClick={next}>
              {i === steps.length - 1 ? "Finish" : <>Next <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TourProvider({ children }) {
  const auth = useAuth() || {};
  const { user, isAdmin, isTenantAdmin, isTenantOwner, isUnitLeader, isWSFLeader, isReportsOfficer, roles = [] } = auth;
  const isSuperAdmin = roles.includes?.("super_admin");
  const isLeader = !!(isUnitLeader || isWSFLeader);
  const [active, setActive] = useState(null); // { tourId, steps }

  const baseCtx = useMemo(() => ({
    isAdmin: !!isAdmin,
    isTenantAdmin: !!isTenantAdmin,
    isTenantOwner: !!isTenantOwner,
    isSuperAdmin: !!isSuperAdmin,
    isUnitLeader: !!isUnitLeader,
    isWSFLeader: !!isWSFLeader,
    isReportsOfficer: !!isReportsOfficer,
    isLeader,
  }), [isAdmin, isTenantAdmin, isTenantOwner, isSuperAdmin, isUnitLeader, isWSFLeader, isReportsOfficer, isLeader]);

  const startTour = useCallback((tourId, ctx = {}) => {
    const steps = resolveSteps(tourId, { ...baseCtx, ...ctx });
    if (!steps.length) return;
    setActive({ tourId, steps });
  }, [baseCtx]);

  const stopTour = useCallback(() => setActive(null), []);

  const markCompletedRemote = useCallback(async (tourId) => {
    if (!user?.id || !tourId) return;
    try {
      localStorage.setItem(`tour:completed:${user.id}:${tourId}`, "1");
    } catch {}
    await supabase
      .from("user_tour_completions")
      .upsert({ user_id: user.id, tour_id: tourId, completed_at: new Date().toISOString() });
  }, [user?.id]);

  const resetAllTours = useCallback(async () => {
    if (!user?.id) return;
    try {
      Object.keys(TOURS).forEach((id) => {
        try { localStorage.removeItem(`tour:completed:${user.id}:${id}`); } catch {}
      });
    } catch {}
    await supabase.from("user_tour_completions").delete().eq("user_id", user.id);
  }, [user?.id]);

  const value = useMemo(() => ({
    startTour,
    stopTour,
    resetAllTours,
    active: !!active,
    availableTours: Object.keys(TOURS),
  }), [startTour, stopTour, resetAllTours, active]);

  return (
    <TourCtx.Provider value={value}>
      {children}
      {active && (
        <SpotlightOverlay
          tourId={active.tourId}
          steps={active.steps}
          onClose={() => {
            // Skip also marks as "completed" so it doesn't auto-open every time.
            markCompletedRemote(active.tourId);
            setActive(null);
          }}
          onComplete={() => markCompletedRemote(active.tourId)}
        />
      )}
    </TourCtx.Provider>
  );
}
