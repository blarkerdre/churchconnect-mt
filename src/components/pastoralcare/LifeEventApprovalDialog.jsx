import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, UserCheck, Sparkles, CalendarDays, User as UserIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAltarMinistry } from "@/hooks/useAltarMinistry";
import { toast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";

const SUBTYPE_LABEL = {
  childbirth: "Childbirth",
  naming_dedication: "Naming / Dedication",
  marriage: "Marriage",
  bereavement: "Bereavement",
};

const STAGE_LABEL = {
  awaiting_leader: "Awaiting Leader",
  awaiting_altar_ministry: "Awaiting Altar Ministry",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

const STAGE_COLOR = {
  awaiting_leader: "bg-accent/10 text-accent",
  awaiting_altar_ministry: "bg-primary/10 text-primary",
  approved: "bg-chart-3/10 text-chart-3",
  rejected: "bg-destructive/10 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

export function LifeEventStageBadge({ stage }) {
  return <Badge className={`border-0 ${STAGE_COLOR[stage] || ""}`}>{STAGE_LABEL[stage] || stage}</Badge>;
}

async function notify({ tenantId, recipients, title, message, refId }) {
  if (!recipients?.length) return;
  const rows = recipients.map(uid => ({
    user_id: uid, tenant_id: tenantId, title, message,
    type: "pastoral_life_event", reference_id: refId, reference_type: "life_event_requests",
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("notify failed:", error.message);
}

export default function LifeEventApprovalDialog({ open, onOpenChange, request, isRoutedLeader }) {
  const { user, isAdmin } = useAuth();
  const { tenantId } = useTenantQuery();
  const { people: altarPeople, isLeader: isAltarLeader } = useAltarMinistry();
  const qc = useQueryClient();
  const [tab, setTab] = useState("review");
  const [stage1Note, setStage1Note] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [pastorIds, setPastorIds] = useState([]);

  useEffect(() => {
    if (request) {
      setStage1Note(request.stage1_note || "");
      setRejectionReason(request.rejection_reason || "");
      setOwnerId(request.assigned_owner_id || "");
      setPastorIds(request.assigned_pastor_ids || []);
      setTab(request.stage === "awaiting_leader" ? "review" : "assign");
    }
  }, [request?.id]);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["life-events"] });
    qc.invalidateQueries({ queryKey: ["pastoral-care"] });
  };

  const approveStage1 = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("life_event_requests").update({
        stage: "awaiting_altar_ministry",
        stage1_approved_by: user.id,
        stage1_approved_at: new Date().toISOString(),
        stage1_note: stage1Note || null,
      }).eq("id", request.id).eq("tenant_id", tenantId);
      if (error) throw error;

      // notify altar ministry members
      const altarIds = altarPeople.map(p => p.user_id);
      await notify({
        tenantId, recipients: altarIds, refId: request.id,
        title: "New Life Event awaiting Altar Ministry",
        message: `${SUBTYPE_LABEL[request.subtype]}: ${request.subject_name}`,
      });
      await logAudit("life_event.approve_stage1", "life_event_requests", request.id, { note: stage1Note }, tenantId);
    },
    onSuccess: () => { toast({ title: "Approved — sent to Altar Ministry" }); refetch(); onOpenChange(false); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async () => {
      if (!rejectionReason.trim()) throw new Error("Please provide a rejection reason.");
      const { error } = await supabase.from("life_event_requests").update({
        stage: "rejected",
        rejected_by: user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      }).eq("id", request.id).eq("tenant_id", tenantId);
      if (error) throw error;
      await notify({
        tenantId, recipients: [request.created_by], refId: request.id,
        title: "Life Event request not approved",
        message: `${SUBTYPE_LABEL[request.subtype]}: ${request.subject_name}. Reason: ${rejectionReason}`,
      });
      await logAudit("life_event.reject", "life_event_requests", request.id, { reason: rejectionReason }, tenantId);
    },
    onSuccess: () => { toast({ title: "Rejected" }); refetch(); onOpenChange(false); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const finalApprove = useMutation({
    mutationFn: async () => {
      if (!ownerId) throw new Error("Please select an Altar Ministry team owner.");
      const wasApproved = request.stage === "approved" || request.stage === "completed";
      const { error } = await supabase.from("life_event_requests").update({
        stage: request.stage === "completed" ? "completed" : "approved",
        final_approved_by: user.id,
        final_approved_at: new Date().toISOString(),
        assigned_owner_id: ownerId,
        assigned_pastor_ids: pastorIds,
      }).eq("id", request.id).eq("tenant_id", tenantId);
      if (error) throw error;

      const pastorNames = altarPeople.filter(p => pastorIds.includes(p.user_id)).map(p => p.name);
      const ownerName = altarPeople.find(p => p.user_id === ownerId)?.name || "the Altar Ministry";
      const memberMsg = pastorNames.length
        ? `Your ${SUBTYPE_LABEL[request.subtype]} request has been ${wasApproved ? "updated" : "approved"}. Assigned pastor(s): ${pastorNames.join(", ")}.`
        : `Your ${SUBTYPE_LABEL[request.subtype]} request has been ${wasApproved ? "updated" : "approved"}. The Altar Ministry will be in touch.`;

      await notify({
        tenantId, recipients: [request.created_by], refId: request.id,
        title: wasApproved ? "Life Event assignment updated" : "Life Event approved",
        message: memberMsg,
      });
      const teamRecipients = [...new Set([ownerId, ...pastorIds])].filter(id => id && id !== user.id);
      if (teamRecipients.length) {
        await notify({
          tenantId, recipients: teamRecipients, refId: request.id,
          title: wasApproved ? "Life Event assignment updated" : "You've been assigned to a Life Event",
          message: `${SUBTYPE_LABEL[request.subtype]}: ${request.subject_name}${request.event_date ? ` on ${request.event_date}` : ""}. Owner: ${ownerName}.`,
        });
      }
      await logAudit(wasApproved ? "life_event.reassign" : "life_event.final_approve",
                     "life_event_requests", request.id,
                     { owner: ownerId, pastors: pastorIds }, tenantId);
    },
    onSuccess: () => { toast({ title: "Saved" }); refetch(); onOpenChange(false); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markCompleted = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("life_event_requests").update({
        stage: "completed", completed_at: new Date().toISOString(), completed_by: user.id,
      }).eq("id", request.id).eq("tenant_id", tenantId);
      if (error) throw error;
      await logAudit("life_event.complete", "life_event_requests", request.id, null, tenantId);
    },
    onSuccess: () => { toast({ title: "Marked completed" }); refetch(); onOpenChange(false); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!request) return null;

  const canFinalApprove = (isAltarLeader || isAdmin) && request.stage !== "rejected" && request.stage !== "awaiting_leader";
  const canMarkComplete = (request.stage === "approved") &&
    (isAdmin || isAltarLeader || user?.id === request.assigned_owner_id || pastorIds.includes(user?.id));
  const canStage1 = isRoutedLeader && request.stage === "awaiting_leader";

  const togglePastor = (id) => {
    setPastorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Sparkles className="h-4 w-4 text-primary" />
          Life Event — {SUBTYPE_LABEL[request.subtype]}
        </TenantDialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <LifeEventStageBadge stage={request.stage} />
            {request.pastor_requested && <Badge variant="outline">Pastor requested</Badge>}
          </div>
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex items-center gap-2"><UserIcon className="h-4 w-4 text-muted-foreground" /><span>Involved: <b>{request.subject_name}</b></span></div>
            {request.event_date && <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><span>Event date: {new Date(request.event_date).toLocaleDateString("en-GB")}</span></div>}
            {request.notes && <p className="whitespace-pre-wrap text-muted-foreground">{request.notes}</p>}
            <p className="text-xs text-muted-foreground">Submitted {new Date(request.created_at).toLocaleString("en-GB")}</p>
          </div>

          {request.stage === "rejected" && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="font-medium text-destructive">Rejected</p>
              <p className="text-muted-foreground">{request.rejection_reason}</p>
            </div>
          )}

          {canStage1 && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="font-medium">Leader review</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Note (optional)</Label>
                <Textarea rows={2} value={stage1Note} onChange={e => setStage1Note(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rejection reason (required to reject)</Label>
                <Textarea rows={2} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => approveStage1.mutate()} disabled={approveStage1.isPending} className="flex-1">
                  {approveStage1.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Approve & send to Altar Ministry
                </Button>
                <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            </div>
          )}

          {canFinalApprove && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <p className="font-medium flex items-center gap-2"><UserCheck className="h-4 w-4" />Altar Ministry assignment</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Team owner *</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Select team owner" /></SelectTrigger>
                  <SelectContent>
                    {altarPeople.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.name}{p.is_leader ? " (Leader)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned pastor(s)</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-border p-2">
                  {altarPeople.length === 0 && <p className="text-xs text-muted-foreground">No Altar Ministry members found.</p>}
                  {altarPeople.map(p => (
                    <label key={p.user_id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={pastorIds.includes(p.user_id)} onChange={() => togglePastor(p.user_id)} className="rounded border-border" />
                      <span>{p.name}{p.is_leader ? " (Leader)" : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={() => finalApprove.mutate()} disabled={finalApprove.isPending} className="w-full">
                {finalApprove.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {request.stage === "approved" ? "Update assignment" : "Final approve & assign"}
              </Button>
            </div>
          )}

          {request.assigned_pastor_ids?.length > 0 && (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="font-medium mb-1">Currently assigned</p>
              <p className="text-muted-foreground">
                Owner: {altarPeople.find(p => p.user_id === request.assigned_owner_id)?.name || "—"}<br />
                Pastors: {altarPeople.filter(p => request.assigned_pastor_ids.includes(p.user_id)).map(p => p.name).join(", ") || "—"}
              </p>
            </div>
          )}

          {canMarkComplete && (
            <Button onClick={() => markCompleted.mutate()} disabled={markCompleted.isPending} variant="secondary" className="w-full">
              {markCompleted.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Mark event completed
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
