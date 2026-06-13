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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Baby, Plus, ShieldCheck, KeyRound, Trash2, UserPlus, Share2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AGE_GROUPS = ["Nursery", "Toddler", "Primary", "Pre-Teen"];

function ChildForm({ open, onOpenChange, child, memberId, onSaved }) {
  const { tenantId, withTenant } = useTenantQuery();
  const [form, setForm] = useState(() => child || {
    first_name: "", last_name: "", date_of_birth: "", gender: "", age_group: "",
    allergies: "", medical_notes: "", notes: "",
  });
  React.useEffect(() => {
    setForm(child || { first_name: "", last_name: "", date_of_birth: "", gender: "", age_group: "", allergies: "", medical_notes: "", notes: "" });
  }, [child, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name) throw new Error("Name required");
      const payload = {
        ...form,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        age_group: form.age_group || null,
        primary_guardian_member_id: memberId,
      };
      if (child?.id) {
        const { error } = await supabase.from("children").update(payload).eq("id", child.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("children").insert(withTenant(payload));
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); onSaved?.(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md">
        <DialogHeader>
          <DialogTitle>{child?.id ? "Edit child" : "Add child"}</DialogTitle>
          <DialogDescription>Child profile is private to you and Children Church workers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth || ""} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender || ""} onValueChange={v => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Age group</Label>
            <Select value={form.age_group || ""} onValueChange={v => setForm({ ...form, age_group: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{AGE_GROUPS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Allergies</Label><Input value={form.allergies || ""} onChange={e => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. peanuts" /></div>
          <div><Label>Medical notes</Label><Textarea rows={2} value={form.medical_notes || ""} onChange={e => setForm({ ...form, medical_notes: e.target.value })} /></div>
          <div><Label>Notes for workers</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuardianManager({ open, onOpenChange, child }) {
  const { tenantId, withTenant } = useTenantQuery();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("Family");

  const { data: guardians = [] } = useQuery({
    queryKey: ["child-guardians", child?.id],
    enabled: !!child?.id,
    queryFn: async () => {
      const { data } = await supabase.from("child_guardians")
        .select("*, members:member_id(id, first_name, last_name, email, phone)")
        .eq("child_id", child.id).eq("tenant_id", tenantId);
      return data || [];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["member-search", tenantId, search],
    enabled: !!tenantId && search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name, email")
        .eq("tenant_id", tenantId)
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(8);
      return data || [];
    },
  });

  const addGuardian = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase.from("child_guardians").insert(withTenant({
        child_id: child.id, member_id: memberId, relationship, can_pickup: true,
      }));
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["child-guardians", child.id] }); setSearch(""); toast.success("Authorised adult added"); },
    onError: (e) => toast.error(e.message),
  });

  const removeGuardian = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("child_guardians").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["child-guardians", child.id] }); toast.success("Removed"); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Authorised pickup adults</DialogTitle>
          <DialogDescription>{child?.first_name} {child?.last_name} can only be released to adults on this list.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            {guardians.map(g => (
              <div key={g.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <p className="text-sm font-medium">{g.members?.first_name} {g.members?.last_name}</p>
                  <p className="text-xs text-muted-foreground">{g.relationship}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeGuardian.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {guardians.length === 0 && <p className="text-xs text-muted-foreground">No additional adults yet.</p>}
          </div>
          <div className="border-t pt-3 space-y-2">
            <Label>Add an authorised adult</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Search member by name" value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Parent","Grandparent","Aunt/Uncle","Sibling","Family","Family friend","Other"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {searchResults.map(m => (
                <button key={m.id} className="w-full text-left border rounded p-2 hover:bg-muted text-sm flex justify-between items-center"
                  onClick={() => addGuardian.mutate(m.id)}>
                  <span>{m.first_name} {m.last_name}</span>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DelegationDialog({ open, onOpenChange, child }) {
  const { tenantId, withTenant } = useTenantQuery();
  const [delegateName, setDelegateName] = useState("");
  const [delegatePhone, setDelegatePhone] = useState("");
  const [validOn, setValidOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [issuedCode, setIssuedCode] = useState(null);
  const { profile } = useAuth();

  // Find member_id for current user
  const { data: meMember } = useQuery({
    queryKey: ["me-member", tenantId, profile?.user_id],
    enabled: !!tenantId && !!profile?.user_id,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id").eq("tenant_id", tenantId).eq("user_id", profile.user_id).maybeSingle();
      return data;
    },
  });

  const issue = useMutation({
    mutationFn: async () => {
      if (!delegateName) throw new Error("Delegate name required");
      if (!meMember?.id) throw new Error("Your member profile is not linked");
      // 8-char alphanumeric code
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
      // hash on server via RPC? We use a SHA-256 of code|child_id in DB. Compute same here.
      const enc = new TextEncoder().encode(code.toUpperCase() + "|" + child.id);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
      const expires = new Date(validOn + "T23:59:59");
      const { error } = await supabase.from("child_pickup_delegations").insert(withTenant({
        child_id: child.id,
        issued_by_member_id: meMember.id,
        delegate_name: delegateName,
        delegate_phone: delegatePhone || null,
        code_hash: hash,
        valid_on: validOn,
        expires_at: expires.toISOString(),
      }));
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => { setIssuedCode(code); toast.success("Delegation code created"); },
    onError: (e) => toast.error(e.message),
  });

  const share = async () => {
    const text = `Pickup code for ${child.first_name}: ${issuedCode}. Valid ${validOn}. Show this to Children Church.`;
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast.success("Copied"); }
  };

  React.useEffect(() => { if (!open) { setIssuedCode(null); setDelegateName(""); setDelegatePhone(""); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>One-time pickup code</DialogTitle>
          <DialogDescription>For someone not on the authorised adults list. The code can only be used once.</DialogDescription>
        </DialogHeader>
        {!issuedCode ? (
          <div className="space-y-3">
            <div><Label>Delegate's full name</Label><Input value={delegateName} onChange={e => setDelegateName(e.target.value)} /></div>
            <div><Label>Delegate's phone (optional)</Label><Input value={delegatePhone} onChange={e => setDelegatePhone(e.target.value)} /></div>
            <div><Label>Valid on</Label><Input type="date" value={validOn} onChange={e => setValidOn(e.target.value)} /></div>
            <Button onClick={() => issue.mutate()} disabled={issue.isPending} className="w-full">Generate code</Button>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Share this code with {delegateName}. It expires at end of {validOn}.</p>
            <div className="text-4xl font-display font-bold tracking-widest border-2 border-dashed rounded p-4 select-all">{issuedCode}</div>
            <Button onClick={share} variant="outline" className="w-full"><Share2 className="h-4 w-4 mr-2" /> Share code</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function MyFamily() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [childOpen, setChildOpen] = useState(false);
  const [editChild, setEditChild] = useState(null);
  const [guardianFor, setGuardianFor] = useState(null);
  const [delegateFor, setDelegateFor] = useState(null);

  const { data: meMember } = useQuery({
    queryKey: ["me-member-id", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: children = [], refetch } = useQuery({
    queryKey: ["my-children", tenantId, meMember?.id],
    enabled: !!tenantId && !!meMember?.id,
    queryFn: async () => {
      const { data } = await supabase.from("children").select("*")
        .eq("tenant_id", tenantId).eq("primary_guardian_member_id", meMember.id).order("first_name");
      return data || [];
    },
  });

  const childIds = useMemo(() => children.map(c => c.id), [children]);
  const { data: activeCheckins = [] } = useQuery({
    queryKey: ["active-checkins", tenantId, childIds],
    enabled: !!tenantId && childIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("child_checkins").select("*")
        .eq("tenant_id", tenantId).in("child_id", childIds).eq("status", "checked_in");
      return data || [];
    },
    refetchInterval: 15000,
  });

  if (!meMember) {
    return <div className="p-4"><Card><CardContent className="p-6 text-sm text-muted-foreground">Your member profile is not linked yet. Please contact an admin.</CardContent></Card></div>;
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Baby className="h-6 w-6 text-primary" /> My Family</h1>
          <p className="text-sm text-muted-foreground">Manage your children and authorised pickup adults.</p>
        </div>
        <Button onClick={() => { setEditChild(null); setChildOpen(true); }} size="sm"><Plus className="h-4 w-4 mr-1" /> Add child</Button>
      </div>

      {children.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No children added yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {children.map(c => {
            const active = activeCheckins.find(a => a.child_id === c.id);
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-lg font-semibold">{c.first_name} {c.last_name}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {c.age_group && <Badge variant="outline">{c.age_group}</Badge>}
                        {c.allergies && <Badge variant="destructive" className="text-[10px]">Allergy: {c.allergies}</Badge>}
                      </div>
                    </div>
                    {active && (
                      <Badge className="bg-chart-3 text-white"><Clock className="h-3 w-3 mr-1" /> In care</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditChild(c); setChildOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setGuardianFor(c)}><ShieldCheck className="h-4 w-4 mr-1" /> Authorised adults</Button>
                    <Button size="sm" variant="outline" onClick={() => setDelegateFor(c)}><KeyRound className="h-4 w-4 mr-1" /> One-time code</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ChildForm open={childOpen} onOpenChange={setChildOpen} child={editChild} memberId={meMember.id} onSaved={refetch} />
      {guardianFor && <GuardianManager open={!!guardianFor} onOpenChange={() => setGuardianFor(null)} child={guardianFor} />}
      {delegateFor && <DelegationDialog open={!!delegateFor} onOpenChange={() => setDelegateFor(null)} child={delegateFor} />}
    </div>
  );
}
