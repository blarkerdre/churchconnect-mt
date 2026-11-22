import React from "react";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { MMS_UNITS } from "@/lib/sms-coverage";

// Picks a picture/flyer for a text. picture = { file, preview } | null
export default function SmsPictureAttach({ picture, onChange, recipientCount = 0 }) {
  const { toast } = useToast();
  const pick = (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|gif)$/.test(file.type)) { toast({ title: "Use a JPG, PNG or GIF picture", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Picture must be under 5 MB", variant: "destructive" }); return; }
    onChange({ file, preview: URL.createObjectURL(file) });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {picture ? (
        <div className="relative">
          <img src={picture.preview} alt="Attached picture" className="h-20 w-20 rounded border object-cover" />
          <button type="button" aria-label="Remove picture" onClick={() => onChange(null)} className="absolute -right-2 -top-2 rounded-full border bg-background p-0.5"><X className="h-3 w-3" /></button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <ImagePlus className="h-4 w-4" /> Add picture or flyer
          <input type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}
      {picture && (
        <span className="text-xs text-muted-foreground">
          Picture texts use {MMS_UNITS} units per person{recipientCount > 0 ? ` — ${recipientCount * MMS_UNITS} units for ${recipientCount} ${recipientCount === 1 ? "person" : "people"}` : ""}.
        </span>
      )}
    </div>
  );
}

export async function uploadSmsPicture(tenantId, picture) {
  if (!picture) return undefined;
  const ext = picture.file.type === "image/png" ? "png" : picture.file.type === "image/gif" ? "gif" : "jpg";
  const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("sms-media").upload(path, picture.file, { contentType: picture.file.type });
  if (error) throw new Error("Couldn't upload the picture: " + error.message);
  return path;
}
