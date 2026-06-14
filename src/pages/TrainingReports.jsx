import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { Loader2, Plus, Droplets, Flame, BookOpen, Users, TrendingUp, Paperclip, Download, Printer, Award, Search, X, Send, ClipboardList, Pencil, Trash2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useAppSetting } from "@/hooks/useAppSetting";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import ReportAttachments from "@/components/reports/ReportAttachments";
import TrainingAttendeesPanel from "@/components/training/TrainingAttendeesPanel";
import PrintReportButton from "@/components/PrintReportButton";
import { useSubFeature } from "@/hooks/useSubFeature";

const ICON_MAP = {
  "Water Baptism": { icon: Droplets, color: "text-blue-500" },
  "Holy Spirit Baptism": { icon: Flame, color: "text-orange-500" },
  "Believers Foundation Class (BFC)": { icon: BookOpen, color: "text-cyan-500" },
  "WIT": { icon: BookOpen, color: "text-emerald-500" },
  "BCC": { icon: BookOpen, color: "text-teal-500" },
  "LCC": { icon: BookOpen, color: "text-indigo-500" },
  "LDC": { icon: BookOpen, color: "text-rose-500" },
};

const DEFAULT_TRAINING_TYPES = ["Water Baptism", "Holy Spirit Baptism", "Believers Foundation Class (BFC)", "WIT", "BCC", "LCC", "LDC"];

const emptyForm = {
  training_type: "",
  session_date: format(new Date(), "yyyy-MM-dd"),
  title: "",
  total_attendance: "",
  male: "",
  female: "",
  holy_ghost_baptism: "",
  water_baptism: "",
  notes: "",
};

export default function TrainingReports() {
  const { data: trainingTypeValues } = useAppSetting("training_types", DEFAULT_TRAINING_TYPES);
  const TRAINING_TYPES = trainingTypeValues.map(v => ({
    value: v,
    label: v,
    icon: ICON_MAP[v]?.icon || BookOpen,
    color: ICON_MAP[v]?.color || "text-muted-foreground",
  }));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [attendees, setAttendees] = useState({}); // { memberId: { completed, reason, signpost } }
  const { user, isAdmin } = useAuth();
  const { tenantSlug } = useParams();
  const certReportPath = tenantSlug ? `/t/${tenantSlug}/certificates-report` : "/certificates-report";
  const certApprovalsPath = tenantSlug ? `/t/${tenantSlug}/certificate-approvals` : "/certificate-approvals";
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { isMemberOfUnit: isTrainingRep } = useUnitMembership("Training Rep");
  const { data: isTrainingRepLeader = false } = useQuery({
    queryKey: ["is-training-rep-leader", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_training_rep_leader", { _user_id: user.id, _tenant_id: tenantId });
      return !!data;
    },
  });
  const canManageAttendees = isAdmin || isTrainingRep;
  const canManageCertificates = isAdmin || isTrainingRepLeader;

  const { enabled: canRecordSession } = useSubFeature("training.record_session");
  const { enabled: canCsvExport } = useSubFeature("training.csv_export");
  const { enabled: canPrint } = useSubFeature("training.print");
  const { enabled: canAttachments } = useSubFeature("training.attachments");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["training-reports", filterType, filterFrom, filterTo, tenantId],
    queryFn: async () => {
      let q = supabase
        .from("training_reports")
        .select("*")
        .order("session_date", { ascending: false });
      if (filterType !== "all") q = q.eq("training_type", filterType);
      if (filterFrom) q = q.gte("session_date", filterFrom);
      if (filterTo) q = q.lte("session_date", filterTo);
      const { data, error } = await scopeQuery(q);
      if (error) throw error;
      return data;
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-for-training-form", tenantId],
    enabled: !!tenantId && open && canManageAttendees,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("members").select("id, first_name, last_name, email").order("first_name", { ascending: true })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const filteredMembers = useMemo(() => {
    const s = attendeeSearch.trim().toLowerCase();
    if (!s) return [];
    return allMembers.filter(m => {
      const name = `${m.first_name} ${m.last_name}`.toLowerCase();
      return name.includes(s) || (m.email || "").toLowerCase().includes(s);
    }).slice(0, 50);
  }, [allMembers, attendeeSearch]);

  const selectedMembers = useMemo(
    () => allMembers.filter(m => attendees[m.id]),
    [allMembers, attendees]
  );

  const toggleAttendee = (m) => {
    setAttendees(prev => {
      const next = { ...prev };
      if (next[m.id]) delete next[m.id];
      else next[m.id] = { completed: true, reason: "", signpost: false };
      return next;
    });
  };
  const updateAttendee = (id, patch) => {
    setAttendees(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setAttendees({});
    setAttendeeSearch("");
  };

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { data: inserted, error } = await supabase
        .from("training_reports")
        .insert(withTenant(payload))
        .select("id")
        .single();
      if (error) throw error;
      const reportId = inserted.id;

      const attendeeRows = Object.entries(attendees).map(([memberId, info]) => withTenant({
        training_report_id: reportId,
        member_id: memberId,
        training_type: payload.training_type,
        attended: true,
        completed: !!info.completed,
        not_completed_reason: info.completed ? null : (info.reason || null),
        signpost_status: info.completed && info.signpost ? "pending" : "none",
        signposted_by: info.completed && info.signpost ? user?.id : null,
        signposted_at: info.completed && info.signpost ? new Date().toISOString() : null,
      }));
      if (attendeeRows.length > 0) {
        const { error: aErr } = await supabase.from("training_attendees").insert(attendeeRows);
        if (aErr) throw new Error(`Session saved but attendees failed: ${aErr.message}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-reports"] });
      qc.invalidateQueries({ queryKey: ["certificate-approvals"] });
      toast({ title: "Report saved successfully" });
      resetForm();
      setOpen(false);
    },
    onError: (err) => toast({ title: "Error saving report", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.training_type || !form.session_date) {
      toast({ title: "Please select training type and date", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      training_type: form.training_type,
      session_date: form.session_date,
      title: form.title || null,
      total_attendance: (parseInt(form.male) || 0) + (parseInt(form.female) || 0),
      male: parseInt(form.male) || 0,
      female: parseInt(form.female) || 0,
      holy_ghost_baptism: parseInt(form.holy_ghost_baptism) || 0,
      water_baptism: parseInt(form.water_baptism) || 0,
      notes: form.notes || null,
      recorded_by: user?.id,
    });
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const getTypeConfig = (type) => TRAINING_TYPES.find((t) => t.value === type) || {};

  // Summary stats
  const totalSessions = reports.length;
  const totalAttendance = reports.reduce((s, r) => s + r.total_attendance, 0);
  const totalHGBaptism = reports.reduce((s, r) => s + r.holy_ghost_baptism, 0);
  const totalWBaptism = reports.reduce((s, r) => s + r.water_baptism, 0);

  const handleDownloadCSV = () => {
    const headers = ["Date", "Type", "Title", "Total", "Male", "Female", "HG Baptism", "Water Baptism", "Notes"];
    const rows = reports.map(r => [
      r.session_date,
      r.training_type,
      r.title || "",
      r.total_attendance,
      r.male,
      r.female,
      r.holy_ghost_baptism,
      r.water_baptism,
      (r.notes || "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildPrintRows = () => ({
    title: "Training Report",
    headers: ["Date", "Type", "Title", "Total", "Male", "Female", "HG Baptism", "Water Baptism"],
    rows: reports.map(r => [
      format(parseISO(r.session_date), "dd MMM yyyy"),
      r.training_type,
      r.title || "",
      r.total_attendance,
      r.male,
      r.female,
      r.holy_ghost_baptism,
      r.water_baptism,
    ]),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Training Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record attendance and outcomes for training sessions</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageCertificates && (
            <>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to={certReportPath}><Award className="h-4 w-4" /> Certificates Report</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link to={certApprovalsPath}><ClipboardList className="h-4 w-4" /> Certificate Approvals</Link>
              </Button>
            </>
          )}
        {canRecordSession && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Record Session</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Training Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Training Type *</Label>
                  <Select value={form.training_type} onValueChange={(v) => set("training_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {TRAINING_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Session Date *</Label>
                  <Input type="date" value={form.session_date} onChange={(e) => set("session_date", e.target.value)} />
                </div>
                <div>
                  <Label>Title (optional)</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Week 3" />
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Attendance</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Male</Label>
                    <Input type="number" min="0" value={form.male} onChange={(e) => set("male", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Female</Label>
                    <Input type="number" min="0" value={form.female} onChange={(e) => set("female", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Total</Label>
                    <Input type="number" readOnly value={(parseInt(form.male) || 0) + (parseInt(form.female) || 0)} className="bg-muted font-semibold" />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Flame className="h-4 w-4" /> Spiritual Outcomes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Holy Ghost Baptism</Label>
                    <Input type="number" min="0" value={form.holy_ghost_baptism} onChange={(e) => set("holy_ghost_baptism", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Water Baptism</Label>
                    <Input type="number" min="0" value={form.water_baptism} onChange={(e) => set("water_baptism", e.target.value)} />
                  </div>
                </div>
              </div>

              {canManageAttendees && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Attendees
                    {selectedMembers.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">{selectedMembers.length}</Badge>
                    )}
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      placeholder="Search members to add..."
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                  {attendeeSearch && filteredMembers.length > 0 && (
                    <div className="border rounded-md bg-background max-h-40 overflow-y-auto">
                      {filteredMembers.map(m => (
                        <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer text-xs">
                          <Checkbox checked={!!attendees[m.id]} onCheckedChange={() => toggleAttendee(m)} />
                          <span className="truncate">{m.first_name} {m.last_name}</span>
                          {m.email && <span className="text-muted-foreground truncate ml-auto">{m.email}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Search above to add members who attended. You can also add them later from the session row.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedMembers.map(m => {
                        const info = attendees[m.id];
                        return (
                          <div key={m.id} className="rounded-md border bg-background p-2 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium truncate">{m.first_name} {m.last_name}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleAttendee(m)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-1.5 text-xs">
                                <Checkbox
                                  checked={info.completed}
                                  onCheckedChange={(v) => updateAttendee(m.id, { completed: !!v, signpost: v ? info.signpost : false })}
                                />
                                Completed
                              </label>
                              {info.completed && (
                                <label className="flex items-center gap-1.5 text-xs">
                                  <Checkbox
                                    checked={info.signpost}
                                    onCheckedChange={(v) => updateAttendee(m.id, { signpost: !!v })}
                                  />
                                  <Send className="h-3 w-3" /> Signpost for certificate
                                </label>
                              )}
                            </div>
                            {!info.completed && (
                              <Input
                                value={info.reason}
                                onChange={(e) => updateAttendee(m.id, { reason: e.target.value })}
                                placeholder="Reason for not completing (optional)"
                                className="h-7 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
              </div>

              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Report
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{totalSessions}</p><p className="text-xs text-muted-foreground">Sessions</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{totalAttendance}</p><p className="text-xs text-muted-foreground">Total Attendance</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-orange-500">{totalHGBaptism}</p><p className="text-xs text-muted-foreground">HG Baptisms</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-blue-500">{totalWBaptism}</p><p className="text-xs text-muted-foreground">Water Baptisms</p></CardContent></Card>
      </div>

      {/* Filter + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-display">Session Records</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-36 text-xs" placeholder="From" />
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-36 text-xs" placeholder="To" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TRAINING_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCsvExport && (
                <Button variant="outline" size="sm" onClick={handleDownloadCSV} disabled={reports.length === 0} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              )}
              {canPrint && <PrintReportButton buildRows={buildPrintRows} label="Print" />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No training reports recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-center">F</TableHead>
                    <TableHead className="text-center">HG</TableHead>
                    <TableHead className="text-center">WB</TableHead>
                    <TableHead className="w-10"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => {
                    const cfg = getTypeConfig(r.training_type);
                    return (
                      <React.Fragment key={r.id}>
                        <TableRow>
                          <TableCell className="text-sm">{format(parseISO(r.session_date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs gap-1">
                              {cfg.icon && <cfg.icon className={`h-3 w-3 ${cfg.color || ""}`} />}
                              {r.training_type}
                            </Badge>
                            {r.title && <span className="block text-xs text-muted-foreground mt-0.5">{r.title}</span>}
                          </TableCell>
                          <TableCell className="text-center font-semibold">{r.total_attendance}</TableCell>
                          <TableCell className="text-center">{r.male}</TableCell>
                          <TableCell className="text-center">{r.female}</TableCell>
                          <TableCell className="text-center">{r.holy_ghost_baptism}</TableCell>
                          <TableCell className="text-center">{r.water_baptism}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                              <Users className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedRow === r.id && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/20 p-3 space-y-4">
                              <TrainingAttendeesPanel report={r} />
                              {canAttachments && (
                                <div className="pt-3 border-t">
                                  <ReportAttachments relatedTable="training_reports" relatedId={r.id} />
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
