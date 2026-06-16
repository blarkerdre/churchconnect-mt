import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Plus, Pencil, Trash2, Search, Upload, Users, Loader2 } from "lucide-react";
import { z } from "zod";

const contactSchema = z.object({
  first_name: z.string().trim().max(80).optional().or(z.literal("")),
  last_name: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  tags: z.string().trim().max(500).optional().or(z.literal("")),
}).refine(v => (v.email && v.email.length) || (v.phone && v.phone.length), {
  message: "Email or phone is required",
  path: ["email"],
});

function parseTags(s) {
  if (!s) return [];
  return s.split(",").map(t => t.trim()).filter(Boolean);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (n) => headers.indexOf(n);
  const i = {
    first: idx("first_name") >= 0 ? idx("first_name") : idx("first"),
    last: idx("last_name") >= 0 ? idx("last_name") : idx("last"),
    email: idx("email"),
    phone: idx("phone"),
    tags: idx("tags"),
    notes: idx("notes"),
  };
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = lines[li].split(",").map(c => c.trim());
    rows.push({
      first_name: i.first >= 0 ? cols[i.first] || null : null,
      last_name: i.last >= 0 ? cols[i.last] || null : null,
      email: i.email >= 0 ? (cols[i.email] || null) : null,
      phone: i.phone >= 0 ? (cols[i.phone] || null) : null,
      tags: i.tags >= 0 ? parseTags(cols[i.tags]) : [],
      notes: i.notes >= 0 ? cols[i.notes] || null : null,
      source: "csv",
    });
  }
  return rows.filter(r => r.email || r.phone);
}

export default function ContactsManager() {
  const { user } = useAuth();
  const { tenantId, withTenant } = useTenantQuery();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", tags: "", notes: "" });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      `${c.first_name || ""} ${c.last_name || ""} ${c.email || ""} ${c.phone || ""} ${(c.tags || []).join(" ")}`
        .toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const openNew = () => {
    setEditing(null);
    setForm({ first_name: "", last_name: "", email: "", phone: "", tags: "", notes: "" });
    setEditOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      first_name: c.first_name || "",
      last_name: c.last_name || "",
      email: c.email || "",
      phone: c.phone || "",
      tags: (c.tags || []).join(", "),
      notes: c.notes || "",
    });
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = contactSchema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Invalid contact");
      }
      const payload = {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email ? form.email.trim().toLowerCase() : null,
        phone: form.phone || null,
        tags: parseTags(form.tags),
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("contacts").update(payload).eq("id", editing.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contacts").insert(withTenant({ ...payload, created_by: user?.id, source: "manual" }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: editing ? "Contact updated" : "Contact added" });
      setEditOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const importCsv = async (file) => {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast({ title: "No valid rows found", description: "Need at least email or phone per row.", variant: "destructive" });
        return;
      }
      const payload = rows.map(r => withTenant({ ...r, created_by: user?.id }));
      const { error } = await supabase.from("contacts").upsert(payload, { onConflict: "tenant_id,email", ignoreDuplicates: true });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast({ title: "Contacts imported", description: `${rows.length} rows processed.` });
    } catch (e) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { importCsv(f); e.target.value = ""; } }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button size="sm" onClick={openNew} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Add Contact
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No contacts yet. Add one or import a CSV (columns: first_name,last_name,email,phone,tags,notes).</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {(c.first_name || c.last_name) ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : (c.email || c.phone)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.email, c.phone].filter(Boolean).join(" • ")}
                  </p>
                  {(c.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Delete this contact?")) deleteMutation.mutate(c.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <TenantDialogHeader>
            <Users className="h-5 w-5 text-primary" />
            {editing ? "Edit Contact" : "Add Contact"}
          </TenantDialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="First name" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              <Input placeholder="Last name" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
            <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Phone (E.164, e.g. +44...)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input placeholder="Tags (comma separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            <Textarea placeholder="Notes" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} maxLength={2000} />
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save" : "Add Contact"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
