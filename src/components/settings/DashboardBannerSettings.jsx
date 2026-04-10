import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, GripVertical, Upload, ImageIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "@/components/ui/use-toast";
import DashboardBanner from "@/components/dashboard/DashboardBanner";

export default function DashboardBannerSettings() {
  const qc = useQueryClient();
  const { tenantId, withTenant } = useTenantQuery();
  const [uploading, setUploading] = useState(null); // index being uploaded

  const { data: banners = [], isLoading } = useQuery({
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

  const saveMutation = useMutation({
    mutationFn: async (newBanners) => {
      // Check if setting already exists
      let q = supabase.from("app_settings").select("id").eq("key", "dashboard_banners");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: newBanners, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const row = withTenant({
          key: "dashboard_banners",
          value: newBanners,
        });
        const { error } = await supabase.from("app_settings").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", "dashboard_banners"] });
      toast({ title: "Banners saved" });
    },
    onError: (e) => toast({ title: "Error saving banners", description: e.message, variant: "destructive" }),
  });

  const updateSlide = (index, field, value) => {
    const updated = [...banners];
    updated[index] = { ...updated[index], [field]: value };
    saveMutation.mutate(updated);
  };

  const addSlide = () => {
    saveMutation.mutate([...banners, { image_url: "", link_url: "", alt_text: "" }]);
  };

  const removeSlide = (index) => {
    const updated = banners.filter((_, i) => i !== index);
    saveMutation.mutate(updated);
  };

  const handleImageUpload = async (index, file) => {
    if (!file || !tenantId) return;
    setUploading(index);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/banners/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("church-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("church-documents").getPublicUrl(path);
      updateSlide(index, "image_url", urlData.publicUrl);
    } catch (e) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin mx-auto" />;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-display flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Dashboard Banner Slideshow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        {banners.some((b) => b.image_url) && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Preview</Label>
            <DashboardBanner />
          </div>
        )}

        {/* Slides list */}
        {banners.map((slide, i) => (
          <div key={i} className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Slide {i + 1}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSlide(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Image upload */}
            {slide.image_url ? (
              <img src={slide.image_url} alt="" className="w-full h-20 object-cover rounded-md" />
            ) : null}
            <div>
              <Label className="text-xs">Image</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => handleImageUpload(i, e.target.files?.[0])}
                  disabled={uploading === i}
                />
                {uploading === i && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>

            <div>
              <Label className="text-xs">Link URL (optional)</Label>
              <Input
                value={slide.link_url || ""}
                onChange={(e) => updateSlide(i, "link_url", e.target.value)}
                placeholder="https://..."
                className="text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Alt text (optional)</Label>
              <Input
                value={slide.alt_text || ""}
                onChange={(e) => updateSlide(i, "alt_text", e.target.value)}
                placeholder="Describe this banner"
                className="text-xs"
              />
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" className="w-full" onClick={addSlide}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Slide
        </Button>
      </CardContent>
    </Card>
  );
}
