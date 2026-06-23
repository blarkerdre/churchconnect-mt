import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Calculator, BarChart3, Package, RefreshCw, Sparkles } from "lucide-react";

const METRICS = [
  { key: "base_infra", label: "Base infrastructure / tenant", unit: "per month" },
  { key: "member", label: "Member record", unit: "per member" },
  { key: "storage_gb", label: "Storage", unit: "per GB" },
  { key: "sms", label: "SMS", unit: "per message" },
  { key: "whatsapp", label: "WhatsApp", unit: "per message" },
  { key: "email", label: "Email", unit: "per message" },
  { key: "ai_call", label: "AI call", unit: "per call" },
];

const emptyPlan = {
  name: "",
  slug: "",
  description: "",
  sort_order: 0,
  is_active: true,
  is_public: false,
  currency: "GBP",
  base_price_monthly: 0,
  base_price_annual: 0,
  setup_fee: 0,
  stripe_product_id: "",
  stripe_price_id_monthly: "",
  stripe_price_id_annual: "",
  included_members: 0,
  included_storage_mb: 0,
  included_sms: 0,
  included_whatsapp: 0,
  included_email: 0,
  included_ai_calls: 0,
  overage_price_member: 0,
  overage_price_storage_gb: 0,
  overage_price_sms: 0,
  overage_price_whatsapp: 0,
  overage_price_email: 0,
  overage_price_ai_call: 0,
  allow_overage_member: false,
  allow_overage_storage: false,
  allow_overage_sms: true,
  allow_overage_whatsapp: true,
  allow_overage_email: true,
  allow_overage_ai: true,
};

function PlansSubTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["pricing_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_plans").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (plan) => {
      const payload = { ...plan };
      if (payload.id) {
        const { id, created_at, updated_at, ...rest } = payload;
        const { error } = await supabase.from("pricing_plans").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, ...rest } = payload;
        const { error } = await supabase.from("pricing_plans").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Plan saved" });
      qc.invalidateQueries({ queryKey: ["pricing_plans"] });
      setEditing(null);
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Plan deleted" });
      qc.invalidateQueries({ queryKey: ["pricing_plans"] });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pricing Plans</h3>
          <p className="text-sm text-muted-foreground">Tier catalog with included quotas and overage prices.</p>
        </div>
        <Button onClick={() => setEditing({ ...emptyPlan })}><Plus className="h-4 w-4 mr-1" />New plan</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Annual</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>SMS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}<div className="text-xs text-muted-foreground">{p.slug}</div></TableCell>
                  <TableCell>{p.currency} {Number(p.base_price_monthly).toFixed(2)}</TableCell>
                  <TableCell>{p.currency} {Number(p.base_price_annual).toFixed(2)}</TableCell>
                  <TableCell>{p.included_members.toLocaleString()}</TableCell>
                  <TableCell>{(p.included_storage_mb / 1024).toFixed(1)} GB</TableCell>
                  <TableCell>{p.included_sms.toLocaleString()}</TableCell>
                  <TableCell>
                    {p.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${p.name}?`)) remove.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No plans yet. Create your first tier.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <PlanEditorDialog plan={editing} onClose={() => setEditing(null)} onSave={(p) => save.mutate(p)} saving={save.isPending} />
      )}
    </div>
  );
}

function PlanEditorDialog({ plan, onClose, onSave, saving }) {
  const [form, setForm] = useState(plan);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (k, v) => set(k, v === "" ? 0 : Number(v));

  const slugFromName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => { set("name", e.target.value); if (!form.id) set("slug", slugFromName(e.target.value)); }} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
            <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} /></div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => num("sort_order", e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} /><Label>Active</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_public} onCheckedChange={(v) => set("is_public", v)} /><Label>Public</Label></div>
          </div>

          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Pricing</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Monthly price</Label><Input type="number" step="0.01" value={form.base_price_monthly} onChange={(e) => num("base_price_monthly", e.target.value)} /></div>
              <div><Label>Annual price</Label><Input type="number" step="0.01" value={form.base_price_annual} onChange={(e) => num("base_price_annual", e.target.value)} /></div>
              <div><Label>Setup fee</Label><Input type="number" step="0.01" value={form.setup_fee} onChange={(e) => num("setup_fee", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div><Label>Stripe product ID</Label><Input value={form.stripe_product_id || ""} onChange={(e) => set("stripe_product_id", e.target.value)} /></div>
              <div><Label>Monthly price ID</Label><Input value={form.stripe_price_id_monthly || ""} onChange={(e) => set("stripe_price_id_monthly", e.target.value)} /></div>
              <div><Label>Annual price ID</Label><Input value={form.stripe_price_id_annual || ""} onChange={(e) => set("stripe_price_id_annual", e.target.value)} /></div>
            </div>
          </div>

          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Included quotas</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Members</Label><Input type="number" value={form.included_members} onChange={(e) => num("included_members", e.target.value)} /></div>
              <div><Label>Storage (MB)</Label><Input type="number" value={form.included_storage_mb} onChange={(e) => num("included_storage_mb", e.target.value)} /></div>
              <div><Label>SMS</Label><Input type="number" value={form.included_sms} onChange={(e) => num("included_sms", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input type="number" value={form.included_whatsapp} onChange={(e) => num("included_whatsapp", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="number" value={form.included_email} onChange={(e) => num("included_email", e.target.value)} /></div>
              <div><Label>AI calls</Label><Input type="number" value={form.included_ai_calls} onChange={(e) => num("included_ai_calls", e.target.value)} /></div>
            </div>
          </div>

          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Overage unit prices ({form.currency})</h4>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Per extra member</Label><Input type="number" step="0.0001" value={form.overage_price_member} onChange={(e) => num("overage_price_member", e.target.value)} /></div>
              <div><Label>Per extra GB</Label><Input type="number" step="0.0001" value={form.overage_price_storage_gb} onChange={(e) => num("overage_price_storage_gb", e.target.value)} /></div>
              <div><Label>Per extra SMS</Label><Input type="number" step="0.0001" value={form.overage_price_sms} onChange={(e) => num("overage_price_sms", e.target.value)} /></div>
              <div><Label>Per extra WhatsApp</Label><Input type="number" step="0.0001" value={form.overage_price_whatsapp} onChange={(e) => num("overage_price_whatsapp", e.target.value)} /></div>
              <div><Label>Per extra Email</Label><Input type="number" step="0.0001" value={form.overage_price_email} onChange={(e) => num("overage_price_email", e.target.value)} /></div>
              <div><Label>Per extra AI call</Label><Input type="number" step="0.0001" value={form.overage_price_ai_call} onChange={(e) => num("overage_price_ai_call", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_member} onCheckedChange={(v) => set("allow_overage_member", v)} /><Label>Allow extra members</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_storage} onCheckedChange={(v) => set("allow_overage_storage", v)} /><Label>Allow extra storage</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_sms} onCheckedChange={(v) => set("allow_overage_sms", v)} /><Label>Allow SMS overage</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_whatsapp} onCheckedChange={(v) => set("allow_overage_whatsapp", v)} /><Label>Allow WhatsApp overage</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_email} onCheckedChange={(v) => set("allow_overage_email", v)} /><Label>Allow Email overage</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.allow_overage_ai} onCheckedChange={(v) => set("allow_overage_ai", v)} /><Label>Allow AI overage</Label></div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !form.name || !form.slug} onClick={() => onSave(form)}>{saving ? "Saving…" : "Save plan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CostsSubTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: costs = [] } = useQuery({
    queryKey: ["pricing_cost_inputs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pricing_cost_inputs").select("*").order("metric");
      if (error) throw error;
      return data;
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["pricing_plans"],
    queryFn: async () => (await supabase.from("pricing_plans").select("*").order("sort_order")).data || [],
  });

  // Latest cost per metric
  const latestByMetric = useMemo(() => {
    const m = {};
    for (const c of costs) {
      if (!m[c.metric] || new Date(c.effective_from) > new Date(m[c.metric].effective_from)) m[c.metric] = c;
    }
    return m;
  }, [costs]);

  const upsert = useMutation({
    mutationFn: async (row) => {
      const { error } = await supabase.from("pricing_cost_inputs").upsert(row, { onConflict: "metric,effective_from" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cost saved" });
      qc.invalidateQueries({ queryKey: ["pricing_cost_inputs"] });
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const [draft, setDraft] = useState({});
  const setField = (metric, k, v) => setDraft((d) => ({ ...d, [metric]: { ...(d[metric] || {}), [k]: v } }));
  const valueFor = (metric, k, fallback) => draft[metric]?.[k] ?? latestByMetric[metric]?.[k] ?? fallback;

  const computeForPlan = (plan) => {
    const cost = (key, qty) => Number(latestByMetric[key]?.unit_cost || 0) * qty;
    const monthlyCost =
      cost("base_infra", 1) +
      cost("member", plan.included_members) +
      cost("storage_gb", plan.included_storage_mb / 1024) +
      cost("sms", plan.included_sms) +
      cost("whatsapp", plan.included_whatsapp) +
      cost("email", plan.included_email) +
      cost("ai_call", plan.included_ai_calls);
    const margin = Number(latestByMetric["base_infra"]?.target_margin_pct || 50);
    const suggested = monthlyCost * (1 + margin / 100);
    return { monthlyCost, suggested, margin };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Unit costs</h3>
        <p className="text-sm text-muted-foreground">Record your real running costs. The calculator uses the most recent effective entry per metric.</p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Unit cost</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Target margin %</TableHead>
              <TableHead>Effective from</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((m) => (
              <TableRow key={m.key}>
                <TableCell className="font-medium">{m.label}<div className="text-xs text-muted-foreground">{m.unit}</div></TableCell>
                <TableCell><Input type="number" step="0.000001" className="w-32" value={valueFor(m.key, "unit_cost", 0)} onChange={(e) => setField(m.key, "unit_cost", e.target.value)} /></TableCell>
                <TableCell><Input className="w-20" value={valueFor(m.key, "currency", "GBP")} onChange={(e) => setField(m.key, "currency", e.target.value.toUpperCase())} /></TableCell>
                <TableCell><Input type="number" step="1" className="w-24" value={valueFor(m.key, "target_margin_pct", 50)} onChange={(e) => setField(m.key, "target_margin_pct", e.target.value)} /></TableCell>
                <TableCell><Input type="date" className="w-40" value={valueFor(m.key, "effective_from", new Date().toISOString().split("T")[0])} onChange={(e) => setField(m.key, "effective_from", e.target.value)} /></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => upsert.mutate({
                    metric: m.key,
                    unit_cost: Number(valueFor(m.key, "unit_cost", 0)),
                    currency: valueFor(m.key, "currency", "GBP"),
                    target_margin_pct: Number(valueFor(m.key, "target_margin_pct", 50)),
                    effective_from: valueFor(m.key, "effective_from", new Date().toISOString().split("T")[0]),
                  })}>Save</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" />Plan margin calculator</h3>
        <p className="text-sm text-muted-foreground">Expected monthly cost at full included quota vs. current sell price.</p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Expected cost</TableHead>
              <TableHead>Current monthly</TableHead>
              <TableHead>Suggested</TableHead>
              <TableHead>Gross margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => {
              const c = computeForPlan(p);
              const sell = Number(p.base_price_monthly);
              const gm = sell > 0 ? ((sell - c.monthlyCost) / sell) * 100 : 0;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.currency} {c.monthlyCost.toFixed(2)}</TableCell>
                  <TableCell>{p.currency} {sell.toFixed(2)}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {p.currency} {c.suggested.toFixed(2)}
                    <Button size="sm" variant="ghost" title="Apply suggested price" onClick={async () => {
                      const { error } = await supabase.from("pricing_plans").update({ base_price_monthly: Number(c.suggested.toFixed(2)) }).eq("id", p.id);
                      if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
                      else { toast({ title: "Price updated" }); qc.invalidateQueries({ queryKey: ["pricing_plans"] }); }
                    }}><Sparkles className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                  <TableCell><Badge variant={gm < 20 ? "destructive" : gm < 40 ? "secondary" : "default"}>{gm.toFixed(0)}%</Badge></TableCell>
                </TableRow>
              );
            })}
            {plans.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Create a plan first.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UsageSubTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tenant_usage_overview"],
    queryFn: async () => {
      const [tenants, plans, counters, overage] = await Promise.all([
        supabase.from("tenants").select("id, name, pricing_plan_id, plan_tier"),
        supabase.from("pricing_plans").select("*"),
        supabase.from("tenant_usage_counters").select("*"),
        supabase.from("tenant_overage_charges").select("tenant_id, amount, status").eq("status", "pending"),
      ]);
      const planMap = Object.fromEntries((plans.data || []).map((p) => [p.id, p]));
      const periodNow = new Date().toISOString().slice(0, 7);
      return (tenants.data || []).map((t) => {
        const plan = planMap[t.pricing_plan_id];
        const myCounters = (counters.data || []).filter((c) => c.tenant_id === t.id && c.period_start.startsWith(periodNow));
        const pendingOverage = (overage.data || []).filter((o) => o.tenant_id === t.id).reduce((s, o) => s + Number(o.amount || 0), 0);
        const usage = {};
        for (const c of myCounters) usage[c.metric] = c;
        return { tenant: t, plan, usage, pendingOverage };
      });
    },
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke("aggregate-tenant-usage", { body: {} });
      if (error) throw error;
      toast({ title: "Usage refreshed" });
      qc.invalidateQueries({ queryKey: ["tenant_usage_overview"] });
    } catch (e) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Live usage & margin</h3>
          <p className="text-sm text-muted-foreground">Current month usage vs included quota per tenant.</p>
        </div>
        <Button onClick={refresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>SMS</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pending overage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No tenants.</TableCell></TableRow>
            ) : rows.map(({ tenant, plan, usage, pendingOverage }) => {
              const cell = (key) => {
                const u = usage[key];
                if (!u) return <span className="text-muted-foreground text-xs">—</span>;
                const pct = u.included > 0 ? (u.used / u.included) * 100 : 0;
                return <span className={pct > 100 ? "text-destructive font-medium" : ""}>{Number(u.used).toLocaleString()} / {Number(u.included).toLocaleString()}</span>;
              };
              return (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">{tenant.name}</TableCell>
                  <TableCell>{plan?.name || <Badge variant="secondary">{tenant.plan_tier || "none"}</Badge>}</TableCell>
                  <TableCell>{cell("member")}</TableCell>
                  <TableCell>{cell("storage_gb")}</TableCell>
                  <TableCell>{cell("sms")}</TableCell>
                  <TableCell>{cell("email")}</TableCell>
                  <TableCell>{pendingOverage > 0 ? <Badge variant="destructive">{(plan?.currency || "GBP")} {pendingOverage.toFixed(2)}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PricingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Pricing & Costing</CardTitle>
        <CardDescription>Manage plan tiers, unit costs, and live usage across all tenants.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans"><Package className="h-3.5 w-3.5 mr-1" />Plans</TabsTrigger>
            <TabsTrigger value="costs"><Calculator className="h-3.5 w-3.5 mr-1" />Costs</TabsTrigger>
            <TabsTrigger value="usage"><BarChart3 className="h-3.5 w-3.5 mr-1" />Usage</TabsTrigger>
          </TabsList>
          <TabsContent value="plans" className="mt-4"><PlansSubTab /></TabsContent>
          <TabsContent value="costs" className="mt-4"><CostsSubTab /></TabsContent>
          <TabsContent value="usage" className="mt-4"><UsageSubTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
