import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import {
  Package, Plus, ShieldCheck, AlertTriangle, History,
  Pencil, Trash2, Tag,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import InventoryItemDialog from "@/components/inventory/InventoryItemDialog";
import InspectionDialog from "@/components/inventory/InspectionDialog";
import InspectionHistoryDialog from "@/components/inventory/InspectionHistoryDialog";
import PrintReportButton from "@/components/PrintReportButton";
import { logAudit } from "@/lib/audit";

const conditionColor = {
  good: "bg-chart-3/10 text-chart-3",
  fair: "bg-accent/10 text-accent",
  poor: "bg-chart-5/10 text-chart-5",
  out_of_service: "bg-destructive/10 text-destructive",
};

function dueStatus(item) {
  if (!item.requires_inspection) return null;
  if (!item.next_due_at) return { label: "Not scheduled", tone: "bg-muted text-muted-foreground" };
  const due = new Date(item.next_due_at);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / 86400000);
  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "bg-destructive/10 text-destructive" };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, tone: "bg-accent/10 text-accent" };
  return { label: `Due ${format(due, "dd MMM yyyy")}`, tone: "bg-chart-3/10 text-chart-3" };
}

export default function Inventory() {
  const { tenantId, withTenant } = useTenantQuery();
  const { tenantSlug } = useParams();
  const queryClient = useQueryClient();

  const { isMemberOfUnit: isOfficeMember, isLoading: officeLoading } = useUnitMembership("Church Office");
  const { isAdmin, isSuperAdmin, leaderUnits = [] } = useAuth();

  const isOfficeLeader = leaderUnits.some((u) => String(u).toLowerCase() === "church office");
  const canAccess = isAdmin || isSuperAdmin || isOfficeMember || isOfficeLeader;
  const canManage = isAdmin || isSuperAdmin || isOfficeLeader;

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ["inv-categories", tenantId],
    enabled: !!tenantId && canAccess,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_categories")
        .select("*").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Items
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["inv-items", tenantId],
    enabled: !!tenantId && canManage,
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items")
        .select("*").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && i.category_id !== categoryFilter) return false;
      if (!s) return true;
      return (i.name || "").toLowerCase().includes(s)
        || (i.location || "").toLowerCase().includes(s)
        || (i.serial_number || "").toLowerCase().includes(s);
    });
  }, [items, search, categoryFilter]);

  const dueItems = useMemo(() => {
    return items
      .filter((i) => i.requires_inspection)
      .sort((a, b) => {
        const da = a.next_due_at ? new Date(a.next_due_at).getTime() : Infinity;
        const db = b.next_due_at ? new Date(b.next_due_at).getTime() : Infinity;
        return da - db;
      });
  }, [items]);

  // Dialog state
  const [itemDialog, setItemDialog] = useState({ open: false, item: null });
  const [inspectDialog, setInspectDialog] = useState({ open: false, item: null });
  const [historyDialog, setHistoryDialog] = useState({ open: false, item: null });
  const [catDialog, setCatDialog] = useState({ open: false, cat: null });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["inv-items", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["inv-categories", tenantId] });
  };

  const handleDeleteItem = async (item) => {
    if (!confirm(`Delete "${item.name}"? This also removes its inspection history.`)) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id).eq("tenant_id", tenantId);
    if (error) { toast.error(error.message); return; }
    await logAudit("inventory.item_deleted", "inventory_items", item.id, { name: item.name }, tenantId);
    toast.success("Item deleted");
    refresh();
  };

  if (officeLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!canManage) {
    return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" /> Inventory
          </h1>
          <p className="text-sm text-muted-foreground">Manage church assets and health & safety inspections.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setItemDialog({ open: true, item: null })}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
          <TabsTrigger value="due">
            Due Inspections ({dueItems.filter((i) => i.next_due_at && new Date(i.next_due_at) <= new Date()).length})
          </TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* Items */}
        <TabsContent value="items" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {itemsLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filteredItems.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No items yet. Click "Add Item" to begin.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((item) => {
                const cat = categories.find((c) => c.id === item.category_id);
                const due = dueStatus(item);
                return (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {cat?.name || "Uncategorised"}{item.location ? ` · ${item.location}` : ""}
                          </div>
                        </div>
                        <Badge className={conditionColor[item.condition]}>{item.condition.replace("_", " ")}</Badge>
                      </div>

                      {item.serial_number && (
                        <div className="text-xs text-muted-foreground">S/N: {item.serial_number}</div>
                      )}

                      {item.requires_inspection && (
                        <div className="flex flex-wrap gap-2 items-center text-xs">
                          <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> H&S</Badge>
                          {due && <Badge className={due.tone}>{due.label}</Badge>}
                          {item.last_inspected_at && (
                            <span className="text-muted-foreground">Last: {formatDistanceToNowStrict(new Date(item.last_inspected_at), { addSuffix: true })}</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-1 pt-2 border-t flex-wrap">
                        {item.requires_inspection && (
                          <Button size="sm" variant="default" onClick={() => setInspectDialog({ open: true, item })}>
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Inspect
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setHistoryDialog({ open: true, item })}>
                          <History className="h-3.5 w-3.5 mr-1" /> History
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setItemDialog({ open: true, item })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Due */}
        <TabsContent value="due" className="space-y-3">
          {dueItems.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No items require inspection.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {dueItems.map((item) => {
                const due = dueStatus(item);
                const overdue = item.next_due_at && new Date(item.next_due_at) < new Date();
                return (
                  <Card key={item.id} className={overdue ? "border-destructive/40" : ""}>
                    <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        {overdue ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.location || "—"} {due ? `· ${due.label}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setHistoryDialog({ open: true, item })}>History</Button>
                        <Button size="sm" onClick={() => setInspectDialog({ open: true, item })}>
                          <ShieldCheck className="h-4 w-4 mr-1" /> Inspect now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories" className="space-y-3">
          <div>
            <Button size="sm" onClick={() => setCatDialog({ open: true, cat: null })}>
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          </div>
          {categories.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No categories yet.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2"><Tag className="h-4 w-4" /> {c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Default frequency: {c.default_frequency_days ? `${c.default_frequency_days} days` : "—"}
                      </div>
                      {c.description && <div className="text-xs text-muted-foreground mt-1">{c.description}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setCatDialog({ open: true, cat: c })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm(`Delete category "${c.name}"?`)) return;
                        const { error } = await supabase.from("inventory_categories").delete().eq("id", c.id).eq("tenant_id", tenantId);
                        if (error) { toast.error(error.message); return; }
                        toast.success("Category deleted");
                        refresh();
                      }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <InventoryItemDialog
        open={itemDialog.open}
        onOpenChange={(o) => setItemDialog((s) => ({ ...s, open: o }))}
        item={itemDialog.item}
        categories={categories}
        onSaved={refresh}
      />

      <InspectionDialog
        open={inspectDialog.open}
        onOpenChange={(o) => setInspectDialog((s) => ({ ...s, open: o }))}
        item={inspectDialog.item}
        onCompleted={refresh}
      />

      <InspectionHistoryDialog
        open={historyDialog.open}
        onOpenChange={(o) => setHistoryDialog((s) => ({ ...s, open: o }))}
        item={historyDialog.item}
      />

      <CategoryDialog
        open={catDialog.open}
        onOpenChange={(o) => setCatDialog((s) => ({ ...s, open: o }))}
        category={catDialog.cat}
        onSaved={refresh}
      />
    </div>
  );
}

function CategoryDialog({ open, onOpenChange, category, onSaved }) {
  const { tenantId, withTenant } = useTenantQuery();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState("");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name || "");
    setDescription(category?.description || "");
    setFreq(category?.default_frequency_days ?? "");
  }, [open, category]);

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description || null,
        default_frequency_days: freq === "" ? null : parseInt(freq, 10),
      };
      if (category) {
        const { error } = await supabase.from("inventory_categories").update(payload).eq("id", category.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_categories").insert(withTenant(payload));
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error(e.message || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <Tag className="h-4 w-4" />
          {category ? "Edit Category" : "Add Category"}
        </TenantDialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Default inspection frequency (days)</Label>
            <Input type="number" min="1" value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="e.g. 365" />
            <p className="text-xs text-muted-foreground mt-1">Items in this category will inherit this unless overridden.</p>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

