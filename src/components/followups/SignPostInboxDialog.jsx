import React, { useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { Inbox, Users, Home, Sparkles, ChevronRight } from "lucide-react";
import SignPostDetailPanel from "./SignPostDetailPanel";

const statusColors = {
  pending: "bg-accent/10 text-accent border-accent/20",
  contacted: "bg-primary/10 text-primary border-primary/20",
  engaged: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  joined: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  declined: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
};

function statusGroup(s) {
  if (s === "pending") return "new";
  if (["contacted", "engaged"].includes(s)) return "in_progress";
  return "completed"; // joined, declined, closed
}

export default function SignPostInboxDialog({ open, onOpenChange, onCreateFollowup }) {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["signpost-inbox", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referrals")
          .select(`
            id, status, referral_type, target_unit_name, created_at, notes, tenant_id, referred_by,
            wsf_centres(name),
            members(first_name, last_name, phone, email)
          `)
          .eq("assigned_leader_id", user.id)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      const refIds = [...new Set((data || []).map(r => r.referred_by).filter(Boolean))];
      let pmap = {};
      if (refIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", refIds);
        pmap = Object.fromEntries((profs || []).map(p => [p.user_id, p]));
      }
      return (data || []).map(r => ({ ...r, referrer: pmap[r.referred_by] || null }));
    },
  });

  const grouped = useMemo(() => {
    const g = { new: [], in_progress: [], completed: [] };
    referrals.forEach(r => g[statusGroup(r.status)].push(r));
    return g;
  }, [referrals]);

  const renderRow = (r) => {
    const isUnit = r.referral_type === "unit_leader";
    const Icon = isUnit ? Users : Home;
    const memberName = r.members ? `${r.members.first_name} ${r.members.last_name}` : "Member";
    const target = isUnit ? r.target_unit_name : (r.wsf_centres?.name || "Home Cell");

    return (
      <button
        key={r.id}
        onClick={() => setSelectedId(r.id)}
        className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors flex items-start gap-3"
      >
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
            <Badge className={`text-[10px] border ${statusColors[r.status] || ""}`}>{r.status}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            via {target} · from {r.referrer?.full_name || "Follow-up team"}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
          </p>
          {r.notes && (
            <p className="text-[11px] text-foreground/70 mt-1 line-clamp-2">{r.notes}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </button>
    );
  };

  const renderEmpty = (msg) => (
    <div className="text-center py-10 text-muted-foreground text-sm">
      <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
      {msg}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <TenantDialogHeader>
            <Sparkles className="h-4 w-4" /> Sign-Post Inbox
          </TenantDialogHeader>

          <div className="px-6 pb-2 -mt-2">
            <p className="text-xs text-muted-foreground">
              Members signposted to you for unit or home cell follow-up.
            </p>
          </div>

          <Tabs defaultValue="new" className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
            <TabsList className="grid grid-cols-3 mb-3">
              <TabsTrigger value="new" className="text-xs">
                New <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{grouped.new.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs">
                In Progress <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{grouped.in_progress.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">
                Completed <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{grouped.completed.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              <TabsContent value="new" className="space-y-2 mt-0">
                {isLoading ? renderEmpty("Loading…") : grouped.new.length === 0 ? renderEmpty("No new referrals.") : grouped.new.map(renderRow)}
              </TabsContent>
              <TabsContent value="in_progress" className="space-y-2 mt-0">
                {grouped.in_progress.length === 0 ? renderEmpty("Nothing in progress.") : grouped.in_progress.map(renderRow)}
              </TabsContent>
              <TabsContent value="completed" className="space-y-2 mt-0">
                {grouped.completed.length === 0 ? renderEmpty("No completed referrals yet.") : grouped.completed.map(renderRow)}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <SignPostDetailPanel
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        referralId={selectedId}
        onCreateFollowup={onCreateFollowup}
      />
    </>
  );
}
