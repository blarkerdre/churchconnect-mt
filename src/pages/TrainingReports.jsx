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
import { Loader2, Plus, Droplets, Flame, BookOpen, Users, TrendingUp, Paperclip } from "lucide-react";
import { useAppSetting } from "@/hooks/useAppSetting";
import ReportAttachments from "@/components/reports/ReportAttachments";

const ICON_MAP = {
  "Water Baptism": { icon: Droplets, color: "text-blue-500" },
  "Holy Spirit Baptism": { icon: Flame, color: "text-orange-500" },
  "BFC": { icon: BookOpen, color: "text-cyan-500" },
  "WIT": { icon: BookOpen, color: "text-emerald-500" },
  "BCC": { icon: BookOpen, color: "text-teal-500" },
  "LCC": { icon: BookOpen, color: "text-indigo-500" },
  "LDC": { icon: BookOpen, color: "text-rose-500" },
};

const DEFAULT_TRAINING_TYPES = ["Water Baptism", "Holy Spirit Baptism", "BFC", "WIT", "BCC", "LCC", "LDC"];

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
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["training-reports", filterType],
    queryFn: async () => {
      let q = supabase
        .from("training_reports")
        .select("*")
        .order("session_date", { ascending: false });
      if (filterType !== "all") q = q.eq("training_type", filterType);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from("training_reports").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["training-reports"] });
      toast({ title: "Report saved successfully" });
      setForm(emptyForm);
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

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Training & Programme Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Record attendance and outcomes for church growth programmes</p>
        </div>
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
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TRAINING_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => {
                    const cfg = getTypeConfig(r.training_type);
                    return (
                      <TableRow key={r.id}>
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
                      </TableRow>
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
