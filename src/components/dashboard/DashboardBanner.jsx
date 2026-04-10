import React, { useEffect, useCallback, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardBanner() {
  const { tenantId } = useTenantQuery();

  const { data: banners = [] } = useQuery({
    queryKey: ["app-settings", "dashboard_banners", tenantId],
    queryFn: async () => {
      let q = supabase.from("app_settings").select("value").eq("key", "dashboard_banners");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) return data.value;
      return [];
    },
  });

  const activeBanners = banners.filter((b) => b?.image_url);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => emblaApi.off("select", onSelect);
  }, [emblaApi, onSelect]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi || activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);
    return () => clearInterval(interval);
  }, [emblaApi, activeBanners.length]);

  if (activeBanners.length === 0) return null;

  return (
    <div className="relative w-full">
      <div ref={emblaRef} className="overflow-hidden rounded-xl">
        <div className="flex">
          {activeBanners.map((slide, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              {slide.type === "book" ? (
                <BookSlide slide={slide} />
              ) : (
                <BannerSlide slide={slide} index={i} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {activeBanners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {activeBanners.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === selectedIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BannerSlide({ slide, index }) {
  const img = (
    <img
      src={slide.image_url}
      alt={slide.alt_text || `Banner ${index + 1}`}
      className="w-full h-auto object-cover aspect-[21/9] sm:aspect-[3/1]"
      loading="lazy"
    />
  );
  return slide.link_url ? (
    <a href={slide.link_url} target="_blank" rel="noopener noreferrer">{img}</a>
  ) : img;
}

function BookSlide({ slide }) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-gradient-to-r from-primary/5 to-accent/10 rounded-xl min-h-[140px]">
      {slide.image_url && (
        <img
          src={slide.image_url}
          alt={slide.title || "Book cover"}
          className="h-32 sm:h-40 w-auto rounded-lg object-cover shadow-md shrink-0"
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary">Book of the Month</p>
        <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight line-clamp-2">{slide.title}</h3>
        {slide.author && <p className="text-xs text-muted-foreground">by {slide.author}</p>}
        {slide.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 hidden sm:block">{slide.description}</p>
        )}
        {slide.purchase_url && (
          <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5 h-7 text-xs">
            <a href={slide.purchase_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" /> Buy Now
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
