import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { Loader2, Check, X, Award, Download, RefreshCw, AlertTriangle } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";

const STATUS_VARIANT = {
  pending: "secondary",
  approved: "default",
  declined: "destructive",
  issued: "default",
};

export default function CertificateApprovals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();

  const [tab, setTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [declineFor, setDeclineFor] = useState(null);
  const [declineNotes, setDeclineNotes] = useState("");
  const [busyId, setBusyId] = useState(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["certificate-approvals", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("training_attendees")
          .select("*, member:members(id, first_name, last_name, email), report:training_reports(session_date, training_type, title)")
          .neq("signpost_status", "none")
          .order("signposted_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const signposterIds = useMemo(() => [...new Set(rows.map(r => r.signposted_by).filter(Boolean))], [rows]);
  const { data: profiles = [] } = useQuery({
    queryKey: ["cert-approval-profiles", signposterIds.join(",")],
    enabled: signposterIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", signposterIds);
      return data || [];
    },
  });
  const profileMap = useMemo(() => {
    const m = new Map();
    profiles.forEach(p => m.set(p.user_id, p.full_name || p.email || "—"));
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (tab !== "all" && r.signpost_status !== tab) return false;
      if (typeFilter !== "all" && r.training_type !== typeFilter) return false;
      if (s) {
        const name = `${r.member?.first_name || ""} ${r.member?.last_name || ""}`.toLowerCase();
        if (!name.includes(s) && !(r.member?.email || "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, tab, typeFilter, search]);

  const trainingTypes = useMemo(() => [...new Set(rows.map(r => r.training_type))], [rows]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, declined: 0, issued: 0, all: rows.length };
    rows.forEach(r => { c[r.signpost_status] = (c[r.signpost_status] || 0) + 1; });
    return c;
  }, [rows]);

  const stuckCount = useMemo(
    () => rows.filter(r => r.signpost_status === "approved" && !r.certificate_number).length,
    [rows]
  );

  const declineMutation = useMutation({
    mutationFn: async ({ id, notes }) => {
      const { error } = await supabase.from("training_attendees").update({
        signpost_status: "declined",
        decision_by: user?.id,
        decision_at: new Date().toISOString(),
        decision_notes: notes || null,
      }).eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificate-approvals"] });
      toast({ title: "Declined" });
      setDeclineFor(null); setDeclineNotes("");
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleApprove = async (row) => {
    setBusyId(row.id);
    try {
      // Invoke issue-certificate FIRST so a transient failure doesn't leave the
      // row stuck in "approved" with no certificate.
      const { data, error } = await supabase.functions.invoke("issue-certificate", {
        body: {
          member_id: row.member_id,
          training_type: row.training_type,
          tenant_id: tenantId,
          completion_date: row.report?.session_date,
        },
      });
      if (error) throw error;
      const certNumber = data?.certificate_number || data?.certificateNumber || null;

      const { error: uErr } = await supabase.from("training_attendees").update({
        signpost_status: "issued",
        decision_by: user?.id,
        decision_at: new Date().toISOString(),
        certificate_number: certNumber,
      }).eq("id", row.id).eq("tenant_id", tenantId);
      if (uErr) throw uErr;

      qc.invalidateQueries({ queryKey: ["certificate-approvals"] });
      toast({ title: "Certificate issued", description: certNumber || "" });
    } catch (e) {
      toast({ title: "Issue failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRetryIssue = async (row) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("issue-certificate", {
        body: {
          member_id: row.member_id,
          training_type: row.training_type,
          tenant_id: tenantId,
          completion_date: row.report?.session_date,
        },
      });
      if (error) throw error;
      const certNumber = data?.certificate_number || data?.certificateNumber || null;

      const { error: uErr } = await supabase.from("training_attendees").update({
        signpost_status: "issued",
        certificate_number: certNumber,
      }).eq("id", row.id).eq("tenant_id", tenantId);
      if (uErr) throw uErr;

      qc.invalidateQueries({ queryKey: ["certificate-approvals"] });
      toast({ title: "Certificate issued", description: certNumber || "" });
    } catch (e) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const headers = ["Member", "Training", "Session Date", "Signposted By", "Signposted At", "Status", "Decision At", "Certificate #"];
  const buildRows = () => filtered.map(r => [
    `${r.member?.first_name || ""} ${r.member?.last_name || ""}`.trim() || "—",
    r.training_type,
    r.report?.session_date ? format(parseISO(r.report.session_date), "dd MMM yyyy") : "—",
    profileMap.get(r.signposted_by) || "—",
    r.signposted_at ? format(parseISO(r.signposted_at), "dd MMM yyyy HH:mm") : "—",
    r.signpost_status,
    r.decision_at ? format(parseISO(r.decision_at), "dd MMM yyyy HH:mm") : "—",
    r.certificate_number || "—",
  ]);

  const handleCSV = () => {
    const csv = [headers.join(","), ...buildRows().map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `certificate-approvals-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-primary shrink-0" /> Certificate Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review members signposted by the Training Rep unit for certificate issuance</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="relative -mx-1 px-1">
          <div className="overflow-x-auto">
            <TabsList className="w-max gap-1 px-1">
              <TabsTrigger value="pending" className="text-xs px-2.5 whitespace-nowrap">Pending ({counts.pending || 0})</TabsTrigger>
              <TabsTrigger value="approved" className="gap-1.5 text-xs px-2.5 whitespace-nowrap">
                Approved ({counts.approved || 0})
                {stuckCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{stuckCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="declined" className="text-xs px-2.5 whitespace-nowrap">Declined ({counts.declined || 0})</TabsTrigger>
              <TabsTrigger value="issued" className="text-xs px-2.5 whitespace-nowrap">Issued ({counts.issued || 0})</TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-2.5 whitespace-nowrap">All ({counts.all || 0})</TabsTrigger>
              <TabsTrigger value="report" className="text-xs px-2.5 whitespace-nowrap">Report</TabsTrigger>
            </TabsList>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent sm:hidden" />
        </div>
      </Tabs>


      {tab === "report" && (
        <ReportView rows={rows} trainingTypes={trainingTypes} profileMap={profileMap} />
      )}
      {tab !== "report" && (
      <>


      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
            <CardTitle className="text-base font-display">Signposted Members</CardTitle>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="w-full sm:w-48 h-8 text-xs" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {trainingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleCSV} disabled={filtered.length === 0} className="gap-1.5 flex-1 sm:flex-none">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <PrintReportButton buildRows={() => ({ title: "Certificate Approvals", headers, rows: buildRows() })} label="Print" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No records</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Training</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Signposted By</TableHead>
                    <TableHead>Signposted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cert #</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const name = `${r.member?.first_name || ""} ${r.member?.last_name || ""}`.trim() || "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">{name}</div>
                          {r.member?.email && <div className="text-xs text-muted-foreground">{r.member.email}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{r.training_type}</TableCell>
                        <TableCell className="text-sm">{r.report?.session_date ? format(parseISO(r.report.session_date), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell className="text-xs">{profileMap.get(r.signposted_by) || "—"}</TableCell>
                        <TableCell className="text-xs">{r.signposted_at ? format(parseISO(r.signposted_at), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant={STATUS_VARIANT[r.signpost_status]} className="capitalize text-[10px]">{r.signpost_status}</Badge>
                            {r.signpost_status === "approved" && !r.certificate_number && (
                              <span title="Certificate not yet generated — needs re-issue">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{r.certificate_number || "—"}</TableCell>
                        <TableCell className="text-right">
                          {r.signpost_status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" className="gap-1 h-7" disabled={busyId === r.id} onClick={() => handleApprove(r)}>
                                {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => { setDeclineFor(r); setDeclineNotes(""); }}>
                                <X className="h-3 w-3" /> Decline
                              </Button>
                            </div>
                          )}
                          {r.signpost_status === "approved" && !r.certificate_number && (
                            <Button size="sm" variant="outline" className="gap-1 h-7" disabled={busyId === r.id} onClick={() => handleRetryIssue(r)}>
                              {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Retry Issue
                            </Button>
                          )}
                          {r.decision_notes && (r.signpost_status === "declined" || r.signpost_status === "approved") && (
                            <span className="text-xs text-muted-foreground italic ml-2">{r.decision_notes}</span>
                          )}
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}



      <Dialog open={!!declineFor} onOpenChange={(v) => !v && setDeclineFor(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Decline certificate</DialogTitle>
            <DialogDescription>Provide a reason for declining this certificate issuance.</DialogDescription>
          </DialogHeader>
          <Textarea value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} rows={3} placeholder="Reason (required)" />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDeclineFor(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={!declineNotes.trim() || declineMutation.isPending}
              onClick={() => declineMutation.mutate({ id: declineFor.id, notes: declineNotes.trim() })}
            >
              {declineMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Decline
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportView({ rows, trainingTypes, profileMap }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== "all" && r.signpost_status !== statusFilter) return false;
      if (typeFilter !== "all" && r.training_type !== typeFilter) return false;
      if (from && r.signposted_at && r.signposted_at < from) return false;
      if (to && r.signposted_at && r.signposted_at > to + "T23:59:59") return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter, from, to]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, pending: 0, approved: 0, declined: 0, issued: 0, avgDays: 0 };
    let decidedCount = 0; let totalDays = 0;
    filtered.forEach(r => {
      s[r.signpost_status] = (s[r.signpost_status] || 0) + 1;
      if (r.decision_at && r.signposted_at) {
        decidedCount++;
        totalDays += (new Date(r.decision_at) - new Date(r.signposted_at)) / 86400000;
      }
    });
    s.avgDays = decidedCount > 0 ? (totalDays / decidedCount).toFixed(1) : "—";
    return s;
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map();
    filtered.forEach(r => {
      const k = r.training_type;
      if (!map.has(k)) map.set(k, { type: k, total: 0, pending: 0, approved: 0, declined: 0, issued: 0 });
      const g = map.get(k);
      g.total++;
      g[r.signpost_status] = (g[r.signpost_status] || 0) + 1;
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const headers = ["Training Type", "Total", "Pending", "Approved", "Declined", "Issued"];
  const buildRows = () => byType.map(g => [g.type, g.total, g.pending, g.approved, g.declined, g.issued]);

  const handleCSV = () => {
    const csv = [headers.join(","), ...buildRows().map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `certificate-approvals-report-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 min-w-0">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 sm:p-4 flex flex-wrap items-end gap-2 sm:gap-3">
          <div className="w-[calc(50%-0.25rem)] sm:w-auto">
            <label className="text-xs text-muted-foreground block">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs w-full sm:w-36" />
          </div>
          <div className="w-[calc(50%-0.25rem)] sm:w-auto">
            <label className="text-xs text-muted-foreground block">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs w-full sm:w-36" />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-xs text-muted-foreground block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-xs text-muted-foreground block">Training type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {trainingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={byType.length === 0} className="gap-1.5 flex-1 sm:flex-none">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <PrintReportButton buildRows={() => ({ title: "Certificate Approvals Report", headers, rows: buildRows() })} label="Print" />
          </div>
        </CardContent>
      </Card>


      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending || 0 },
          { label: "Approved", value: stats.approved || 0 },
          { label: "Declined", value: stats.declined || 0 },
          { label: "Issued", value: stats.issued || 0 },
          { label: "Avg days to decision", value: stats.avgDays },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-2.5 sm:p-3 text-center">
              <p className="text-lg sm:text-xl font-display font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] leading-tight text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base font-display">Breakdown by training type</CardTitle></CardHeader>
        <CardContent>
          {byType.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No records match the selected filters</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Training Type</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Declined</TableHead>
                    <TableHead className="text-center">Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byType.map(g => (
                    <TableRow key={g.type}>
                      <TableCell className="font-medium text-sm">{g.type}</TableCell>
                      <TableCell className="text-center">{g.total}</TableCell>
                      <TableCell className="text-center">{g.pending || 0}</TableCell>
                      <TableCell className="text-center">{g.approved || 0}</TableCell>
                      <TableCell className="text-center">{g.declined || 0}</TableCell>
                      <TableCell className="text-center">{g.issued || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

      </Card>
    </div>
  );
}

