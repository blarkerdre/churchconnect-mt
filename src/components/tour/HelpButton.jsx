import React from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { useTour } from "./TourProvider";

/**
 * Small "?" button that (re-)launches a named tour.
 * Give it a `data-tour` value so it can itself be used as the target of a step.
 */
export default function HelpButton({ tourId, ctx, className = "", label = "Take the tour", dataTour }) {
  const tour = useTour();
  if (!tour) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => tour.startTour(tourId, ctx, { manual: true })}
      className={className}
      data-tour={dataTour}
      aria-label={label}
      title={label}
    >
      <HelpCircle className="h-4 w-4 mr-1" /> Tour
    </Button>
  );
}
