import { Quote, ExternalLink } from "lucide-react";
import { useTrustpilotSettings, useTrustpilotReviews } from "@/hooks/useTrustpilot";
import StarRow from "@/components/reviews/StarRow";

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

/**
 * Public testimonials section driven by real Trustpilot reviews entered by a
 * super admin. Renders nothing when there is nothing genuine to show.
 */
export default function TrustpilotReviews() {
  const { data: settings } = useTrustpilotSettings();
  const { data: reviews = [] } = useTrustpilotReviews();

  if (!settings?.is_enabled || reviews.length === 0) return null;

  const score = settings.overall_score ? Number(settings.overall_score) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ChurchConnect",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    ...(score && settings.total_reviews
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: score,
            reviewCount: settings.total_reviews,
            bestRating: 5,
          },
        }
      : {}),
    review: reviews.slice(0, 10).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.stars, bestRating: 5 },
      author: { "@type": "Person", name: r.reviewer_name },
      ...(r.review_date ? { datePublished: r.review_date } : {}),
      ...(r.title ? { name: r.title } : {}),
      reviewBody: r.body,
    })),
  };

  return (
    <section id="reviews" className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl">
            What churches say about us
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Verified feedback left by churches using ChurchConnect, published on Trustpilot.
          </p>
          {score && (
            <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <StarRow value={score} size="h-5 w-5" />
              <span className="text-sm font-semibold text-foreground">{score.toFixed(1)} out of 5</span>
              {settings.total_reviews ? (
                <span className="text-sm text-muted-foreground">based on {settings.total_reviews} reviews</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <figure key={r.id} className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <StarRow value={r.stars} />
                <Quote className="h-4 w-4 text-muted-foreground/40" />
              </div>
              {r.title && (
                <figcaption className="mt-3 font-display text-base font-semibold text-card-foreground">
                  {r.title}
                </figcaption>
              )}
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {r.body}
              </blockquote>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {r.reviewer_name}
                  {r.reviewer_location ? `, ${r.reviewer_location}` : ""}
                </span>
                {formatDate(r.review_date) && <span>{formatDate(r.review_date)}</span>}
              </div>
            </figure>
          ))}
        </div>

        {settings.profile_url && (
          <div className="mt-10 text-center">
            <a
              href={settings.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Read all reviews on Trustpilot <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
