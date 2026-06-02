import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cake } from "lucide-react";
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

export function UpcomingBirthdayItem({ member }) {
  const dobDisplay = member.date_of_birth
    ? format(parseISO(member.date_of_birth), "dd MMM")
    : "";

  const today = new Date();
  const dob = member.date_of_birth ? parseISO(member.date_of_birth) : null;
  const isToday =
    dob &&
    dob.getMonth() === today.getMonth() &&
    dob.getDate() === today.getDate();

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="h-9 w-9 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 overflow-hidden">
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
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">
          {member.first_name} {member.last_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {isToday ? "🎂 Today!" : dobDisplay}
          {member.church_unit && member.church_unit !== "None" && ` · ${member.church_unit}`}
        </p>
      </div>
    </div>
  );
}
