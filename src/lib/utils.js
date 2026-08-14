import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Format a date/timestamp as "14 Aug 2026, 14:13".
 * Returns "—" for missing/invalid values.
 */
export function formatDateTime(value, fallback = "—") {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return fallback;
  return format(d, "dd MMM yyyy, HH:mm");
}
