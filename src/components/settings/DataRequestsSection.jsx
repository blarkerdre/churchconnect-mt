import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ShieldAlert, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

export default function DataRequestsSection() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // { req, action }
  const [note, setNote] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["erasure-requests", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("erasure_requests")
        .select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ req, status, review_note }) => {
      const { error } = await supabase.from("erasure_requests").update({
        status,
        review_note: review_note || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", req.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erasure-requests"] });
      setDialog(null); setNote("");
      toast({ title: "Request updated" });
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const executeMut = useMutation({
    mutationFn: async (req) => {
      const { error } = await supabase.functions.invoke("process-erasure", { body: { request_id: req.id } });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["erasure-requests"] });
      toast({ title: "Erasure executed", description: "Personal data anonymised; 30-day archive kept." });
    },
    onError: (e) => toast({ title: "Erasure failed", description: e.message, variant: "destructive" }),
  });

  const openCount = requests.filter((r) => r.status === "pending").length;
  const overdue = requests.filter(
    (r) => r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > 30 * 86400_000,
  ).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" /> Data Subject Requests
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Under UK GDPR you must respond to erasure requests within 30 days.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4 text-sm">
            <div><Badge variant="secondary">{openCount}</Badge> pending</div>
            {overdue > 0 && <div><Badge variant="destructive">{overdue}</Badge> overdue</div>}
            <div className="text-muted-foreground">{requests.length} total</div>
          </div>

          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!isLoading && requests.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No requests yet.</p>
          )}

          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex flex-wrap items-start gap-3 justify-between">
                <div className="text-sm min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  {r.reason && <p className="text-xs mt-1 whitespace-pre-wrap">{r.reason}</p>}
                  {r.review_note && <p className="text-xs mt-1 text-muted-foreground">Note: {r.review_note}</p>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setDialog({ req: r, action: "reject" }); setNote(""); }}>
                        <X className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => { setDialog({ req: r, action: "approve" }); setNote(""); }}>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <Button size="sm" variant="destructive" onClick={() => executeMut.mutate(r)}
                      disabled={executeMut.isPending}>
                      {executeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                      Execute erasure
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) { setDialog(null); setNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === "approve" ? "Approve erasure request" : "Reject erasure request"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.action === "approve"
                ? "Approving records your decision. Execute erasure separately to anonymise the record."
                : "The member will see your note. Provide a clear reason if refusing on legal-obligation grounds."}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={dialog?.action === "reject" ? "Reason (required for rejection)…" : "Optional note…"} maxLength={500} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.action === "reject" ? "destructive" : "default"}
              disabled={updateMut.isPending || (dialog?.action === "reject" && !note.trim())}
              onClick={() => updateMut.mutate({
                req: dialog.req,
                status: dialog.action === "approve" ? "approved" : "rejected",
                review_note: note,
              })}
            >
              {updateMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm {dialog?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusVariant(s) {
  if (s === "completed") return "default";
  if (s === "rejected") return "outline";
  if (s === "approved") return "secondary";
  if (s === "legal_hold") return "destructive";
  return "secondary";
}
