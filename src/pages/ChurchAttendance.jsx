import React, { useState } from "react";
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
import { Loader2, Plus, Users, Church, Baby, UserCheck } from "lucide-react";

const SERVICE_TYPES = [
  "Sunday Service",
  "Midweek Service",
  "Special Program",
  "Thanksgiving Service",
  "Other",
];

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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const { user } = useAuth();
  const qc = useQueryClient();

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

  // Summary stats
  const totalServices = reports.length;
  const totalAttendance = reports.reduce((s, r) => s + r.total_attendance, 0);
  const totalAdultMale = reports.reduce((s, r) => s + r.adult_male, 0);
  const totalAdultFemale = reports.reduce((s, r) => s + r.adult_female, 0);
  const totalChildren = reports.reduce((s, r) => s + r.children, 0);
  const totalTeens = reports.reduce((s, r) => s + r.teens, 0);

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

      {/* Filter + Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-display">Attendance Records</CardTitle>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {SERVICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No church attendance reports recorded yet</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
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
