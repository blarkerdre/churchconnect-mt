import { Star } from "lucide-react";

/**
 * Renders a row of stars for a 1-5 rating.
 * `tone` = "light" for dark backgrounds.
 */
export default function StarRow({ value = 0, size = "h-4 w-4", tone = "default" }) {
  const empty = tone === "light" ? "text-white/25" : "text-muted-foreground/25";
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${size} ${i < Math.round(value) ? "fill-accent text-accent" : empty}`}
        />
      ))}
    </div>
  );
}
