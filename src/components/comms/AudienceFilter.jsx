import React, { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Users, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useChurchUnits } from "@/hooks/useChurchUnits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "First Timer", label: "First Timer" },
  { value: "Inactive", label: "Inactive" },
  { value: "New Convert", label: "New Convert" },
  { value: "Visitor", label: "Visitor" },
];

const ACCOUNT_OPTIONS = [
  { value: "all", label: "All Accounts" },
  { value: "linked", label: "Linked" },
  { value: "unlinked", label: "Unlinked" },
];

export default function AudienceFilter({ filters, onChange, className, restrictedUnits }) {
  const { status = "all", unit = "all", dateFrom = null, dateTo = null, account = "all", gender = "all", wsfCentreId = "all" } = filters || {};
  const { data: churchUnits = [] } = useChurchUnits();

  // When restrictedUnits is provided, only show those units
  const availableUnits = restrictedUnits && restrictedUnits.length > 0
    ? churchUnits.filter(u => restrictedUnits.includes(u.name))
    : churchUnits;
  const showAllUnitsOption = !restrictedUnits || restrictedUnits.length === 0;
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: wsfCentres = [] } = useQuery({
    queryKey: ["audience-wsf-centres", tenantId],
    queryFn: async () => {
      const { data } = await scopeQuery(
        supabase.from("wsf_centres").select("id, name").eq("is_active", true).order("name")
      );
      return data || [];
    },
    enabled: !!tenantId,
  });

  const update = (patch) => onChange({ status, unit, dateFrom, dateTo, account, gender, wsfCentreId, ...patch });

  const hasFilters = status !== "all" || unit !== "all" || dateFrom || dateTo || account !== "all" || gender !== "all" || wsfCentreId !== "all";

  const clearAll = () => onChange({ status: "all", unit: "all", dateFrom: null, dateTo: null, account: "all", gender: "all", wsfCentreId: "all" });

  // Live recipient count
  const { data: recipientCount = null, isFetching } = useQuery({
    queryKey: ["audience-count", status, unit, dateFrom?.toISOString(), dateTo?.toISOString(), account, gender, wsfCentreId, tenantId],
    queryFn: async () => {
      let q = supabase.from("members").select("id", { count: "exact", head: true });
      if (status !== "all") q = q.eq("membership_status", status);
      if (unit !== "all") q = q.ilike("church_unit", `%${unit}%`);
      if (gender !== "all") q = q.eq("gender", gender);
      if (wsfCentreId !== "all") q = q.eq("wsf_centre_id", wsfCentreId);
      if (dateFrom) q = q.gte("created_at", dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (account === "linked") q = q.not("user_id", "is", null);
      if (account === "unlinked") q = q.is("user_id", null);
      const { count, error } = await scopeQuery(q);
      if (error) throw error;
      return count;
    },
    enabled: !!tenantId,
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Audience Filters
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearAll}>
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
        {recipientCount !== null && (
          <Badge className="bg-primary/10 text-primary border-0 ml-auto">
            {isFetching ? "..." : recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => update({ status: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unit */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Church Unit</label>
          <Select value={unit} onValueChange={(v) => update({ unit: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={showAllUnitsOption ? "All Units" : "Select Unit"} />
            </SelectTrigger>
            <SelectContent>
              {showAllUnitsOption && <SelectItem value="all">All Units</SelectItem>}
              {availableUnits.map((u) => (
                <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
              ))}
            </SelectContent>
        </Select>
        </div>

        {/* Account */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Account</label>
          <Select value={account} onValueChange={(v) => update({ account: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_OPTIONS.map((a) => (
                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sex */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sex</label>
          <Select value={gender} onValueChange={(v) => update({ gender: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Home Cell */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Home Cell</label>
          <Select value={wsfCentreId} onValueChange={(v) => update({ wsfCentreId: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Home Cells" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Home Cells</SelectItem>
              {wsfCentres.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


        {/* Date From */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Registered From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full h-9 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                {dateFrom ? format(dateFrom, "dd MMM yyyy") : "Any date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => update({ dateFrom: d || null })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Registered To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full h-9 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                {dateTo ? format(dateTo, "dd MMM yyyy") : "Any date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => update({ dateTo: d || null })}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
