import React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Small badge to differentiate which driver unit a member belongs to.
 * Kingdom Chariot → gold accent; Transportation → navy/primary.
 */
export default function DriverUnitBadge({ unit, className = "" }) {
  if (!unit) return null;
  const isChariot = /kingdom chariot/i.test(unit);
  const label = isChariot ? "Kingdom Chariot" : "Transportation";
  const cls = isChariot
    ? "bg-accent/15 text-accent border-accent/30"
    : "bg-primary/10 text-primary border-primary/20";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cls} ${className}`}>
      {label}
    </Badge>
  );
}
