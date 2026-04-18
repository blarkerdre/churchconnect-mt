import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Home, MessageSquarePlus, Loader2, ChevronDown, ChevronUp, Phone, Mail, MapPin, UserX } from "lucide-react";
import { format } from "date-fns";
import ReferralUpdateDialog from "./ReferralUpdateDialog";

function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

const statusColors = {
  pending: "bg-accent/10 text-accent",
  contacted: "bg-primary/10 text-primary",
  engaged: "bg-chart-4/10 text-chart-4",
  joined: "bg-chart-3/10 text-chart-3",
  declined: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export default function ReferralTimeline({ followupId, profileMap = {} }) {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState({});
  const [updateRef, setUpdateRef] = useState(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["followup-referrals", followupId, tenantId],
    enabled: !!followupId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referrals")
          .select("*, wsf_centres(name, location, city, address, postcode)")
          .eq("followup_id", followupId)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
  });

  const referralIds = referrals.map(r => r.id);
  const { data: updates = [] } = useQuery({
    queryKey: ["referral-updates", referralIds, tenantId],
    enabled: referralIds.length > 0 && !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referral_updates")
          .select("*")
          .in("referral_id", referralIds)
          .order("created_at", { ascending: true })
      );
      if (error) throw error;
      return data;
    },
  });

  const leaderIds = [...new Set(referrals.map(r => r.assigned_leader_id).filter(Boolean))];
  const { data: leaders = [] } = useQuery({
    queryKey: ["referral-leaders", leaderIds, tenantId],
    enabled: leaderIds.length > 0 && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, avatar_url")
        .in("user_id", leaderIds);
      if (error) throw error;
      return data;
    },
  });
  const leaderMap = leaders.reduce((acc, p) => { acc[p.user_id] = p; return acc; }, {});

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (!referrals.length) return null;

  const updatesByRef = updates.reduce((acc, u) => {
    (acc[u.referral_id] ||= []).push(u);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sign-Posts</p>
      {referrals.map(r => {
        const isUnit = r.referral_type === "unit_leader";
        const Icon = isUnit ? Users : Home;
        const target = isUnit
          ? r.target_unit_name
          : (r.wsf_centres?.name || "Home Cell");
        const sub = isUnit ? "Unit" : (r.wsf_centres?.location || r.wsf_centres?.city || "");
        const refUpdates = updatesByRef[r.id] || [];
        const isExpanded = expanded[r.id];
        const canUpdate = r.assigned_leader_id === user?.id || r.referred_by === user?.id;
        const leader = r.assigned_leader_id ? leaderMap[r.assigned_leader_id] : null;
        const leaderName = leader?.full_name || profileMap[r.assigned_leader_id];
        const roleLabel = isUnit ? "Unit Leader" : "Home Cell Leader";
        const centreAddress = !isUnit
          ? [r.wsf_centres?.address, r.wsf_centres?.postcode].filter(Boolean).join(", ")
          : "";

        return (
          <div key={r.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{target}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {sub && <span>{sub} · </span>}
                    <span>{format(new Date(r.created_at), "dd MMM")}</span>
                  </p>
                </div>
              </div>
              <Badge className={`text-[10px] border-0 ${statusColors[r.status] || ""}`}>{r.status}</Badge>
            </div>

            {/* Assigned Leader block */}
            <div className="bg-background/60 border border-border/50 rounded-md p-2.5 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned Leader</p>
              {leader || leaderName ? (
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={leader?.avatar_url || undefined} alt={leaderName || "Leader"} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(leaderName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{leaderName || "Leader"}</p>
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4">{roleLabel}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      {leader?.phone && (
                        <a href={`tel:${leader.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                          <Phone className="h-3 w-3" /> {leader.phone}
                        </a>
                      )}
                      {leader?.email && (
                        <a href={`mailto:${leader.email}`} className="flex items-center gap-1 text-primary hover:underline truncate max-w-full">
                          <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{leader.email}</span>
                        </a>
                      )}
                    </div>
                    {centreAddress && (
                      <p className="flex items-start gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> <span>{centreAddress}</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <UserX className="h-3.5 w-3.5" /> Leader account not linked
                </div>
              )}
            </div>

            {r.notes && (
              <p className="text-xs text-foreground/80 bg-background/50 rounded p-2 whitespace-pre-wrap">{r.notes}</p>
            )}

            {refUpdates.length > 0 && (
              <button
                onClick={() => setExpanded(e => ({ ...e, [r.id]: !e[r.id] }))}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {refUpdates.length} update{refUpdates.length !== 1 ? "s" : ""}
              </button>
            )}

            {isExpanded && refUpdates.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border/50">
                {refUpdates.map(u => (
                  <div key={u.id} className="text-xs space-y-0.5 pt-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {profileMap[u.author_id] || "Leader"}
                      </span>
                      <span>· {format(new Date(u.created_at), "dd MMM, HH:mm")}</span>
                      {u.status_change && (
                        <Badge className={`text-[9px] border-0 ${statusColors[u.status_change]}`}>
                          → {u.status_change}
                        </Badge>
                      )}
                    </div>
                    <p className="text-foreground/80 whitespace-pre-wrap">{u.update_text}</p>
                  </div>
                ))}
              </div>
            )}

            {canUpdate && r.status !== "closed" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                onClick={() => setUpdateRef(r)}
              >
                <MessageSquarePlus className="h-3 w-3 mr-1" /> Add Update
              </Button>
            )}
          </div>
        );
      })}

      <ReferralUpdateDialog
        open={!!updateRef}
        onOpenChange={(v) => !v && setUpdateRef(null)}
        referral={updateRef}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["followup-referrals", followupId] });
          queryClient.invalidateQueries({ queryKey: ["referral-updates"] });
          setUpdateRef(null);
        }}
      />
    </div>
  );
}
