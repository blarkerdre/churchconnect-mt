import { useEffect, useRef } from "react";
import { useTour } from "@/components/tour/TourProvider";
import { useTourCompletion } from "@/hooks/useTourCompletion";

/**
 * Auto-launch a tour on first visit for the current user.
 * Silently no-ops if tourId is falsy or the tour is already completed
 * (or was dismissed earlier in this session).
 */
export function useAutoTour(tourId, ctx = {}, delayMs = 700) {
  const tour = useTour();
  const { completed } = useTourCompletion(tourId);

  // Keep the latest tour + ctx in refs so identity churn on the TourProvider
  // context value doesn't re-fire this effect (which used to restart the
  // tour after the user clicked Skip/Close).
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (!tourId) return;
    if (completed !== false) return; // null = still loading, true = done
    const api = tourRef.current;
    if (!api) return;
    if (api.wasDismissed?.(tourId)) return;
    const t = setTimeout(() => {
      const cur = tourRef.current;
      if (cur && !cur.wasDismissed?.(tourId)) {
        cur.startTour(tourId, ctxRef.current);
      }
    }, delayMs);
    return () => clearTimeout(t);
  }, [tourId, completed, delayMs]);
}
