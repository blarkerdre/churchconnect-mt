import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, Download, RotateCw, Users, TrendingUp } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PrintReportButton from "@/components/PrintReportButton";
import { toast } from "@/components/ui/use-toast";

function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function CertificatesReport() {
  const { tenantId } = useTenantQuery();
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [programme, setProgramme] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Certificates (training_completions) joined with members
  const { data: completions = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["cert-report-completions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_completions")
        .select("id, member_id, training_type, completion_date, certificate_number, certificate_url, issued_by, notes, created_at, members:member_id(first_name,last_name,email,unit,status)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Audit log entries for issued/reissued
  const { data: auditRows = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["cert-report-audit", tenantId, fromDate, toDate],
    enabled: !!tenantId,
    queryFn: async () => {
      const from = `${fromDate}T00:00:00.000Z`;
      const to = `${toDate}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, user_id, details, created_at")
        .eq("tenant_id", tenantId)
        .in("action", ["certificate_issued", "certificate_reissued"])
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Resolve issuer profiles
  const issuerIds = useMemo(() => {
    const ids = new Set();
    completions.forEach((c) => c.issued_by && ids.add(c.issued_by));
    auditRows.forEach((a) => a.user_id && ids.add(a.user_id));
    return [...ids];
  }, [completions, auditRows]);

  const { data: issuers = [] } = useQuery({
    queryKey: ["cert-report-issuers", tenantId, issuerIds.join(",")],
    enabled: !!tenantId && issuerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", issuerIds);
      if (error) throw error;
      return data || [];
    },
  });
  const issuerMap = useMemo(() => {
    const m = new Map();
    issuers.forEach((p) => m.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "—"));
    return m;
  }, [issuers]);

  // Map certificate_number -> { name, email, member_id } (from completions)
  const certInfoMap = useMemo(() => {
    const m = new Map();
    completions.forEach((c) => {
      if (!c.certificate_number) return;
      const name = `${c.members?.first_name || ""} ${c.members?.last_name || ""}`.trim() || "—";
      m.set(c.certificate_number, {
        name,
        email: c.members?.email || "",
        member_id: c.member_id,
        completion_date: c.completion_date,
      });
    });
    return m;
  }, [completions]);

  // For legacy audit rows whose completion was deleted, look up member by details.member_id
  const orphanMemberIds = useMemo(() => {
    const known = new Set([...certInfoMap.values()].map((v) => v.member_id));
    const ids = new Set();
    auditRows.forEach((a) => {
      const mid = a.details?.member_id;
      if (mid && !known.has(mid)) ids.add(mid);
    });
    return [...ids];
  }, [auditRows, certInfoMap]);

  const { data: orphanMembers = [] } = useQuery({
    queryKey: ["cert-report-orphan-members", tenantId, orphanMemberIds.join(",")],
    enabled: !!tenantId && orphanMemberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, email")
        .in("id", orphanMemberIds);
      if (error) throw error;
      return data || [];
    },
  });
  const orphanMemberMap = useMemo(() => {
    const m = new Map();
    orphanMembers.forEach((p) => m.set(p.id, {
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—",
      email: p.email || "",
    }));
    return m;
  }, [orphanMembers]);

  const resolveAuditMember = (a) => {
    const info = certInfoMap.get(a.details?.certificate_number);
    if (info) return info;
    const mid = a.details?.member_id;
    if (mid && orphanMemberMap.has(mid)) return { ...orphanMemberMap.get(mid), member_id: mid, completion_date: a.details?.completion_date };
    return { name: "—", email: "", member_id: mid, completion_date: a.details?.completion_date };
  };

  // Build reissue stats per cert number
  const reissueStats = useMemo(() => {
    const map = new Map();
    auditRows.forEach((a) => {
      const cn = a.details?.certificate_number;
      if (!cn) return;
      const entry = map.get(cn) || { issued: 0, reissued: 0, firstIssuedAt: null, lastReissuedAt: null };
      if (a.action === "certificate_issued") {
        entry.issued += 1;
        if (!entry.firstIssuedAt || a.created_at < entry.firstIssuedAt) entry.firstIssuedAt = a.created_at;
      } else if (a.action === "certificate_reissued") {
        entry.reissued += 1;
        if (!entry.lastReissuedAt || a.created_at > entry.lastReissuedAt) entry.lastReissuedAt = a.created_at;
      }
      map.set(cn, entry);
    });
    return map;
  }, [auditRows]);

  const programmes = useMemo(() => {
    const s = new Set();
    completions.forEach((c) => c.training_type && s.add(c.training_type));
    return [...s].sort();
  }, [completions]);

  // Apply filters to certificates
  const filteredCerts = useMemo(() => {
    const fromTs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    const toTs = new Date(`${toDate}T23:59:59.999Z`).getTime();
    const q = search.trim().toLowerCase();
    return completions.filter((c) => {
      const ts = c.created_at ? new Date(c.created_at).getTime() : 0;
      if (ts < fromTs || ts > toTs) return false;
      if (programme !== "all" && c.training_type !== programme) return false;
      const stats = reissueStats.get(c.certificate_number) || { reissued: 0 };
      if (statusFilter === "issued_only" && stats.reissued > 0) return false;
      if (statusFilter === "reissued_only" && stats.reissued === 0) return false;
      if (q) {
        const name = `${c.members?.first_name || ""} ${c.members?.last_name || ""}`.toLowerCase();
        if (!name.includes(q) && !(c.certificate_number || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [completions, fromDate, toDate, programme, statusFilter, search, reissueStats]);

  const filteredAudit = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditRows.filter((a) => {
      if (programme !== "all" && a.details?.training_type !== programme) return false;
      if (statusFilter === "issued_only" && a.action !== "certificate_issued") return false;
      if (statusFilter === "reissued_only" && a.action !== "certificate_reissued") return false;
      if (q) {
        const cn = (a.details?.certificate_number || "").toLowerCase();
        if (!cn.includes(q)) return false;
      }
      return true;
    });
  }, [auditRows, programme, statusFilter, search]);

  // Summary stats
  const totals = useMemo(() => {
    const issuedCount = auditRows.filter((a) => a.action === "certificate_issued"
      && (programme === "all" || a.details?.training_type === programme)).length;
    const reissuedCount = auditRows.filter((a) => a.action === "certificate_reissued"
      && (programme === "all" || a.details?.training_type === programme)).length;
    const uniqueMembers = new Set(filteredCerts.map((c) => c.member_id)).size;
    const byProg = new Map();
    filteredCerts.forEach((c) => byProg.set(c.training_type, (byProg.get(c.training_type) || 0) + 1));
    let topProg = "—", topCount = 0;
    byProg.forEach((v, k) => { if (v > topCount) { topProg = k; topCount = v; } });
    return { issuedCount, reissuedCount, uniqueMembers, topProg, topCount };
  }, [auditRows, filteredCerts, programme]);

  // By programme aggregation
  const byProgramme = useMemo(() => {
    const map = new Map();
    filteredCerts.forEach((c) => {
      const k = c.training_type || "—";
      const e = map.get(k) || { programme: k, issued: 0, reissued: 0, members: new Set() };
      e.issued += 1;
      e.reissued += reissueStats.get(c.certificate_number)?.reissued || 0;
      e.members.add(c.member_id);
      map.set(k, e);
    });
    return [...map.values()].map((e) => ({
      programme: e.programme,
      issued: e.issued,
      reissued: e.reissued,
      uniqueMembers: e.members.size,
    })).sort((a, b) => b.issued - a.issued);
  }, [filteredCerts, reissueStats]);

  const handleDownload = async (c) => {
    if (!c.certificate_url) {
      toast({ title: "No file available", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from("church-documents")
      .createSignedUrl(c.certificate_url, 300, { download: `${c.certificate_number}.png` });
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const exportCertsCSV = () => {
    downloadCSV(
      `certificates-${fromDate}-to-${toDate}.csv`,
      ["Member", "Email", "Unit", "Programme", "Cert No", "Completion Date", "First Issued", "Last Reissued", "Reissue Count", "Issued By"],
      filteredCerts.map((c) => {
        const stats = reissueStats.get(c.certificate_number) || {};
        return [
          `${c.members?.first_name || ""} ${c.members?.last_name || ""}`.trim(),
          c.members?.email || "",
          c.members?.unit || "",
          c.training_type,
          c.certificate_number,
          c.completion_date,
          stats.firstIssuedAt ? format(parseISO(stats.firstIssuedAt), "yyyy-MM-dd HH:mm") : (c.created_at ? format(parseISO(c.created_at), "yyyy-MM-dd HH:mm") : ""),
          stats.lastReissuedAt ? format(parseISO(stats.lastReissuedAt), "yyyy-MM-dd HH:mm") : "",
          stats.reissued || 0,
          issuerMap.get(c.issued_by) || "",
        ];
      })
    );
  };

  const exportActivityCSV = () => {
    downloadCSV(
      `certificate-activity-${fromDate}-to-${toDate}.csv`,
      ["Timestamp", "Action", "Member", "Email", "Cert No", "Programme", "Completion Date", "Issued By"],
      filteredAudit.map((a) => {
        const info = resolveAuditMember(a);
        return [
          format(parseISO(a.created_at), "yyyy-MM-dd HH:mm:ss"),
          a.action === "certificate_reissued" ? "Reissued" : "Issued",
          info.name,
          info.email,
          a.details?.certificate_number || "",
          a.details?.training_type || "",
          info.completion_date ? format(parseISO(info.completion_date), "yyyy-MM-dd") : "",
          issuerMap.get(a.user_id) || "",
        ];
      })
    );
  };

  const buildCertsPrint = () => ({
    title: `Certificates Report (${fromDate} to ${toDate})`,
    headers: ["Member", "Email", "Programme", "Cert No", "Completion", "First Issued", "Last Reissued", "Reissues", "Issued By"],
    rows: filteredCerts.map((c) => {
      const stats = reissueStats.get(c.certificate_number) || {};
      return [
        `${c.members?.first_name || ""} ${c.members?.last_name || ""}`.trim(),
        c.members?.email || "",
        c.training_type,
        c.certificate_number,
        c.completion_date ? format(parseISO(c.completion_date), "dd MMM yyyy") : "",
        stats.firstIssuedAt ? format(parseISO(stats.firstIssuedAt), "dd MMM yyyy") : (c.created_at ? format(parseISO(c.created_at), "dd MMM yyyy") : ""),
        stats.lastReissuedAt ? format(parseISO(stats.lastReissuedAt), "dd MMM yyyy") : "—",
        stats.reissued || 0,
        issuerMap.get(c.issued_by) || "—",
      ];
    }),
  });

  const buildActivityPrint = () => ({
    title: `Certificate Activity Log (${fromDate} to ${toDate})`,
    headers: ["When", "Action", "Member", "Cert No", "Programme", "Completion", "Issued By"],
    rows: filteredAudit.map((a) => {
      const info = resolveAuditMember(a);
      return [
        format(parseISO(a.created_at), "dd MMM yyyy HH:mm"),
        a.action === "certificate_reissued" ? "Reissued" : "Issued",
        info.name,
        a.details?.certificate_number || "",
        a.details?.training_type || "",
        info.completion_date ? format(parseISO(info.completion_date), "dd MMM yyyy") : "—",
        issuerMap.get(a.user_id) || "—",
      ];
    }),
  });

  const loading = loadingCerts || loadingAudit;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <Award className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Certificates Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Issued and reissued training certificates, with full activity history.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Programme</Label>
            <Select value={programme} onValueChange={setProgramme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programmes</SelectItem>
                {programmes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="issued_only">Issued (never reissued)</SelectItem>
                <SelectItem value="reissued_only">Reissued at least once</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search</Label>
            <Input placeholder="Name or cert number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Issued in range</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.issuedCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5"><RotateCw className="h-3.5 w-3.5" /> Reissued in range</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.reissuedCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Members certified</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totals.uniqueMembers}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Top programme</CardTitle></CardHeader><CardContent><div className="text-sm font-semibold truncate">{totals.topProg}</div><div className="text-xs text-muted-foreground">{totals.topCount} certs</div></CardContent></Card>
      </div>

      <Tabs defaultValue="certificates">
        <TabsList>
          <TabsTrigger value="certificates">By Certificate</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="programmes">By Programme</TabsTrigger>
        </TabsList>

        <TabsContent value="certificates" className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={exportCertsCSV} disabled={!filteredCerts.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <PrintReportButton buildRows={buildCertsPrint} label="Print" />
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Cert No</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>First Issued</TableHead>
                    <TableHead>Last Reissued</TableHead>
                    <TableHead className="text-center">Reissues</TableHead>
                    <TableHead>Issued By</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
                  {!loading && filteredCerts.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No certificates match the filters.</TableCell></TableRow>
                  )}
                  {filteredCerts.map((c) => {
                    const stats = reissueStats.get(c.certificate_number) || {};
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.members?.first_name} {c.members?.last_name}</TableCell>
                        <TableCell>{c.training_type}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{c.certificate_number}</Badge></TableCell>
                        <TableCell>{c.completion_date ? format(parseISO(c.completion_date), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell>{stats.firstIssuedAt ? format(parseISO(stats.firstIssuedAt), "dd MMM yyyy") : (c.created_at ? format(parseISO(c.created_at), "dd MMM yyyy") : "—")}</TableCell>
                        <TableCell>{stats.lastReissuedAt ? format(parseISO(stats.lastReissuedAt), "dd MMM yyyy") : "—"}</TableCell>
                        <TableCell className="text-center">
                          {stats.reissued ? <Badge>{stats.reissued}</Badge> : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{issuerMap.get(c.issued_by) || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(c)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={exportActivityCSV} disabled={!filteredAudit.length}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <PrintReportButton buildRows={buildActivityPrint} label="Print" />
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Cert No</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
                  {!loading && filteredAudit.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No activity in this range.</TableCell></TableRow>
                  )}
                  {filteredAudit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{format(parseISO(a.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell>
                        {a.action === "certificate_reissued"
                          ? <Badge variant="secondary"><RotateCw className="h-3 w-3 mr-1" /> Reissued</Badge>
                          : <Badge><Award className="h-3 w-3 mr-1" /> Issued</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{certMemberMap.get(a.details?.certificate_number) || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{a.details?.certificate_number || "—"}</Badge></TableCell>
                      <TableCell>{a.details?.training_type || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{issuerMap.get(a.user_id) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programmes" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Distribution</CardTitle></CardHeader>
            <CardContent>
              {byProgramme.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 text-sm">No data.</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byProgramme}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="programme" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="issued" fill="hsl(var(--primary))" name="Issued" />
                      <Bar dataKey="reissued" fill="hsl(var(--accent))" name="Reissued" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Reissued</TableHead>
                    <TableHead className="text-right">Unique Members</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProgramme.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No data.</TableCell></TableRow>
                  )}
                  {byProgramme.map((r) => (
                    <TableRow key={r.programme}>
                      <TableCell className="font-medium">{r.programme}</TableCell>
                      <TableCell className="text-right">{r.issued}</TableCell>
                      <TableCell className="text-right">{r.reissued}</TableCell>
                      <TableCell className="text-right">{r.uniqueMembers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
