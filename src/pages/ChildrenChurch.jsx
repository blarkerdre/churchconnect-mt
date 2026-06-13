import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Baby, Search, LogIn, LogOut, ShieldAlert, Clock, FileBarChart2, Download } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

function CheckInPanel({ tenantId }) {
  const qc = useQueryClient();
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedChildIds, setSelectedChildIds] = useState([]);
  const [issuedPin, setIssuedPin] = useState(null);
  const [issuedFor, setIssuedFor] = useState(null);

  const { data: parents = [] } = useQuery({
    queryKey: ["cc-parent-search", tenantId, parentSearch],
    enabled: !!tenantId && parentSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name, phone, email")
        .eq("tenant_id", tenantId)
        .or(`first_name.ilike.%${parentSearch}%,last_name.ilike.%${parentSearch}%,phone.ilike.%${parentSearch}%`)
        .limit(8);
      return data || [];
    },
  });

  const { data: parentChildren = [] } = useQuery({
    queryKey: ["cc-parent-children", tenantId, selectedParent?.id],
    enabled: !!tenantId && !!selectedParent?.id,
    queryFn: async () => {
      const { data } = await supabase.from("children").select("*")
        .eq("tenant_id", tenantId).eq("primary_guardian_member_id", selectedParent.id).eq("is_active", true);
      return data || [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      if (selectedChildIds.length === 0) throw new Error("Select at least one child");
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      const snapshot = parentChildren.filter(c => selectedChildIds.includes(c.id));
      for (const cid of selectedChildIds) {
        const { error } = await supabase.rpc("checkin_child", {
          _child_id: cid, _pin: pin, _parent_member_id: selectedParent.id,
        });
        if (error) {
          console.error("checkin_child failed", { child_id: cid, error });
          throw new Error(error.message || "Check-in failed");
        }
      }
      return { pin, children: snapshot };
    },
    onSuccess: ({ pin, children }) => {
      setIssuedPin(pin); setIssuedFor(children);
      qc.invalidateQueries({ queryKey: ["cc-in-care"] });
      toast.success("Checked in");
    },
    onError: (e) => toast.error(e.message || "Check-in failed"),
  });


  const reset = () => { setParentSearch(""); setSelectedParent(null); setSelectedChildIds([]); setIssuedPin(null); setIssuedFor(null); };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Drop-off</CardTitle><CardDescription>Find the parent, select the children, give them the PIN.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {issuedPin ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Show this PIN to the parent. Needed for pickup.</p>
            <div className="text-5xl font-display font-bold tracking-widest border-2 border-primary rounded-lg p-6 text-primary">{issuedPin}</div>
            <p className="text-sm">{issuedFor.map(c => `${c.first_name} ${c.last_name}`).join(", ")}</p>
            <Button onClick={reset} className="w-full">Done</Button>
          </div>
        ) : !selectedParent ? (
          <div className="space-y-2">
            <Label>Find parent</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Type parent name or phone..." value={parentSearch} onChange={e => setParentSearch(e.target.value)} />
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {parents.map(p => (
                <button key={p.id} className="w-full text-left border rounded p-2 hover:bg-muted text-sm" onClick={() => setSelectedParent(p)}>
                  <p className="font-medium">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground">{p.phone || p.email}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between border rounded p-2 bg-muted/30">
              <div>
                <p className="text-sm font-medium">{selectedParent.first_name} {selectedParent.last_name}</p>
                <p className="text-xs text-muted-foreground">{selectedParent.phone}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedParent(null); setSelectedChildIds([]); }}>Change</Button>
            </div>
            <Label>Select children</Label>
            {parentChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">No children registered for this parent. Ask them to add via "My Family".</p>
            ) : (
              <div className="space-y-1">
                {parentChildren.map(c => {
                  const checked = selectedChildIds.includes(c.id);
                  return (
                    <button key={c.id} className={`w-full text-left border rounded p-2 flex justify-between items-center ${checked ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => setSelectedChildIds(checked ? selectedChildIds.filter(x => x !== c.id) : [...selectedChildIds, c.id])}>
                      <div>
                        <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                        <div className="flex gap-1 mt-1">
                          {c.age_group && <Badge variant="outline" className="text-[10px]">{c.age_group}</Badge>}
                          {c.allergies && <Badge variant="destructive" className="text-[10px]">⚠ {c.allergies}</Badge>}
                        </div>
                      </div>
                      <input type="checkbox" readOnly checked={checked} className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            )}
            <Button onClick={() => checkIn.mutate()} disabled={selectedChildIds.length === 0 || checkIn.isPending} className="w-full">
              <LogIn className="h-4 w-4 mr-2" /> Check in {selectedChildIds.length || ""}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PickupPanel({ tenantId, isLeader }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [method, setMethod] = useState("pin");
  const [pin, setPin] = useState("");
  const [adultId, setAdultId] = useState("");
  const [delegationCode, setDelegationCode] = useState("");
  const [delegationAdult, setDelegationAdult] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const { data: inCare = [] } = useQuery({
    queryKey: ["cc-in-care", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("child_checkins")
        .select("*, children:child_id(id, first_name, last_name, photo_url, age_group, allergies)")
        .eq("tenant_id", tenantId).eq("status", "checked_in")
        .order("dropoff_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  const { data: guardians = [] } = useQuery({
    queryKey: ["cc-guardians", selected?.child_id],
    enabled: !!selected?.child_id,
    queryFn: async () => {
      const { data } = await supabase.from("child_guardians")
        .select("*, members:member_id(id, first_name, last_name, phone)")
        .eq("child_id", selected.child_id).eq("can_pickup", true);
      return data || [];
    },
  });

  const release = useMutation({
    mutationFn: async () => {
      const args = {
        _checkin_id: selected.id,
        _method: method,
        _pin: method === "pin" ? pin : null,
        _adult_member_id: (method === "pin" || method === "qr") ? adultId : null,
        _delegation_code: method === "delegation_code" ? delegationCode.toUpperCase().trim() : null,
        _override_reason: method === "leader_override" ? overrideReason : null,
        _notes: method === "delegation_code" && delegationAdult ? `Delegate: ${delegationAdult}` : null,
      };
      const { error } = await supabase.rpc("release_child", args);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Child released");
      setSelected(null); setPin(""); setAdultId(""); setDelegationCode(""); setDelegationAdult(""); setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["cc-in-care"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card>
        <CardHeader><CardTitle className="text-base">Currently in care ({inCare.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
          {inCare.length === 0 && <p className="text-sm text-muted-foreground">No children currently checked in.</p>}
          {inCare.map(row => (
            <button key={row.id} className={`w-full text-left border rounded p-2 ${selected?.id === row.id ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setSelected(row)}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{row.children?.first_name} {row.children?.last_name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {row.children?.age_group && <Badge variant="outline" className="text-[10px]">{row.children.age_group}</Badge>}
                    {row.children?.allergies && <Badge variant="destructive" className="text-[10px]">⚠</Badge>}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground"><Clock className="h-3 w-3 inline" /> {formatDistanceToNow(new Date(row.dropoff_at), { addSuffix: false })}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release</CardTitle>
          <CardDescription>{selected ? `Selected: ${selected.children?.first_name} ${selected.children?.last_name}` : "Select a child to release"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Pick a child from the list.</p>
          ) : (
            <>
              <div>
                <Label>Authorised adults</Label>
                <div className="text-xs space-y-0.5 mt-1">
                  {guardians.length === 0 ? <p className="text-muted-foreground">⚠ No authorised adults registered.</p>
                    : guardians.map(g => <p key={g.id}>• {g.members?.first_name} {g.members?.last_name} <span className="text-muted-foreground">({g.relationship || "—"})</span></p>)}
                </div>
              </div>

              <div>
                <Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pin">PIN + authorised adult</SelectItem>
                    <SelectItem value="delegation_code">One-time delegation code</SelectItem>
                    {isLeader && <SelectItem value="leader_override">Leader override (flagged)</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              {method === "pin" && (
                <>
                  <div><Label>6-digit PIN</Label><Input inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,""))} /></div>
                  <div>
                    <Label>Who is collecting?</Label>
                    <Select value={adultId} onValueChange={setAdultId}>
                      <SelectTrigger><SelectValue placeholder="Select adult" /></SelectTrigger>
                      <SelectContent>
                        {guardians.map(g => <SelectItem key={g.member_id} value={g.member_id}>{g.members?.first_name} {g.members?.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {method === "delegation_code" && (
                <>
                  <div><Label>Code</Label><Input value={delegationCode} onChange={e => setDelegationCode(e.target.value)} placeholder="e.g. K7M9XQ" className="tracking-widest uppercase" /></div>
                  <div><Label>Delegate name (for record)</Label><Input value={delegationAdult} onChange={e => setDelegationAdult(e.target.value)} /></div>
                </>
              )}

              {method === "leader_override" && (
                <div><Label>Reason (required)</Label><Textarea rows={3} value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Explain why override is needed..." /></div>
              )}

              <Button onClick={() => release.mutate()} disabled={release.isPending} className="w-full">
                {method === "leader_override" ? <><ShieldAlert className="h-4 w-4 mr-2" /> Override & Release</> : <><LogOut className="h-4 w-4 mr-2" /> Release</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportPanel({ tenantId }) {
  const [from, setFrom] = useState(format(new Date(Date.now() - 30*86400000), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: rows = [] } = useQuery({
    queryKey: ["cc-report", tenantId, from, to],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("child_checkins")
        .select("*, children:child_id(first_name, last_name, age_group)")
        .eq("tenant_id", tenantId)
        .gte("service_date", from).lte("service_date", to)
        .order("service_date", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const picked = rows.filter(r => r.status === "picked_up").length;
    const flagged = rows.filter(r => r.status === "flagged").length;
    const stillIn = rows.filter(r => r.status === "checked_in").length;
    const durations = rows.filter(r => r.pickup_at).map(r => (new Date(r.pickup_at).getTime() - new Date(r.dropoff_at).getTime()) / 60000);
    const avg = durations.length ? Math.round(durations.reduce((s,n) => s+n, 0) / durations.length) : 0;
    const byMethod = rows.reduce((acc, r) => { if (r.pickup_method) acc[r.pickup_method] = (acc[r.pickup_method]||0)+1; return acc; }, {});
    return { total, picked, flagged, stillIn, avg, byMethod };
  }, [rows]);

  const downloadCSV = () => {
    const headers = ["service_date","child","age_group","dropoff_at","pickup_at","pickup_method","status","override_reason"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.service_date,
        `"${r.children?.first_name} ${r.children?.last_name}"`,
        r.children?.age_group || "",
        r.dropoff_at, r.pickup_at || "",
        r.pickup_method || "",
        r.status,
        `"${(r.override_reason || "").replace(/"/g,'""')}"`,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `children-church-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><FileBarChart2 className="h-4 w-4" /> Report</CardTitle>
        <CardDescription>Drop-off and pickup activity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={rows.length === 0}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="border rounded p-3 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-[10px] uppercase text-muted-foreground">Check-ins</p></div>
          <div className="border rounded p-3 text-center"><p className="text-2xl font-bold text-chart-3">{stats.picked}</p><p className="text-[10px] uppercase text-muted-foreground">Picked up</p></div>
          <div className="border rounded p-3 text-center"><p className="text-2xl font-bold text-destructive">{stats.flagged}</p><p className="text-[10px] uppercase text-muted-foreground">Flagged</p></div>
          <div className="border rounded p-3 text-center"><p className="text-2xl font-bold">{stats.avg}m</p><p className="text-[10px] uppercase text-muted-foreground">Avg stay</p></div>
        </div>
        <div className="text-xs flex flex-wrap gap-2">
          {Object.entries(stats.byMethod).map(([k,v]) => <Badge key={k} variant="outline">{k}: {v}</Badge>)}
        </div>
        <div className="border rounded overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Child</th><th className="p-2 text-left">Drop-off</th><th className="p-2 text-left">Pickup</th><th className="p-2 text-left">Method</th><th className="p-2 text-left">Status</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.service_date}</td>
                  <td className="p-2">{r.children?.first_name} {r.children?.last_name}</td>
                  <td className="p-2">{format(new Date(r.dropoff_at), "HH:mm")}</td>
                  <td className="p-2">{r.pickup_at ? format(new Date(r.pickup_at), "HH:mm") : "—"}</td>
                  <td className="p-2">{r.pickup_method || "—"}</td>
                  <td className="p-2"><Badge variant={r.status === "flagged" ? "destructive" : r.status === "picked_up" ? "default" : "outline"}>{r.status}</Badge></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-muted-foreground">No records.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ChildrenChurch() {
  const { tenantId } = useTenantQuery();
  const { user, isAdmin } = useAuth();

  const { data: isLeader = false } = useQuery({
    queryKey: ["is-cc-leader", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_children_church_leader", { _user_id: user.id, _tenant_id: tenantId });
      return !!data;
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Baby className="h-6 w-6 text-primary" /> Children Church</h1>
        <p className="text-sm text-muted-foreground">Secure drop-off and pickup for children in care.</p>
      </div>
      <Tabs defaultValue="checkin">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="checkin">Check-in</TabsTrigger>
          <TabsTrigger value="pickup">Pickup</TabsTrigger>
          {(isLeader || isAdmin) && <TabsTrigger value="report">Report</TabsTrigger>}
        </TabsList>
        <TabsContent value="checkin"><CheckInPanel tenantId={tenantId} /></TabsContent>
        <TabsContent value="pickup"><PickupPanel tenantId={tenantId} isLeader={isLeader || isAdmin} /></TabsContent>
        {(isLeader || isAdmin) && <TabsContent value="report"><ReportPanel tenantId={tenantId} /></TabsContent>}
      </Tabs>
    </div>
  );
}
