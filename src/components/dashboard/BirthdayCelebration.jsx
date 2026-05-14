import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cake, Send, Loader2, Check } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
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
  const { isTenantAdmin } = useAuth();
  const { tenantId } = useTenant();
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const dobDisplay = member.date_of_birth
    ? format(parseISO(member.date_of_birth), "dd MMM")
    : "";

  const today = new Date();
  const dob = member.date_of_birth ? parseISO(member.date_of_birth) : null;
  const isToday =
    dob &&
    dob.getMonth() === today.getMonth() &&
    dob.getDate() === today.getDate();

  const showAdminAction = isTenantAdmin && isToday && tenantId;

  const { data: settings } = useQuery({
    enabled: !!showAdminAction,
    queryKey: ["birthday_message_settings", tenantId, "mini"],
    queryFn: async () => {
      const { data } = await supabase
        .from("birthday_message_settings")
        .select("enabled, channels")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data;
    },
  });

  const todayStr = today.toISOString().slice(0, 10);
  const { data: alreadySent, refetch: refetchLog } = useQuery({
    enabled: !!showAdminAction && !!settings?.enabled,
    queryKey: ["birthday_message_log", tenantId, member.id, todayStr],
    queryFn: async () => {
      const { count } = await supabase
        .from("birthday_message_log")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("member_id", member.id)
        .eq("sent_on", todayStr)
        .eq("status", "sent");
      return (count ?? 0) > 0;
    },
  });

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-birthday-messages", {
        body: {
          tenant_id: tenantId,
          member_id: member.id,
          channels: settings?.channels,
        },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      if (sent > 0) {
        toast.success("Birthday wishes sent", {
          description: `${sent} message${sent === 1 ? "" : "s"} dispatched`,
        });
        setJustSent(true);
        refetchLog();
      } else {
        toast.message("No messages sent", {
          description: data?.failed
            ? `${data.failed} failed — check channel settings`
            : "Already sent today or no enabled channels",
        });
      }
    } catch (err) {
      toast.error("Failed to send", { description: err.message });
    } finally {
      setSending(false);
    }
  };

  const sent = alreadySent || justSent;
  const canSend = showAdminAction && settings?.enabled;

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
      {canSend && (
        <Button
          size="sm"
          variant={sent ? "outline" : "secondary"}
          className="h-7 px-2 text-xs gap-1 shrink-0"
          onClick={handleSend}
          disabled={sending || sent}
        >
          {sending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : sent ? (
            <Check className="h-3 w-3" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          {sent ? "Sent" : "Send wishes"}
        </Button>
      )}
    </div>
  );
}
