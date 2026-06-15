import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Search, Lock, User, CalendarDays, Plus, Loader2, UserCheck, Download, Sparkles, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { useSubFeature } from "@/hooks/useSubFeature";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAltarMinistry } from "@/hooks/useAltarMinistry";
import PrintReportButton from "@/components/PrintReportButton";
import LifeEventApprovalDialog, { LifeEventStageBadge } from "@/components/pastoralcare/LifeEventApprovalDialog";
import PastoralCareRequestDialog from "@/components/pastoralcare/PastoralCareRequestDialog";

const statusColors = {
  "Open": "bg-accent/10 text-accent",
  "In Progress": "bg-primary/10 text-primary",
  "Resolved": "bg-chart-3/10 text-chart-3",
  "Closed": "bg-muted text-muted-foreground",
};

const CARE_TYPES = ["Counselling", "Visitation", "Prayer Request", "Hospital Visit", "Bereavement", "Marriage", "Financial Support", "Other"];
const ALL_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

export default function PastoralCare() {
  const { user, isAdmin, leaderUnits, myMember } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { isMemberOfUnit: isPastoralUnit } = useUnitMembership("Pastoral Care");
  const { unitName: altarUnitName, isMember: isAltarMember, isLeader: isAltarLeader } = useAltarMinistry();
  const canManage = isAdmin || leaderUnits.includes("Pastoral Care") || isPastoralUnit;
  const isPastoralLeader = isAdmin || leaderUnits.includes("Pastoral Care");
  const { enabled: canCreateRequest } = useSubFeature("pastoral.create_request");
  const { enabled: canAssignCases } = useSubFeature("pastoral.assign_cases");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [form, setForm] = useState({ subject: "", care_type: "Prayer Request", description: "", confidential: false });
  const [statusUpdate, setStatusUpdate] = useState({ status: "", resolution_notes: "", assigned_to: "" });
  const [detailCase, setDetailCase] = useState(null);
  const [activeLifeEvent, setActiveLifeEvent] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [altarSetting, setAltarSetting] = useState("");

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["pastoral-care", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("pastoral_care")
          .select("*, members(first_name, last_name)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
  });

  const { data: pastoralUnitMembers = [] } = useQuery({
    queryKey: ["pastoral-unit-members", tenantId],
    enabled: isPastoralLeader,
    queryFn: async () => {
      // 1. Get unit leaders
      const { data: assignments, error: aErr } = await scopeQuery(
        supabase
          .from("unit_leader_assignments")
          .select("user_id")
          .in("unit_name", ["Pastoral Care", "pastoral care", "Pastoral care"])
      );
      if (aErr) throw aErr;
      const leaderIds = new Set((assignments || []).map(a => a.user_id));

      // 2. Get regular unit members whose church_unit contains "Pastoral Care"
      const { data: unitMembers, error: mErr } = await scopeQuery(
        supabase
          .from("members")
          .select("user_id")
          .ilike("church_unit", "%Pastoral Care%")
          .not("user_id", "is", null)
      );
      if (mErr) throw mErr;

      // 3. Combine and deduplicate
      const allIds = new Set([...leaderIds]);
      (unitMembers || []).forEach(m => { if (m.user_id) allIds.add(m.user_id); });
      const userIds = [...allIds];
      if (userIds.length === 0) return [];

      const { data: profiles, error: pErr } = await scopeQuery(
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
      );
      if (pErr) throw pErr;
      return profiles || [];
    },
  });

  const { data: lifeEvents = [] } = useQuery({
    queryKey: ["life-events", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("life_event_requests")
          .select("*, members(first_name, last_name)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const lifeEventCaseIds = new Set(lifeEvents.map(le => le.pastoral_care_id).filter(Boolean));

  // Exclude life-event-linked pastoral_care rows from the regular list — life events
  // get their own dedicated cards below.
  const regularCases = cases.filter(c => !lifeEventCaseIds.has(c.id));
  const visibleCases = canManage ? regularCases : regularCases.filter(c => c.created_by === user?.id);

  const filtered = visibleCases.filter(r => {
    const matchSearch = `${r.subject} ${r.members?.first_name || ""} ${r.members?.last_name || ""} ${r.care_type}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    const dateField = r.created_at?.split("T")[0] || "";
    const matchDate = (!dateFrom || dateField >= dateFrom) && (!dateTo || dateField <= dateTo);
    return matchSearch && matchStatus && matchDate;
  });

  const assigneeMap = {};
  pastoralUnitMembers.forEach(p => { assigneeMap[p.user_id] = p.full_name || p.email || "Unknown"; });

  const requestMutation = useMutation({
    mutationFn: async (formData) => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).eq("tenant_id", tenantId).single();
      const { error } = await supabase.from("pastoral_care").insert(withTenant({
        subject: formData.subject,
        care_type: formData.care_type,
        description: formData.description || null,
        confidential: formData.confidential,
        created_by: user.id,
        member_id: member?.id || null,
      }));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      toast({ title: "Request submitted" });
      setRequestDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates, caseData }) => {
      const payload = { status: updates.status, resolution_notes: updates.resolution_notes };
      const isNewAssignment = updates.assigned_to && updates.assigned_to !== caseData?.assigned_to;
      if (updates.assigned_to) payload.assigned_to = updates.assigned_to;
      const { error } = await supabase.from("pastoral_care").update(payload).eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
      if (isNewAssignment) {
        try {
          await supabase.functions.invoke("notify-pastoral-assignment", {
            body: { assigned_to: updates.assigned_to, subject: caseData?.subject || "Pastoral Care Case", care_type: caseData?.care_type, description: caseData?.description, case_id: id, tenant_id: tenantId },
          });
        } catch (notifyErr) {
          console.error("Failed to send pastoral assignment notification:", notifyErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      toast({ title: "Case updated" });
      setManageDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const downloadCSV = () => {
    const headers = ["Subject", "Member", "Type", "Status", "Confidential", "Assigned To", "Created Date", "Resolution Notes"];
    const rows = filtered.map(r => [
      r.subject,
      r.members ? `${r.members.first_name} ${r.members.last_name}` : "",
      r.care_type,
      r.status,
      r.confidential ? "Yes" : "No",
      r.assigned_to ? (assigneeMap[r.assigned_to] || "") : "",
      r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB") : "",
      r.resolution_notes || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pastoral-care-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const openManage = (c) => {
    setSelectedCase(c);
    setStatusUpdate({ status: c.status, resolution_notes: c.resolution_notes || "", assigned_to: c.assigned_to || "" });
    setManageDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{filtered.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{filtered.filter(r => r.status === "Open").length}</p><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{filtered.filter(r => r.status === "In Progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{filtered.filter(r => r.status === "Resolved").length}</p><p className="text-xs text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search cases..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          {canCreateRequest && (
            <Button onClick={() => { setForm({ subject: "", care_type: "Prayer Request", description: "", confidential: false }); setRequestDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> New Request
            </Button>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-40" />
            </div>
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
            <PrintReportButton label="Print" buildRows={() => ({
            title: "Pastoral Care Report",
            headers: ["Subject", "Member", "Type", "Status", "Confidential", "Assigned To", "Created", "Resolution Notes"],
            rows: filtered.map(r => [
              r.subject,
              r.members ? `${r.members.first_name} ${r.members.last_name}` : "",
              r.care_type,
              r.status,
              r.confidential ? "Yes" : "No",
              r.assigned_to ? (assigneeMap[r.assigned_to] || "") : "",
              r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB") : "",
              r.resolution_notes || "",
            ]),
          })} />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No cases found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailCase(r)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-chart-5/10 flex items-center justify-center shrink-0">
                    <Heart className="h-5 w-5 text-chart-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">{r.subject}</h3>
                      {r.confidential && <Lock className="h-3.5 w-3.5 text-destructive" />}
                      <Badge className={`border-0 ${statusColors[r.status]}`}>{r.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {r.members && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {r.members.first_name} {r.members.last_name}</span>}
                      <span>{r.care_type}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {new Date(r.created_at).toLocaleDateString()}</span>
                      {r.assigned_to && assigneeMap[r.assigned_to] && (
                        <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" /> {assigneeMap[r.assigned_to]}</span>
                      )}
                    </div>
                  </div>
                  {canManage && canAssignCases && (r.status === "Open" || r.status === "In Progress") && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openManage(r); }}>Manage</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">New Pastoral Care Request</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.care_type} onValueChange={v => setForm(f => ({ ...f, care_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe your request..." /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="confidential" checked={form.confidential} onChange={e => setForm(f => ({ ...f, confidential: e.target.checked }))} className="rounded border-border" />
              <Label htmlFor="confidential" className="text-sm">Mark as confidential</Label>
            </div>
            <Button onClick={() => requestMutation.mutate(form)} disabled={requestMutation.isPending || !form.subject} className="w-full bg-primary">
              {requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Case Detail Dialog */}
      <Dialog open={!!detailCase} onOpenChange={(v) => !v && setDetailCase(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {detailCase?.subject}
              {detailCase?.confidential && <Lock className="h-4 w-4 text-destructive" />}
            </DialogTitle>
          </DialogHeader>
          {detailCase && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge className={`border-0 ${statusColors[detailCase.status]}`}>{detailCase.status}</Badge>
                <Badge variant="outline">{detailCase.care_type}</Badge>
              </div>
              {detailCase.members && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{detailCase.members.first_name} {detailCase.members.last_name}</span>
                </div>
              )}
              {detailCase.assigned_to && assigneeMap[detailCase.assigned_to] && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  <span>Assigned to {assigneeMap[detailCase.assigned_to]}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{new Date(detailCase.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
              {detailCase.description && (
                <div>
                  <p className="font-medium text-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detailCase.description}</p>
                </div>
              )}
              {detailCase.resolution_notes && (
                <div>
                  <p className="font-medium text-foreground mb-1">Resolution Notes</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detailCase.resolution_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Case Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Manage Case</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {isPastoralLeader && pastoralUnitMembers.length > 0 && (
              <div>
                <Label>Assign To</Label>
                <Select value={statusUpdate.assigned_to || "unassigned"} onValueChange={v => setStatusUpdate(f => ({ ...f, assigned_to: v === "unassigned" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select unit member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— Unassigned —</SelectItem>
                    {pastoralUnitMembers.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={statusUpdate.status} onValueChange={v => setStatusUpdate(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Resolution Notes</Label><Textarea value={statusUpdate.resolution_notes} onChange={e => setStatusUpdate(f => ({ ...f, resolution_notes: e.target.value }))} rows={3} /></div>
            <Button onClick={() => updateMutation.mutate({ id: selectedCase.id, updates: statusUpdate, caseData: selectedCase })} disabled={updateMutation.isPending} className="w-full bg-primary">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Case
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
