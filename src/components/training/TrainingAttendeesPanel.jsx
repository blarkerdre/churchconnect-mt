import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Send, Trash2, UserPlus, Search } from "lucide-react";

const STATUS_VARIANT = {
  none: "outline",
  pending: "secondary",
  approved: "default",
  declined: "destructive",
  issued: "default",
};

export default function TrainingAttendeesPanel({ report }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { isMemberOfUnit: isTrainingRep } = useUnitMembership("Training Rep");
  const canEdit = isAdmin || isTrainingRep;

  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState({});
  const [reasonDrafts, setReasonDrafts] = useState({});

  const { data: attendees = [], isLoading } = useQuery({
    queryKey: ["training-attendees", report.id],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("training_attendees")
          .select("*, member:members(id, first_name, last_name, email)")
          .eq("training_report_id", report.id)
          .order("created_at", { ascending: true })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-attendance", tenantId],
    enabled: !!tenantId && addOpen,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, first_name, last_name, email")
          .order("first_name", { ascending: true })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const existingMemberIds = useMemo(() => new Set(attendees.map(a => a.member_id)), [attendees]);
  const filteredMembers = useMemo(() => {
    const s = search.trim().toLowerCase();
    return members
      .filter(m => !existingMemberIds.has(m.id))
      .filter(m => {
        if (!s) return true;
        const name = `${m.first_name} ${m.last_name}`.toLowerCase();
        return name.includes(s) || (m.email || "").toLowerCase().includes(s);
      })
      .slice(0, 200);
  }, [members, existingMemberIds, search]);

  const addMutation = useMutation({
    mutationFn: async (memberIds) => {
      const rows = memberIds.map(id => withTenant({
        training_report_id: report.id,
        member_id: id,
        training_type: report.training_type,
        attended: true,
        completed: false,
        signpost_status: "none",
      }));
      const { error } = await supabase.from("training_attendees").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-attendees", report.id] });
      toast({ title: "Attendees added" });
      setPicked({});
      setSearch("");
      setAddOpen(false);
    },
    onError: (e) => toast({ title: "Failed to add", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase
        .from("training_attendees")
        .update(patch)
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-attendees", report.id] }),
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const signpostMutation = useMutation({
    mutationFn: async (row) => {
      const { error } = await supabase
        .from("training_attendees")
        .update({
          signpost_status: "pending",
          signposted_by: user?.id,
          signposted_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-attendees", report.id] });
      qc.invalidateQueries({ queryKey: ["certificate-approvals"] });
      toast({ title: "Signposted to Training Rep Unit leader" });
    },
    onError: (e) => toast({ title: "Signpost failed", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("training_attendees")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-attendees", report.id] }),
    onError: (e) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">
          Attendees <span className="text-muted-foreground font-normal">({attendees.length})</span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add members
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : attendees.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No attendees recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {attendees.map((a) => {
            const name = `${a.member?.first_name || ""} ${a.member?.last_name || ""}`.trim();
            const draftReason = reasonDrafts[a.id] ?? a.not_completed_reason ?? "";
            const signposted = a.signpost_status && a.signpost_status !== "none";
            return (
              <div key={a.id} className="rounded-md border bg-card p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{name || "Unknown member"}</div>
                    {a.member?.email && <div className="text-xs text-muted-foreground truncate">{a.member.email}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {signposted && (
                      <Badge variant={STATUS_VARIANT[a.signpost_status]} className="capitalize text-[10px]">
                        {a.signpost_status}
                      </Badge>
                    )}
                    {canEdit && !signposted && (
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { if (confirm("Remove attendee?")) removeMutation.mutate(a.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={!!a.completed}
                      disabled={!canEdit || signposted}
                      onCheckedChange={(v) => updateMutation.mutate({
                        id: a.id,
                        patch: { completed: !!v, not_completed_reason: v ? null : a.not_completed_reason },
                      })}
                    />
                    Completed
                  </label>

                  {!a.completed && canEdit && !signposted && (
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <Input
                        placeholder="Reason for not completing (optional)"
                        value={draftReason}
                        onChange={(e) => setReasonDrafts({ ...reasonDrafts, [a.id]: e.target.value })}
                        onBlur={() => {
                          if (draftReason !== (a.not_completed_reason || "")) {
                            updateMutation.mutate({ id: a.id, patch: { not_completed_reason: draftReason || null } });
                          }
                        }}
                        className="h-7 text-xs"
                      />
                    </div>
                  )}

                  {canEdit && a.completed && !signposted && (
                    <Button size="sm" className="gap-1.5 ml-auto" onClick={() => signpostMutation.mutate(a)}>
                      <Send className="h-3.5 w-3.5" /> Signpost for certificate
                    </Button>
                  )}
                </div>

                {a.decision_notes && (
                  <p className="text-xs text-muted-foreground italic">Decision note: {a.decision_notes}</p>
                )}
                {a.certificate_number && (
                  <p className="text-xs text-muted-foreground">Certificate: {a.certificate_number}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add members who attended</DialogTitle>
            <DialogDescription>Select members for "{report.training_type}" on {report.session_date}.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members" className="pl-7 h-8" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 border rounded-md p-2">
            {filteredMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No members found</p>
            ) : filteredMembers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer text-sm">
                <Checkbox
                  checked={!!picked[m.id]}
                  onCheckedChange={(v) => setPicked({ ...picked, [m.id]: !!v })}
                />
                <span className="truncate">{m.first_name} {m.last_name}</span>
                {m.email && <span className="text-xs text-muted-foreground truncate ml-auto">{m.email}</span>}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={pickedCount === 0 || addMutation.isPending}
              onClick={() => addMutation.mutate(Object.keys(picked).filter(k => picked[k]))}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add {pickedCount > 0 ? `(${pickedCount})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
