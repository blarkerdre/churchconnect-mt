import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Download, Mail, Phone, MoreVertical, Edit, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const INITIAL_MEMBERS = [
  { id: 1, first_name: "Sarah", last_name: "Johnson", email: "sarah@email.com", phone: "07911234567", membership_status: "Active", gender: "Female", church_units: ["Choir", "Women's Ministry"], water_baptism: true, bfc_completed: true, join_date: "2022-03-15" },
  { id: 2, first_name: "David", last_name: "Obi", email: "david.obi@email.com", phone: "07922345678", membership_status: "Active", gender: "Male", church_units: ["Youth Ministry", "Media"], water_baptism: true, bfc_completed: false, join_date: "2023-01-10" },
  { id: 3, first_name: "Grace", last_name: "Eze", email: "grace.eze@email.com", phone: "07933456789", membership_status: "Active", gender: "Female", church_units: ["Pastoral Care"], water_baptism: true, bfc_completed: true, join_date: "2021-06-20" },
  { id: 4, first_name: "James", last_name: "Adeyemi", email: "james.a@email.com", phone: "07944567890", membership_status: "Active", gender: "Male", church_units: ["Ushering", "Evangelism"], water_baptism: false, bfc_completed: false, join_date: "2024-01-05" },
  { id: 5, first_name: "Mary", last_name: "Williams", email: "mary.w@email.com", phone: "07955678901", membership_status: "New Convert", gender: "Female", church_units: [], water_baptism: false, bfc_completed: false, join_date: "2024-11-20" },
  { id: 6, first_name: "Emmanuel", last_name: "Okoro", email: "emmanuel.o@email.com", phone: "07966789012", membership_status: "Active", gender: "Male", church_units: ["Men's Ministry", "Follow-up"], water_baptism: true, bfc_completed: true, join_date: "2020-09-12" },
  { id: 7, first_name: "Ruth", last_name: "Bakare", email: "ruth.b@email.com", phone: "07977890123", membership_status: "Inactive", gender: "Female", church_units: ["Children's Ministry"], water_baptism: true, bfc_completed: true, join_date: "2019-04-08" },
  { id: 8, first_name: "Peter", last_name: "Nnamdi", email: "peter.n@email.com", phone: "07988901234", membership_status: "First Timer", gender: "Male", church_units: [], water_baptism: false, bfc_completed: false, join_date: "2025-03-01" },
];

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
};

export default function Members() {
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState({});

  const filtered = members.filter((m) => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.email} ${m.phone}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.membership_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditingMember(null);
    setForm({ first_name: "", last_name: "", email: "", phone: "", membership_status: "Active", gender: "Male", church_units: [] });
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditingMember(m);
    setForm({ ...m });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingMember) {
      setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...form } : m));
    } else {
      setMembers(prev => [...prev, { ...form, id: Date.now(), join_date: new Date().toISOString().split("T")[0] }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this member?")) {
      setMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleDownloadCSV = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Status", "Gender", "Units", "Join Date"];
    const rows = filtered.map(m => [m.first_name, m.last_name, m.email, m.phone, m.membership_status, m.gender, (m.church_units || []).join("; "), m.join_date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "members.csv";
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="New Convert">New Convert</SelectItem>
              <SelectItem value="First Timer">First Timer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Register Member
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{members.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{members.filter(m => m.membership_status === "Active").length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{members.filter(m => m.membership_status === "New Convert").length}</p><p className="text-xs text-muted-foreground">New Converts</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-4">{members.filter(m => m.membership_status === "First Timer").length}</p><p className="text-xs text-muted-foreground">First Timers</p></CardContent></Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Contact</th>
                <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Units</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {m.email}</span>
                      <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {m.phone}</span>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(m.church_units || []).map(u => (
                        <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>
                      ))}
                      {(!m.church_units || m.church_units.length === 0) && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={`${statusColors[m.membership_status] || "bg-muted text-muted-foreground"} border-0`}>
                      {m.membership_status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(m.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingMember ? "Edit Member" : "Register Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.first_name || ""} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><Label>Last Name</Label><Input value={form.last_name || ""} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gender</Label>
                <Select value={form.gender || "Male"} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.membership_status || "Active"} onValueChange={v => setForm(f => ({ ...f, membership_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="New Convert">New Convert</SelectItem>
                    <SelectItem value="First Timer">First Timer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-primary">{editingMember ? "Save Changes" : "Register"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
