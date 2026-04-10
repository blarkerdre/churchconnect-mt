import React, { useEffect, useCallback, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { cn } from "@/lib/utils";

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
          {activeBanners.map((slide, i) => {
            const img = (
              <img
                src={slide.image_url}
                alt={slide.alt_text || `Banner ${i + 1}`}
                className="w-full h-auto object-cover aspect-[21/9] sm:aspect-[3/1]"
                loading="lazy"
              />
            );
            return (
              <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
                {slide.link_url ? (
                  <a href={slide.link_url} target="_blank" rel="noopener noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
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
