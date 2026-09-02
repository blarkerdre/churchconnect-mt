import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Globe, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
];


function fmtNumber(n) {
  const v = Number(n || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds || 0)));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function StatCard({ label, value, active }) {
  return (
    <div className={`px-4 py-3 rounded-lg border ${active ? "bg-muted/60 border-primary/40" : "border-transparent"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

/**
 * Visitor & usage analytics.
 * Pass tenantId = null with allowTenantFilter to show platform-wide traffic (super admins).
 */
export default function TrafficPanel({ tenantId = null, allowTenantFilter = false, tenants = [] }) {
  const [range, setRange] = useState("90");
  const [tenantFilter, setTenantFilter] = useState("all");


  const scopeTenantId = allowTenantFilter ? (tenantFilter === "all" ? null : tenantFilter) : tenantId;

  const { from, to } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (Number(range) - 1));
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to: new Date(end.getTime() + 1).toISOString() };
  }, [range]);

  const args = { _tenant_id: scopeTenantId, _from: from, _to: to };
  const keyBase = [scopeTenantId, range];

  const summaryQ = useQuery({
    queryKey: ["traffic-summary", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_summary", args);
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const seriesQ = useQuery({
    queryKey: ["traffic-series", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_series", args);
      if (error) throw error;
      return data || [];
    },
  });

  const locationsQ = useQuery({
    queryKey: ["traffic-locations", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_locations", { ...args, _limit: 15 });
      if (error) throw error;
      return data || [];
    },
  });

  const pagesQ = useQuery({
    queryKey: ["traffic-pages", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_top_pages", { ...args, _limit: 15 });
      if (error) throw error;
      return data || [];
    },
  });

  const countriesQ = useQuery({
    queryKey: ["traffic-countries", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_countries", { ...args, _limit: 10 });
      if (error) throw error;
      return data || [];
    },
  });

  const sourcesQ = useQuery({
    queryKey: ["traffic-sources", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_sources", { ...args, _limit: 10 });
      if (error) throw error;
      return data || [];
    },
  });

  const devicesQ = useQuery({
    queryKey: ["traffic-devices", ...keyBase],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_devices", args);
      if (error) throw error;
      return data || [];
    },
  });

  const byTenantQ = useQuery({
    queryKey: ["traffic-by-tenant", range],
    enabled: allowTenantFilter,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_traffic_by_tenant", { _from: from, _to: to });
      if (error) throw error;
      return data || [];
    },
  });

  const summary = summaryQ.data;
  const chartData = (seriesQ.data || []).map((r) => ({
    day: r.day,
    label: format(parseISO(r.day), "MMM d"),
    visitors: Number(r.visitors || 0),
    views: Number(r.page_views || 0),
  }));

  const countries = useMemo(
    () => (countriesQ.data || []).map((r) => [r.country || "Unknown", Number(r.visitors || 0)]),
    [countriesQ.data],
  );

  const sources = sourcesQ.data || [];
  const devices = devicesQ.data || [];
  const maxSource = Math.max(1, ...sources.map((s) => Number(s.visitors || 0)));
  const maxDevice = Math.max(1, ...devices.map((d) => Number(d.visitors || 0)));

  const maxCountry = countries[0]?.[1] || 1;
  const isLoading = summaryQ.isLoading || seriesQ.isLoading;


  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Traffic &amp; Locations</h3>
          <p className="text-sm text-muted-foreground">
            Anonymous visitor analytics. No IP addresses are stored.
          </p>
        </div>
        <div className="flex gap-2">
          {allowTenantFilter && (
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All churches</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {summaryQ.isError && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          You do not have access to traffic analytics for this scope.
        </CardContent></Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatCard active label="Visitors" value={fmtNumber(summary?.visitors)} />
            <StatCard label="Page views" value={fmtNumber(summary?.page_views)} />
            <StatCard label="Views per visit" value={Number(summary?.views_per_visit || 0).toFixed(2)} />
            <StatCard label="Visit duration" value={fmtDuration(summary?.avg_duration_seconds)} />
            <StatCard label="Bounce rate" value={`${Number(summary?.bounce_rate || 0)}%`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 h-[320px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [value, name === "visitors" ? "Visitors" : "Page views"]}
                />
                <Area type="monotone" dataKey="visitors" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#visitorsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />Countries</CardTitle>
            <CardDescription>Visitors by country</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {countries.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            {countries.map(([country, visitors]) => (
              <div key={country} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{country}</span>
                  <span className="text-muted-foreground">{visitors}</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(visitors / maxCountry) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Top locations</CardTitle>
            <CardDescription>Country and city</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Visitors</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(locationsQ.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No data yet.</TableCell></TableRow>
                  )}
                  {(locationsQ.data || []).map((r, i) => (
                    <TableRow key={`${r.country}-${r.city}-${i}`}>
                      <TableCell className="text-sm">{r.city}, {r.country}</TableCell>
                      <TableCell className="text-right text-sm">{r.visitors}</TableCell>
                      <TableCell className="text-right text-sm">{r.page_views}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top pages</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Visitors</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pagesQ.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No data yet.</TableCell></TableRow>
                  )}
                  {(pagesQ.data || []).map((r, i) => (
                    <TableRow key={`${r.path}-${i}`}>
                      <TableCell className="text-sm font-mono truncate max-w-[220px]">{r.path}</TableCell>
                      <TableCell className="text-right text-sm">{r.visitors}</TableCell>
                      <TableCell className="text-right text-sm">{r.page_views}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {allowTenantFilter && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Usage by church</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Church</TableHead>
                      <TableHead className="text-right">Visitors</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(byTenantQ.data || []).length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-sm text-muted-foreground">No data yet.</TableCell></TableRow>
                    )}
                    {(byTenantQ.data || []).map((r, i) => (
                      <TableRow key={`${r.tenant_id || "none"}-${i}`}>
                        <TableCell className="text-sm">{r.tenant_name}</TableCell>
                        <TableCell className="text-right text-sm">{r.visitors}</TableCell>
                        <TableCell className="text-right text-sm">{r.page_views}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
