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
import { Loader2, Check, X, Award, Download } from "lucide-react";
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
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", signposterIds);
      return data || [];
    },
  });
  const profileMap = useMemo(() => {
    const m = new Map();
    profiles.forEach(p => m.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—"));
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
      // Mark approved first
      const { error: aErr } = await supabase.from("training_attendees").update({
        signpost_status: "approved",
        decision_by: user?.id,
        decision_at: new Date().toISOString(),
      }).eq("id", row.id).eq("tenant_id", tenantId);
      if (aErr) throw aErr;

      // Call issue-certificate edge function
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
      toast({ title: "Issue failed", description: e.message, variant: "destructive" });
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Certificate Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Review members signposted by the Training Rep unit for certificate issuance</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({counts.pending || 0})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved || 0})</TabsTrigger>
          <TabsTrigger value="declined">Declined ({counts.declined || 0})</TabsTrigger>
          <TabsTrigger value="issued">Issued ({counts.issued || 0})</TabsTrigger>
          <TabsTrigger value="all">All ({counts.all || 0})</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "report" && (
        <ReportView rows={rows} trainingTypes={trainingTypes} profileMap={profileMap} />
      )}
      {tab !== "report" && (
      <>


      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-display">Signposted Members</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="w-48 h-8 text-xs" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {trainingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleCSV} disabled={filtered.length === 0} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <PrintReportButton buildRows={() => ({ title: "Certificate Approvals", headers, rows: buildRows() })} label="Print" />
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
                        <TableCell><Badge variant={STATUS_VARIANT[r.signpost_status]} className="capitalize text-[10px]">{r.signpost_status}</Badge></TableCell>
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
                          {r.decision_notes && (r.signpost_status === "declined" || r.signpost_status === "approved") && (
                            <span className="text-xs text-muted-foreground italic">{r.decision_notes}</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline certificate</DialogTitle>
            <DialogDescription>Provide a reason for declining this certificate issuance.</DialogDescription>
          </DialogHeader>
          <Textarea value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} rows={3} placeholder="Reason (required)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineFor(null)}>Cancel</Button>
            <Button
              variant="destructive"
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
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block">Training type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {trainingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={byType.length === 0} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <PrintReportButton buildRows={() => ({ title: "Certificate Approvals Report", headers, rows: buildRows() })} label="Print" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total },
          { label: "Pending", value: stats.pending || 0 },
          { label: "Approved", value: stats.approved || 0 },
          { label: "Declined", value: stats.declined || 0 },
          { label: "Issued", value: stats.issued || 0 },
          { label: "Avg days to decision", value: stats.avgDays },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xl font-display font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
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
            <Table>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

