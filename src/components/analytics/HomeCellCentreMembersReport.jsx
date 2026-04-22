import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Download, Home, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PrintReportButton from "@/components/PrintReportButton";
import { format } from "date-fns";

const STATUS_OPTIONS = ["all", "Active", "Inactive", "First Timer", "New Convert", "Visitor"];
const UNASSIGNED_KEY = "__unassigned__";
const UNASSIGNED_LABEL = "Unassigned (Home Cell members without a centre)";

export default function HomeCellCentreMembersReport() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const [centreFilter, setCentreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: centres = [], isLoading: loadingCentres } = useQuery({
    queryKey: ["hc-centre-members-centres", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("wsf_centres")
          .select("id, name, location, leader_id, is_active")
          .order("name")
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const leaderIds = useMemo(
    () => [...new Set(centres.map((c) => c.leader_id).filter(Boolean))],
    [centres]
  );

  const { data: leaders = [] } = useQuery({
    queryKey: ["hc-centre-leaders", tenantId, leaderIds],
    queryFn: async () => {
      if (leaderIds.length === 0) return [];
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, first_name, last_name")
          .in("id", leaderIds)
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && leaderIds.length > 0,
  });

  const leaderMap = useMemo(() => {
    const map = {};
    leaders.forEach((l) => {
      map[l.id] = `${l.first_name || ""} ${l.last_name || ""}`.trim();
    });
    return map;
  }, [leaders]);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["hc-centre-members", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select(
            "id, first_name, last_name, email, phone, gender, membership_status, church_unit, wsf_centre_id, winners_satellite, created_at"
          )
          .order("last_name")
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Group members by centre id (or UNASSIGNED_KEY for HC members without a centre)
  const groups = useMemo(() => {
    const map = {};
    centres.forEach((c) => {
      map[c.id] = { centre: c, members: [] };
    });
    map[UNASSIGNED_KEY] = { centre: null, members: [] };

    members.forEach((m) => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return;
      if (m.wsf_centre_id && map[m.wsf_centre_id]) {
        map[m.wsf_centre_id].members.push(m);
      } else if (m.winners_satellite) {
        map[UNASSIGNED_KEY].members.push(m);
      }
    });

    let entries = Object.entries(map).map(([id, g]) => ({
      id,
      name: g.centre ? g.centre.name : UNASSIGNED_LABEL,
      leader: g.centre ? leaderMap[g.centre.leader_id] || "" : "",
      members: g.members,
    }));

    if (centreFilter !== "all") {
      entries = entries.filter((g) => g.id === centreFilter);
    } else {
      entries = entries.filter((g) => g.members.length > 0);
    }

    entries.sort((a, b) => {
      if (a.id === UNASSIGNED_KEY) return 1;
      if (b.id === UNASSIGNED_KEY) return -1;
      return a.name.localeCompare(b.name);
    });

    return entries;
  }, [centres, members, leaderMap, centreFilter, statusFilter]);

  const totalMembers = useMemo(
    () => groups.reduce((sum, g) => sum + g.members.length, 0),
    [groups]
  );

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Centre",
      "Centre Leader",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Gender",
      "Status",
      "Church Unit",
      "Joined",
    ];
    const rows = [];
    groups.forEach((g) => {
      g.members.forEach((m) => {
        rows.push(
          [
            esc(g.name),
            esc(g.leader),
            esc(m.first_name || ""),
            esc(m.last_name || ""),
            esc(m.email || ""),
            esc(m.phone || ""),
            esc(m.gender || ""),
            esc(m.membership_status || ""),
            esc(m.church_unit || ""),
            esc(m.created_at ? format(new Date(m.created_at), "yyyy-MM-dd") : ""),
          ].join(",")
        );
      });
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `home-cell-centre-members-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const buildPrintRows = () => {
    const rows = [];
    groups.forEach((g) => {
      g.members.forEach((m) => {
        rows.push([
          g.name,
          g.leader || "—",
          `${m.first_name || ""} ${m.last_name || ""}`.trim(),
          m.membership_status || "",
          m.email || "",
          m.phone || "",
        ]);
      });
    });
    return {
      title: `Home Cell Centre Members${centreFilter !== "all" ? " (filtered)" : ""}`,
      headers: ["Centre", "Leader", "Name", "Status", "Email", "Phone"],
      rows,
    };
  };

  const loading = loadingCentres || loadingMembers;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Home className="h-4 w-4 text-accent" /> Home Cell Centre Members
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Browse and download the membership roster for each Home Cell centre.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Centre</p>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                {centres.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                <SelectItem value={UNASSIGNED_KEY}>Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All Statuses" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {totalMembers} member{totalMembers !== 1 ? "s" : ""} across {groups.length} centre
            {groups.length !== 1 ? "s" : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={totalMembers === 0}
            >
              <Download className="h-4 w-4 mr-2" /> Export Centre Members CSV
            </Button>
            <PrintReportButton buildRows={buildPrintRows} label="Print" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No Home Cell centres or members match the current filters.
          </p>
        ) : (
          <Accordion type="multiple" className="border rounded-lg divide-y">
            {groups.map((g) => (
              <AccordionItem key={g.id} value={g.id} className="border-0">
                <AccordionTrigger className="px-3 hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <span className="text-sm font-medium">{g.name}</span>
                    {g.leader && (
                      <span className="text-[11px] text-muted-foreground">
                        · Leader: {g.leader}
                      </span>
                    )}
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {g.members.length} member{g.members.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  {g.members.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No members assigned to this centre.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {g.members.map((m) => (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {m.first_name} {m.last_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {m.email || m.phone || "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {m.membership_status || "—"}
                            </Badge>
                            {m.church_unit && (
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                {m.church_unit}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
