import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cake, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { MemberAvatar } from "@/components/members/MemberAvatar";

export function BirthdayBanner({ firstName }) {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-accent to-chart-4 text-accent-foreground overflow-hidden">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-background/20 flex items-center justify-center shrink-0">
          <Cake className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold leading-tight">
            🎂 Happy Birthday, {firstName}!
          </h3>
          <p className="text-sm opacity-80 mt-0.5">
            Wishing you a blessed and wonderful day!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function BirthdayPhotoLightbox({ member, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fullName} photo`}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="max-w-[92vw] max-h-[85vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {member.photo_url ? (
          <img
            src={member.photo_url}
            alt={fullName}
            className="max-w-[92vw] max-h-[70vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="h-56 w-56 rounded-full bg-accent/20 text-accent flex items-center justify-center text-5xl font-bold">
            {member.first_name?.[0]}{member.last_name?.[0]}
          </div>
        )}
        <div className="text-center text-white">
          <p className="text-lg font-semibold">{fullName}</p>
          {caption && <p className="text-sm opacity-80 mt-0.5">{caption}</p>}
        </div>
      </div>
    </div>
  );
}

export function UpcomingBirthdayItem({ member }) {
  const [open, setOpen] = useState(false);
  const dobDisplay = member.date_of_birth
    ? format(parseISO(member.date_of_birth), "dd MMM")
    : "";

  const today = new Date();
  const dob = member.date_of_birth ? parseISO(member.date_of_birth) : null;
  const isToday =
    dob &&
    dob.getMonth() === today.getMonth() &&
    dob.getDate() === today.getDate();

  const caption = isToday ? "🎂 Today!" : dobDisplay;
  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View photo of ${fullName}`}
        className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 overflow-hidden ring-0 hover:ring-2 hover:ring-accent/50 focus:outline-none focus:ring-2 focus:ring-accent transition"
      >
        <MemberAvatar
          member={member}
          alt=""
          className="h-full w-full object-cover rounded-full"
          fallback={
            <span className="text-xs font-bold">
              {member.first_name?.[0]}{member.last_name?.[0]}
            </span>
          }
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">
          {member.first_name} {member.last_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {caption}
          {member.church_unit && member.church_unit !== "None" && ` · ${member.church_unit}`}
        </p>
      </div>
      {open && (
        <BirthdayPhotoLightbox
          member={member}
          caption={caption}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
