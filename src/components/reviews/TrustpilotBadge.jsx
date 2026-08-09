import { useTrustpilotSettings } from "@/hooks/useTrustpilot";
import StarRow from "@/components/reviews/StarRow";

/**
 * Compact "Rated X out of 5 on Trustpilot" badge.
 * Renders nothing until a super admin has enabled and filled in the settings.
 */
export default function TrustpilotBadge({ tone = "default", className = "" }) {
  const { data: settings } = useTrustpilotSettings();

  if (!settings?.is_enabled || !settings?.overall_score) return null;

  const light = tone === "light";
  const inner = (
    <>
      <StarRow value={Number(settings.overall_score)} tone={tone} />
      <span className={`text-sm font-medium ${light ? "text-white" : "text-foreground"}`}>
        {Number(settings.overall_score).toFixed(1)} / 5
      </span>
      {settings.total_reviews ? (
        <span className={`text-xs ${light ? "text-white/70" : "text-muted-foreground"}`}>
          {settings.total_reviews} reviews on Trustpilot
        </span>
      ) : (
        <span className={`text-xs ${light ? "text-white/70" : "text-muted-foreground"}`}>on Trustpilot</span>
      )}
    </>
  );

  const base = `inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
    light ? "border-white/20 bg-white/10 backdrop-blur-sm" : "border-border bg-card"
  } ${className}`;

  if (settings.profile_url) {
    return (
      <a href={settings.profile_url} target="_blank" rel="noopener noreferrer" className={`${base} transition-colors hover:opacity-90`}>
        {inner}
      </a>
    );
  }
  return <div className={base}>{inner}</div>;
}
