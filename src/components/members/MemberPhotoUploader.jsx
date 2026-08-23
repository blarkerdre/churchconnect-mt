import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import {
  uploadProfilePhoto,
  removeOldProfilePhoto,
  friendlyUploadError,
  ACCEPTED_PHOTO_TYPES,
} from "@/lib/image-upload";

/**
 * Admin-facing avatar uploader used in the member edit dialog.
 * Photos live in the member's own user folder when the member has a linked
 * account, otherwise in a `member-<id>` folder (both covered by storage RLS
 * scoped to the member's church).
 */
export default function MemberPhotoUploader({ member, tenantId, photoUrl, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !member?.id) return;
    setUploading(true);
    try {
      const previousPath = photoUrl || member.photo_url || null;
      const folder = member.user_id || `member-${member.id}`;
      const path = await uploadProfilePhoto({ file, folder, previousPath, tenantId });

      const { error } = await supabase
        .from("members")
        .update({ photo_url: path })
        .eq("id", member.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;

      await removeOldProfilePhoto(previousPath, path);
      onChange?.(path);
      toast({ title: "Member photo updated" });
    } catch (err) {
      console.error("Member photo upload error:", err);
      toast({ title: "Upload failed", description: friendlyUploadError(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative shrink-0 cursor-pointer group"
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <MemberAvatar
          photoUrl={photoUrl || member?.photo_url || null}
          member={member}
          alt=""
          className="h-14 w-14 rounded-full object-cover"
          fallback={
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {(member?.first_name?.[0] || "").toUpperCase()}
              {(member?.last_name?.[0] || "").toUpperCase()}
            </div>
          }
        />
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
          ) : (
            <Camera className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Profile photo</p>
        <p>Tap the avatar to upload a JPG, PNG or WEBP (max 5MB).</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
