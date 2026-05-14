import React from "react";
import { useSignedMemberPhoto } from "@/hooks/useSignedMemberPhoto";

/**
 * Renders a member's profile photo. Accepts either:
 *  - `photoUrl` prop (string) — storage path or legacy full URL
 *  - `member` prop (object) with `photo_url`
 *
 * If no photo is available, renders the optional `fallback` node, or initials
 * derived from the member's name when `member` is provided.
 */
export function MemberAvatar({
  photoUrl,
  member,
  alt = "",
  className = "h-10 w-10 rounded-full object-cover",
  fallbackClassName = "h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm",
  fallback,
  ...rest
}) {
  const stored = photoUrl ?? member?.photo_url ?? null;
  const { url } = useSignedMemberPhoto(stored);

  if (url) {
    return <img src={url} alt={alt} className={className} {...rest} />;
  }

  if (fallback !== undefined) return fallback;

  const initials =
    member && (member.first_name || member.last_name)
      ? `${(member.first_name?.[0] || "").toUpperCase()}${(member.last_name?.[0] || "").toUpperCase()}`
      : null;

  return <div className={fallbackClassName}>{initials}</div>;
}

export default MemberAvatar;
