import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { format } from "date-fns";
import WSFAttendanceFormDialog from "./WSFAttendanceFormDialog";
import PrintReportButton from "@/components/PrintReportButton";

export default function WSFAttendanceTab({ centres }) {
  const { user, isAdmin } = useAuth();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [filterCentreId, setFilterCentreId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Find centres this user leads (by matching user_id to leader's member record)
  const { data: userMember } = useQuery({
    queryKey: ["my-member-record", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id").eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const ledCentres = centres.filter(c => c.leader_id && userMember?.id && c.leader_id === userMember.id);
  const isWsfLeader = ledCentres.length > 0;
  const canAccess = isAdmin || isWsfLeader;

  // Fetch zones for grouping
  const { data: zones = [] } = useQuery({
    queryKey: ["wsf-zones", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("wsf_zones").select("*").order("name"));
      if (error) throw error;
      return data;
    },
  });
  // Determine which centres to show reports for
  const visibleCentreIds = isAdmin ? centres.map(c => c.id) : ledCentres.map(c => c.id);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["wsf-attendance-reports", tenantId, visibleCentreIds],
    queryFn: async () => {
      if (visibleCentreIds.length === 0) return [];
      const { data, error } = await scopeQuery(supabase
        .from("wsf_attendance_reports")
        .select("*, wsf_centres(name)")
        .in("centre_id", visibleCentreIds)
        .order("meeting_date", { ascending: false }));
      if (error) throw error;
      return data;
    },
    enabled: canAccess,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from("wsf_attendance_reports").update(payload).eq("id", editing.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wsf_attendance_reports").insert(withTenant({ ...payload, reported_by: user?.id }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-attendance-reports"] });
      toast({ title: editing ? "Report updated" : "Attendance recorded" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wsf_attendance_reports").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-attendance-reports"] });
      toast({ title: "Report deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openNew = (centre = null) => {
    setEditing(null);
    // WSF leader with one centre: auto-select
    if (!centre && !isAdmin && ledCentres.length === 1) centre = ledCentres[0];
    setSelectedCentre(centre);
    setDialogOpen(true);
  };

  const openEdit = (report) => {
    setEditing(report);
    const c = centres.find(c => c.id === report.centre_id);
    setSelectedCentre(c || null);
    setDialogOpen(true);
  };

  const filteredReports = reports.filter(r =>
    (filterCentreId === "all" || r.centre_id === filterCentreId) &&
    (!dateFrom || r.meeting_date >= dateFrom) &&
    (!dateTo || r.meeting_date <= dateTo)
  );

  const buildPrintRows = () => ({
    title: "Home Cell Attendance Report",
    headers: ["Date", "Centre", "Male", "Female", "Adults", "Children", "Total", "1st Timers", "Testimonies"],
    rows: filteredReports.map(r => {
      const adults = r.male + r.female;
      const total = adults + r.children;
      return [format(new Date(r.meeting_date), "dd MMM yyyy"), r.wsf_centres?.name || "—", r.male, r.female, adults, r.children, total, r.first_timers, r.testimonies];
    }),
  });

  const downloadReport = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Date","Centre","Male","Female","Adults","Children","Total","First Timers","Testimonies","Notes"].join(","),
      ...filteredReports.map(r => {
        const adults = r.male + r.female;
        const total = adults + r.children;
        return [
          r.meeting_date, esc(r.wsf_centres?.name || ""), r.male, r.female, adults, r.children, total, r.first_timers, r.testimonies, esc(r.notes || "")
        ].join(",");
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `home-cell-attendance-report.csv`;
    a.click();
  };

  if (!canAccess) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          You don't have access to Home Cell attendance reporting.
        </CardContent>
      </Card>
    );
  }

  const availableCentres = isAdmin ? centres : ledCentres;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterCentreId} onValueChange={setFilterCentreId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All centres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Centres</SelectItem>
              {(() => {
                const zonedCentres = availableCentres.filter(c => c.zone_id);
                const unzonedCentres = availableCentres.filter(c => !c.zone_id);
                const usedZones = zones.filter(z => zonedCentres.some(c => c.zone_id === z.id));
                return (
                  <>
                    {usedZones.map(z => (
                      <SelectGroup key={z.id}>
                        <SelectLabel>{z.name}</SelectLabel>
                        {zonedCentres.filter(c => c.zone_id === z.id).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    {unzonedCentres.length > 0 && (
                      <SelectGroup>
                        {usedZones.length > 0 && <SelectLabel>Unassigned</SelectLabel>}
                        {unzonedCentres.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </>
                );
              })()}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          {filteredReports.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <FileText className="h-4 w-4 mr-1" /> Download
              </Button>
              <PrintReportButton buildRows={buildPrintRows} label="Print" />
            </>
          )}
        </div>
        <Button size="lg" className="bg-primary text-primary-foreground shadow-md font-semibold px-6" onClick={() => openNew()}>
          <Plus className="h-5 w-5 mr-2" /> Record Attendance
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filteredReports.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">No attendance reports yet.</CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="text-center">Male</TableHead>
                  <TableHead className="text-center">Female</TableHead>
                  <TableHead className="text-center">Adults</TableHead>
                  <TableHead className="text-center">Children</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">1st Timers</TableHead>
                  <TableHead className="text-center">Testimonies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map(r => {
                  const adults = r.male + r.female;
                  const total = adults + r.children;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{format(new Date(r.meeting_date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{r.wsf_centres?.name || "—"}</TableCell>
                      <TableCell className="text-center">{r.male}</TableCell>
                      <TableCell className="text-center">{r.female}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">{adults}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{r.children}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-primary/10 text-primary border-0 font-mono">{total}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{r.first_timers}</TableCell>
                      <TableCell className="text-center">{r.testimonies}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            if (window.confirm("Delete this report?")) deleteMutation.mutate(r.id);
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <WSFAttendanceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        centre={selectedCentre}
        report={editing}
        onSave={(data) => saveMutation.mutateAsync(data)}
        allCentres={availableCentres}
      />
    </div>
  );
}
