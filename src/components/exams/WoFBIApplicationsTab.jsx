import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search, Download, Eye, CheckCircle2, XCircle } from "lucide-react";

const STATUS_VARIANT = {
  submitted: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default function WoFBIApplicationsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);

  const { data: form } = useQuery({
    queryKey: ["wofbi-application-form-fields", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wofbi_application_forms")
        .select("fields, title")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data;
    },
  });

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["wofbi-applications", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("wofbi_applications")
          .select("*, course:exam_titles(id, name), member:members(id, first_name, last_name)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const { error } = await supabase
        .from("wofbi_applications")
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wofbi-applications", tenantId] });
      toast({ title: "Application updated" });
      setDetail(null);
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return applications;
    return applications.filter((a) => {
      return (
        `${a.first_name} ${a.last_name}`.toLowerCase().includes(s) ||
        (a.email || "").toLowerCase().includes(s) ||
        (a.course?.name || "").toLowerCase().includes(s) ||
        (a.status || "").toLowerCase().includes(s)
      );
    });
  }, [applications, q]);

  const exportCsv = () => {
    const fields = form?.fields || [];
    const headers = [
      "Submitted",
      "First name",
      "Last name",
      "Email",
      "Phone",
      "Course",
      "Status",
      ...fields.filter((f) => f.type !== "section_heading").map((f) => f.label),
    ];
    const rows = filtered.map((a) => [
      new Date(a.created_at).toISOString(),
      a.first_name,
      a.last_name,
      a.email,
      a.phone || "",
      a.course?.name || "",
      a.status,
      ...fields.filter((f) => f.type !== "section_heading").map((f) => {
        const v = a.answers?.[f.id];
        if (v === true) return "Yes";
        if (v === false) return "No";
        return v ?? "";
      }),
    ]);
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bible-school-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const answerFields = (form?.fields || []).filter((f) => f.type !== "section_heading");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Bible School Applications ({applications.length})</CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, course, status" className="pl-8" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{a.first_name} {a.last_name}</TableCell>
                    <TableCell className="text-xs">{a.email}</TableCell>
                    <TableCell className="text-xs">{a.course?.name || "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status]} className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetail(a)} className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application — {detail?.first_name} {detail?.last_name}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              Submitted {detail && new Date(detail.created_at).toLocaleString()} · {detail?.email} · Course: {detail?.course?.name || "—"}
            </p>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status:</span>
                <Badge variant={STATUS_VARIANT[detail.status]} className="capitalize">{detail.status}</Badge>
              </div>
              <div className="border rounded-md divide-y">
                {(form?.fields || []).map((f) => {
                  if (f.type === "section_heading") {
                    return (
                      <div key={f.id} className="p-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-primary">
                        {f.label}
                      </div>
                    );
                  }
                  const v = detail.answers?.[f.id];
                  const display = v === true ? "Yes" : v === false ? "No" : (v ?? "—");
                  return (
                    <div key={f.id} className="p-2 grid grid-cols-3 gap-2 text-sm">
                      <div className="text-muted-foreground col-span-1">{f.label}</div>
                      <div className="col-span-2 whitespace-pre-wrap break-words">{display || "—"}</div>
                    </div>
                  );
                })}
                {answerFields.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">No detailed answers captured.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {detail?.status !== "approved" && (
              <Button className="gap-1.5" onClick={() => updateStatus.mutate({ id: detail.id, status: "approved" })}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {detail?.status !== "rejected" && (
              <Button variant="destructive" className="gap-1.5" onClick={() => updateStatus.mutate({ id: detail.id, status: "rejected" })}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
