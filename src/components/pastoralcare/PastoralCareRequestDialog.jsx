import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Heart } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const CATEGORIES = [
  "Prayer Request", "Counselling", "Visitation", "Hospital Visit",
  "Bereavement", "Marriage", "Financial Support", "Other",
];

export default function PastoralCareRequestDialog({ open, onOpenChange, currentUser, myMember }) {
  const { user } = useAuth();
  const { withTenant, tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ category: "", title: "", description: "" });
  const [submitted, setSubmitted] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Auto-assign to least-busy Pastoral Care unit leader
      let assignedTo = null;
      try {
        let leadersQuery = supabase
          .from("unit_leader_assignments")
          .select("user_id")
          .in("unit_name", ["Pastoral Care", "Pastoral care", "pastoral care"]);
        if (tenantId) leadersQuery = leadersQuery.eq("tenant_id", tenantId);
        const { data: pcLeaders } = await leadersQuery;

        if (pcLeaders && pcLeaders.length > 0) {
          const leaderIds = pcLeaders.map(l => l.user_id);
          const { data: counts } = await supabase
            .from("pastoral_care")
            .select("assigned_to")
            .in("status", ["Open", "In Progress"])
            .in("assigned_to", leaderIds);

          const countMap = {};
          leaderIds.forEach(id => { countMap[id] = 0; });
          (counts || []).forEach(c => {
            if (c.assigned_to) countMap[c.assigned_to] = (countMap[c.assigned_to] || 0) + 1;
          });

          const sorted = Object.entries(countMap).sort((a, b) => a[1] - b[1]);
          assignedTo = sorted[0]?.[0] || null;
        }
      } catch (err) {
        console.error("Failed to auto-assign pastoral care leader:", err);
      }

      const { error } = await supabase.from("pastoral_care").insert(withTenant({
        ...data,
        assigned_to: assignedTo,
      }));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    mutation.mutate({
      member_id: myMember?.id || null,
      care_type: form.category,
      subject: form.title,
      description: form.description,
      status: "Open",
      confidential: true,
      created_by: user?.id,
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setForm({ category: "", title: "", description: "" });
      setSubmitted(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-destructive" />
            Request Pastoral Care
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-chart-3/10 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-chart-3" />
            </div>
            <h3 className="font-semibold text-foreground">Request Submitted</h3>
            <p className="text-sm text-muted-foreground">
              Your pastoral care request has been received. A leader will be in touch with you soon.
            </p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
                Your request is confidential and will only be seen by pastoral leaders.
              </p>

              <div className="space-y-1.5">
                <Label>Type of Support Needed *</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief description of your need" />
              </div>

              <div className="space-y-1.5">
                <Label>Details</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Share more details (optional)" rows={4} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={mutation.isPending || !form.category || !form.title}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
