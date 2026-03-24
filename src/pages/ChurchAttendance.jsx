import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { Loader2, Plus, Users, Church, Baby, UserCheck, Paperclip, FileText, Printer, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAppSetting } from "@/hooks/useAppSetting";
import ReportAttachments from "@/components/reports/ReportAttachments";
import { useSubFeature } from "@/hooks/useSubFeature";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PrintReportButton from "@/components/PrintReportButton";

const DEFAULT_SERVICE_TYPES = ["Sunday Service", "Midweek Service", "Special Program", "Thanksgiving Service", "Other"];

const emptyForm = {
  service_type: "Sunday Service",
  service_date: format(new Date(), "yyyy-MM-dd"),
  title: "",
  adult_male: "",
  adult_female: "",
  children: "",
  teens: "",
  notes: "",
};

export default function ChurchAttendance() {
  const { data: SERVICE_TYPES } = useAppSetting("service_types", DEFAULT_SERVICE_TYPES);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const { user, isAdmin, isUnitLeader } = useAuth();
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { enabled: canRecordAttendance } = useSubFeature("church_attendance.record");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["church-attendance-reports", filterType],
    queryFn: async () => {
      let q = supabase
        .from("church_attendance_reports")
        .select("*")
        .order("service_date", { ascending: false });
      if (filterType !== "all") q = q.eq("service_type", filterType);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from("church_attendance_reports").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-attendance-reports"] });
      toast({ title: "Attendance report saved" });
      setForm(emptyForm);
      setOpen(false);
    },
    onError: (err) => toast({ title: "Error saving report", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.service_date) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    const adultMale = parseInt(form.adult_male) || 0;
    const adultFemale = parseInt(form.adult_female) || 0;
    const children = parseInt(form.children) || 0;
    const teens = parseInt(form.teens) || 0;
    saveMutation.mutate({
      service_type: form.service_type,
      service_date: form.service_date,
      title: form.title || null,
      adult_male: adultMale,
      adult_female: adultFemale,
      children,
      teens,
      total_attendance: adultMale + adultFemale + children + teens,
      notes: form.notes || null,
      recorded_by: user?.id,
    });
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const totalFromForm =
    (parseInt(form.adult_male) || 0) +
    (parseInt(form.adult_female) || 0) +
    (parseInt(form.children) || 0) +
    (parseInt(form.teens) || 0);

  // Client-side date filtering
  const filteredReports = reports.filter(r =>
    (!dateFrom || r.service_date >= dateFrom) && (!dateTo || r.service_date <= dateTo)
  );

  // Summary stats
  const totalServices = filteredReports.length;
  const totalAttendance = filteredReports.reduce((s, r) => s + r.total_attendance, 0);
  const totalAdultMale = filteredReports.reduce((s, r) => s + r.adult_male, 0);
  const totalAdultFemale = filteredReports.reduce((s, r) => s + r.adult_female, 0);
  const totalChildren = filteredReports.reduce((s, r) => s + r.children, 0);
  const totalTeens = filteredReports.reduce((s, r) => s + r.teens, 0);

  // Chart data — sorted chronologically, last 20 services
  const chartData = useMemo(() => {
    const sorted = [...filteredReports].sort((a, b) => a.service_date.localeCompare(b.service_date));
    return sorted.slice(-20).map(r => ({
      date: format(parseISO(r.service_date), "dd MMM"),
      "Adult Male": r.adult_male,
      "Adult Female": r.adult_female,
      "Children": r.children,
      "Teens": r.teens,
      "Total": r.total_attendance,
    }));
  }, [filteredReports]);

  const downloadCSV = () => {
    const headers = ["Date", "Service Type", "Title", "Adult Male", "Adult Female", "Children", "Teens", "Total", "Notes"];
    const rows = filteredReports.map(r => [
      r.service_date, r.service_type, r.title || "", r.adult_male, r.adult_female, r.children, r.teens, r.total_attendance, r.notes || ""
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "church-attendance-report.csv";
    a.click();
  };

  const buildPrintRows = () => ({
    title: "Church Attendance Report",
    headers: ["Date", "Service Type", "Title", "Adult M", "Adult F", "Children", "Teens", "Total"],
    rows: filteredReports.map(r => [
      format(parseISO(r.service_date), "dd MMM yyyy"), r.service_type, r.title || "—",
      r.adult_male, r.adult_female, r.children, r.teens, r.total_attendance
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
            <Church className="h-5 w-5 text-primary" /> Church Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record and track total church service attendance</p>
        </div>
        {canRecordAttendance && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Record Attendance</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Church Attendance</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Service Type</Label>
                  <Select value={form.service_type} onValueChange={(v) => set("service_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.service_date} onChange={(e) => set("service_date", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Title (optional)</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 1st Service, Shiloh Day 2" />
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Attendance Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Adult Male</Label>
                    <Input type="number" min="0" value={form.adult_male} onChange={(e) => set("adult_male", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Adult Female</Label>
                    <Input type="number" min="0" value={form.adult_female} onChange={(e) => set("adult_female", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Children</Label>
                    <Input type="number" min="0" value={form.children} onChange={(e) => set("children", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Teens</Label>
                    <Input type="number" min="0" value={form.teens} onChange={(e) => set("teens", e.target.value)} />
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Total Attendance</Label>
                    <span className="text-lg font-bold text-primary">{totalFromForm}</span>
                  </div>
                </div>
              </div>

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{totalServices}</p><p className="text-xs text-muted-foreground">Services</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{totalAttendance}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{totalAdultMale}</p><p className="text-xs text-muted-foreground">Adult Male</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{totalAdultFemale}</p><p className="text-xs text-muted-foreground">Adult Female</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-orange-500">{totalChildren}</p><p className="text-xs text-muted-foreground">Children</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-violet-500">{totalTeens}</p><p className="text-xs text-muted-foreground">Teens</p></CardContent></Card>
      </div>

      {/* Attendance Trend Chart */}
      {chartData.length >= 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Attendance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Adult Male" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Adult Female" fill="hsl(var(--accent))" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Children" fill="hsl(30, 90%, 55%)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Teens" fill="hsl(270, 60%, 55%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-display">Attendance Records</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {(isAdmin || isUnitLeader) && (
                <>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {SERVICE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" placeholder="From" />
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" placeholder="To" />
                  {filteredReports.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={downloadCSV}>
                        <FileText className="h-4 w-4 mr-1" /> Download
                      </Button>
                      <PrintReportButton buildRows={buildPrintRows} label="Print" />
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No church attendance reports found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-center">Adult M</TableHead>
                    <TableHead className="text-center">Adult F</TableHead>
                    <TableHead className="text-center">Children</TableHead>
                    <TableHead className="text-center">Teens</TableHead>
                     <TableHead className="text-center">Total</TableHead>
                     <TableHead className="w-10"></TableHead>
                   </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((r) => (
                    <React.Fragment key={r.id}>
                      <TableRow>
                        <TableCell className="text-sm">{format(parseISO(r.service_date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{r.service_type}</Badge>
                          {r.title && <span className="block text-xs text-muted-foreground mt-0.5">{r.title}</span>}
                        </TableCell>
                        <TableCell className="text-center">{r.adult_male}</TableCell>
                        <TableCell className="text-center">{r.adult_female}</TableCell>
                        <TableCell className="text-center">{r.children}</TableCell>
                        <TableCell className="text-center">{r.teens}</TableCell>
                        <TableCell className="text-center font-semibold">{r.total_attendance}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                            <Paperclip className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRow === r.id && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/20 p-3">
                            <ReportAttachments relatedTable="church_attendance_reports" relatedId={r.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
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
