import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, AlertTriangle } from "lucide-react";

const MILESTONES = [
  { label: "BFC", key: "bfc_completed" },
  { label: "BCC", key: "bcc_completed" },
  { label: "LCC", key: "lcc_completed" },
  { label: "LDC", key: "ldc_completed" },
  { label: "Water Baptism", key: "water_baptism" },
  { label: "HS Baptism", key: "holy_spirit_baptism" },
  { label: "Home Cell", key: "winners_satellite" },
];

export default function TrainingGapReport({ members = [] }) {
  const [selectedMilestones, setSelectedMilestones] = useState(["bfc_completed"]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");

  const units = useMemo(() => {
    const set = new Set();
    members.forEach(m => {
      if (m.church_unit) m.church_unit.split(",").map(u => u.trim()).filter(Boolean).forEach(u => set.add(u));
    });
    return [...set].sort();
  }, [members]);

  const toggleMilestone = (key) => {
    setSelectedMilestones(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const filteredMembers = useMemo(() => {
    if (selectedMilestones.length === 0) return [];
    return members.filter(m => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (unitFilter !== "all") {
        const memberUnits = (m.church_unit || "").split(",").map(u => u.trim());
        if (!memberUnits.includes(unitFilter)) return false;
      }
      return selectedMilestones.some(key => !m[key]);
    });
  }, [members, selectedMilestones, statusFilter, unitFilter]);

  const summaryCards = useMemo(() => {
    const base = members.filter(m => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (unitFilter !== "all") {
        const memberUnits = (m.church_unit || "").split(",").map(u => u.trim());
        if (!memberUnits.includes(unitFilter)) return false;
      }
      return true;
    });
    return MILESTONES.map(ms => ({
      ...ms,
      count: base.filter(m => !m[ms.key]).length,
      total: base.length,
    }));
  }, [members, statusFilter, unitFilter]);

  const getMissingLabels = (member) => {
    return MILESTONES
      .filter(ms => selectedMilestones.includes(ms.key) && !member[ms.key])
      .map(ms => ms.label);
  };

  const downloadCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["First Name", "Last Name", "Email", "Phone", "Status", "Church Unit", "Missing Milestones"].join(","),
      ...filteredMembers.map(m =>
        [esc(m.first_name), esc(m.last_name), esc(m.email), esc(m.phone), esc(m.membership_status), esc(m.church_unit), esc(getMissingLabels(m).join("; "))].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training-gap-report.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Select milestones to check</p>
            <div className="flex flex-wrap gap-2">
              {MILESTONES.map(ms => (
                <Badge
                  key={ms.key}
                  variant={selectedMilestones.includes(ms.key) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                  onClick={() => toggleMilestone(ms.key)}
                >
                  {ms.label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="New Convert">New Convert</SelectItem>
                <SelectItem value="First Timer">First Timer</SelectItem>
                <SelectItem value="Visitor">Visitor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.filter(c => selectedMilestones.includes(c.key)).map(c => (
          <Card key={c.key} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-display font-bold text-destructive">{c.count}</p>
              <p className="text-xs text-muted-foreground">Missing {c.label}</p>
              <p className="text-[10px] text-muted-foreground">of {c.total}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""} found</span>
            </div>
            {filteredMembers.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadCSV}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            )}
          </div>

          {selectedMilestones.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
              Select at least one milestone above
            </div>
          ) : filteredMembers.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">All members have completed the selected milestones 🎉</p>
          ) : (
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead>Missing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.slice(0, 200).map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-xs">{m.first_name} {m.last_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{m.phone || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs">{m.membership_status}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getMissingLabels(m).map(label => (
                            <Badge key={label} variant="outline" className="text-[10px] text-destructive border-destructive/30">{label}</Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredMembers.length > 200 && (
                <p className="text-xs text-muted-foreground text-center mt-2">Showing first 200 of {filteredMembers.length}. Download CSV for full list.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
