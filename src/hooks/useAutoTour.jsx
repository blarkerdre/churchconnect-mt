import { useEffect } from "react";
import { useTour } from "@/components/tour/TourProvider";
import { useTourCompletion } from "@/hooks/useTourCompletion";

/**
 * Auto-launch a tour on first visit for the current user.
 * Silently no-ops if tourId is falsy or the tour is already completed.
 */
export function useAutoTour(tourId, ctx = {}, delayMs = 700) {
  const tour = useTour();
  const { completed } = useTourCompletion(tourId);

  useEffect(() => {
    if (!tourId) return;
    if (completed !== false) return; // null = still loading, true = done
    if (!tour) return;
    const t = setTimeout(() => tour.startTour(tourId, ctx), delayMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, completed, tour]);
}
