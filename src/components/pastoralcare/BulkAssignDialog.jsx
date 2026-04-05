import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck, Loader2, AlertCircle } from "lucide-react";

const statusColors = {
  Open: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-slate-100 text-slate-500",
};
const priorityDot = {
  Low: "bg-slate-400",
  Medium: "bg-amber-400",
  High: "bg-orange-500",
  Urgent: "bg-red-600",
};

export default function BulkAssignDialog({ open, onOpenChange, records, onAssign }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [leaderName, setLeaderName] = useState("");
  const [saving, setSaving] = useState(false);

  // Derive existing leader list from records
  const existingLeaders = useMemo(() => {
    const names = [...new Set(records.map((r) => r.assigned_leader).filter(Boolean))].sort();
    return names;
  }, [records]);

  const filtered = records.filter((r) => {
    const matchSearch = `${r.member_name} ${r.title} ${r.assigned_leader || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!leaderName.trim() || selectedIds.size === 0) return;
    setSaving(true);
    await onAssign([...selectedIds], leaderName.trim());
    setSaving(false);
    setSelectedIds(new Set());
    setLeaderName("");
    onOpenChange(false);
  };

  const handleOpenChange = (v) => {
    if (!v) { setSelectedIds(new Set()); setSearch(""); setStatusFilter("all"); setLeaderName(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <TenantDialogHeader>
            <UserCheck className="h-5 w-5 text-[#1e3a5f]" /> Bulk Assign Requests
          </TenantDialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
          {/* Assign to */}
          <div className="space-y-2">
            <Label>Assign selected requests to</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type leader / pastor name..."
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                className="flex-1"
              />
              {existingLeaders.length > 0 && (
                <Select onValueChange={(v) => setLeaderName(v)}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Pick existing" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingLeaders.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Select all row */}
          <div className="flex items-center justify-between px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-slate-500">Select all ({filtered.length})</span>
            </label>
            {selectedIds.size > 0 && (
              <Badge className="bg-[#1e3a5f] text-white text-xs">{selectedIds.size} selected</Badge>
            )}
          </div>

          {/* Records list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-72">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No records match your filters</p>
            ) : (
              filtered.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedIds.has(r.id)
                      ? "border-[#1e3a5f]/30 bg-blue-50"
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={() => toggleOne(r.id)}
                  />
                  <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[r.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{r.member_name}</p>
                    <p className="text-xs text-slate-400 truncate">{r.title}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[r.status]}`}>
                      {r.status}
                    </span>
                    {r.assigned_leader ? (
                      <span className="text-[10px] text-slate-400 max-w-[80px] truncate">{r.assigned_leader}</span>
                    ) : (
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" /> Unassigned
                      </span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleAssign}
            disabled={saving || selectedIds.size === 0 || !leaderName.trim()}
            className="bg-[#1e3a5f] hover:bg-[#152d4a]"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign {selectedIds.size > 0 ? `${selectedIds.size} Request${selectedIds.size > 1 ? "s" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}