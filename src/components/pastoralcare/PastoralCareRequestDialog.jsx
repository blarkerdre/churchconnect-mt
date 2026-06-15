import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const CATEGORIES = [
  "Prayer Request", "Counselling", "Visitation", "Hospital Visit",
  "Bereavement", "Marriage", "Financial Support", "Life Event", "Other",
];

const SUBTYPES = [
  { value: "childbirth", label: "Childbirth" },
  { value: "naming_dedication", label: "Naming / Dedication" },
  { value: "marriage", label: "Marriage" },
  { value: "bereavement", label: "Bereavement" },
];

export default function PastoralCareRequestDialog({ open, onOpenChange, currentUser, myMember }) {
  const { user } = useAuth();
  const { withTenant, tenantId, scopeQuery } = useTenantQuery();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    category: "", title: "", description: "",
    subtype: "childbirth", subject_name: "", event_date: "",
    pastor_requested: true,
    route_home_cell: false, route_unit: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isLifeEvent = form.category === "Life Event";

  // Look up the submitting member's home-cell leader & unit leaders for the route
  const { data: routeOptions } = useQuery({
    queryKey: ["life-event-route-options", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId && isLifeEvent,
    queryFn: async () => {
      const { data: m } = await scopeQuery(
        supabase.from("members")
          .select("id, church_unit, wsf_centre_id")
          .eq("user_id", user.id)
      );
      const mem = m?.[0];
      let homeCellLeaderId = null;
      let homeCellName = null;
      if (mem?.wsf_centre_id) {
        const { data: centre } = await scopeQuery(
          supabase.from("wsf_centres").select("name, leader_id").eq("id", mem.wsf_centre_id)
        );
        homeCellLeaderId = centre?.[0]?.leader_id || null;
        homeCellName = centre?.[0]?.name || null;
      }
      const unitNames = (mem?.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
      let unitLeaderIds = [];
      let resolvedUnits = [];
      if (unitNames.length) {
        const { data: ulas } = await scopeQuery(
          supabase.from("unit_leader_assignments").select("user_id, unit_name")
            .in("unit_name", unitNames)
        );
        unitLeaderIds = [...new Set((ulas || []).map(u => u.user_id))];
        resolvedUnits = [...new Set((ulas || []).map(u => u.unit_name))];
      }
      return { homeCellLeaderId, homeCellName, unitLeaderIds, resolvedUnits };
    },
  });

  useEffect(() => {
    // default-check routes once we have options
    if (isLifeEvent && routeOptions) {
      setForm(f => ({
        ...f,
        route_home_cell: f.route_home_cell || !!routeOptions.homeCellLeaderId,
        route_unit: f.route_unit || (routeOptions.unitLeaderIds?.length > 0),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLifeEvent, routeOptions?.homeCellLeaderId, routeOptions?.unitLeaderIds?.length]);

  const lifeEventMutation = useMutation({
    mutationFn: async (data) => {
      const route = [];
      const routeUserIds = [];
      if (data.route_home_cell && routeOptions?.homeCellLeaderId) {
        route.push("home_cell_leader");
        routeUserIds.push(routeOptions.homeCellLeaderId);
      }
      if (data.route_unit && routeOptions?.unitLeaderIds?.length) {
        route.push("unit_leader");
        routeOptions.unitLeaderIds.forEach(id => routeUserIds.push(id));
      }
      if (route.length === 0) throw new Error("Please select at least one approver (Home Cell Leader or Unit Leader).");
      const uniqIds = [...new Set(routeUserIds)];

      const subtypeLabel = SUBTYPES.find(s => s.value === data.subtype)?.label || data.subtype;
      const subjectLine = `${subtypeLabel}: ${data.subject_name}`;

      // create the pastoral_care shell so it appears in the unified list
      const { data: pc, error: pcErr } = await supabase.from("pastoral_care").insert(withTenant({
        member_id: myMember?.id || null,
        care_type: "Life Event",
        subject: subjectLine,
        description: data.description || null,
        status: "Open",
        confidential: false,
        created_by: user?.id,
      })).select("id").single();
      if (pcErr) throw pcErr;

      const { error: leErr } = await supabase.from("life_event_requests").insert(withTenant({
        pastoral_care_id: pc.id,
        member_id: myMember?.id || null,
        created_by: user.id,
        subtype: data.subtype,
        subject_name: data.subject_name,
        event_date: data.event_date || null,
        pastor_requested: !!data.pastor_requested,
        notes: data.description || null,
        approval_route: route,
        route_user_ids: uniqIds,
      }));
      if (leErr) throw leErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      queryClient.invalidateQueries({ queryKey: ["life-events"] });
      setSubmitted(true);
    },
  });

  const careMutation = useMutation({
    mutationFn: async (data) => {
      // Auto-assign to least-busy Pastoral Care unit leader
      let assignedTo = null;
      try {
        let leadersQuery = supabase
          .from("unit_leader_assignments").select("user_id")
          .in("unit_name", ["Pastoral Care", "Pastoral care", "pastoral care"]);
        if (tenantId) leadersQuery = leadersQuery.eq("tenant_id", tenantId);
        const { data: pcLeaders } = await leadersQuery;
        if (pcLeaders && pcLeaders.length > 0) {
          const leaderIds = pcLeaders.map(l => l.user_id);
          const { data: counts } = await supabase.from("pastoral_care")
            .select("assigned_to").in("status", ["Open", "In Progress"]).in("assigned_to", leaderIds);
          const countMap = {};
          leaderIds.forEach(id => { countMap[id] = 0; });
          (counts || []).forEach(c => { if (c.assigned_to) countMap[c.assigned_to] = (countMap[c.assigned_to] || 0) + 1; });
          assignedTo = Object.entries(countMap).sort((a, b) => a[1] - b[1])[0]?.[0] || null;
        }
      } catch (err) { console.error(err); }

      const { error } = await supabase.from("pastoral_care").insert(withTenant({
        ...data, assigned_to: assignedTo,
      }));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      setSubmitted(true);
    },
  });

  const handleSubmit = () => {
    if (isLifeEvent) {
      lifeEventMutation.mutate(form);
    } else {
      careMutation.mutate({
        member_id: myMember?.id || null,
        care_type: form.category,
        subject: form.title,
        description: form.description,
        status: "Open",
        confidential: true,
        created_by: user?.id,
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setForm({
        category: "", title: "", description: "",
        subtype: "childbirth", subject_name: "", event_date: "",
        pastor_requested: true, route_home_cell: false, route_unit: false,
      });
      setSubmitted(false);
    }, 300);
  };

  const pending = lifeEventMutation.isPending || careMutation.isPending;
  const error = lifeEventMutation.error || careMutation.error;

  const canSubmit = useMemo(() => {
    if (!form.category) return false;
    if (isLifeEvent) {
      return !!form.subject_name && !!form.subtype && (form.route_home_cell || form.route_unit);
    }
    return !!form.title;
  }, [form, isLifeEvent]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Heart className="h-4 w-4 text-destructive" />
          Request Pastoral Care
        </TenantDialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-chart-3/10 flex items-center justify-center mx-auto">
              <Heart className="h-7 w-7 text-chart-3" />
            </div>
            <h3 className="font-semibold text-foreground">Request Submitted</h3>
            <p className="text-sm text-muted-foreground">
              {isLifeEvent
                ? "Your life event has been submitted to your selected leader(s) for review."
                : "Your pastoral care request has been received. A leader will be in touch with you soon."}
            </p>
            <Button onClick={handleClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border">
                {isLifeEvent
                  ? "Life events are reviewed by your leader(s), then visible to the Altar Ministry for pastor assignment."
                  : "Your request is confidential and will only be seen by pastoral leaders."}
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

              {isLifeEvent ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Life event *</Label>
                    <Select value={form.subtype} onValueChange={v => set("subtype", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBTYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Name of child / individual involved *</Label>
                    <Input value={form.subject_name} onChange={e => set("subject_name", e.target.value)} placeholder="e.g. Baby Joseph; Late Mr Adams" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Event date</Label>
                    <Input type="date" value={form.event_date} onChange={e => set("event_date", e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="pastor_req" type="checkbox" checked={form.pastor_requested}
                           onChange={e => set("pastor_requested", e.target.checked)}
                           className="rounded border-border" />
                    <Label htmlFor="pastor_req" className="text-sm">Request a pastor's presence</Label>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <Label className="text-sm">Send approval request to *</Label>
                    <div className="flex items-center gap-2">
                      <input id="route_hc" type="checkbox"
                             disabled={!routeOptions?.homeCellLeaderId}
                             checked={form.route_home_cell}
                             onChange={e => set("route_home_cell", e.target.checked)}
                             className="rounded border-border" />
                      <Label htmlFor="route_hc" className="text-sm">
                        Home Cell Leader
                        {routeOptions?.homeCellName && <span className="text-muted-foreground"> ({routeOptions.homeCellName})</span>}
                        {!routeOptions?.homeCellLeaderId && <span className="text-muted-foreground"> — none on record</span>}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="route_ul" type="checkbox"
                             disabled={!routeOptions?.unitLeaderIds?.length}
                             checked={form.route_unit}
                             onChange={e => set("route_unit", e.target.checked)}
                             className="rounded border-border" />
                      <Label htmlFor="route_ul" className="text-sm">
                        Unit Leader
                        {routeOptions?.resolvedUnits?.length ? <span className="text-muted-foreground"> ({routeOptions.resolvedUnits.join(", ")})</span> : null}
                        {!routeOptions?.unitLeaderIds?.length && <span className="text-muted-foreground"> — none on record</span>}
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Additional details</Label>
                    <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
                              placeholder="Anything the pastor should know" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Subject *</Label>
                    <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief description of your need" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Details</Label>
                    <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Share more details (optional)" rows={4} />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error.message}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={pending || !canSubmit}>
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
