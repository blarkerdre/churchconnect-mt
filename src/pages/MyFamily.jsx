import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Baby, Plus, ShieldCheck, KeyRound, Trash2, UserPlus, Share2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAppSetting } from "@/hooks/useAppSetting";
import HelpButton from "@/components/tour/HelpButton";
import { useTour } from "@/components/tour/TourProvider";
import { useTourCompletion } from "@/hooks/useTourCompletion";

const DEFAULT_AGE_GROUPS = ["Nursery", "Toddler", "Primary", "Pre-Teen"];

function ChildForm({ open, onOpenChange, child, memberId, onSaved }) {
  const { data: ageGroupsSetting } = useAppSetting("children_age_groups", DEFAULT_AGE_GROUPS);
  const AGE_GROUPS = Array.isArray(ageGroupsSetting) && ageGroupsSetting.length ? ageGroupsSetting : DEFAULT_AGE_GROUPS;
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
      };
      if (child?.id) {
        // Preserve the original registering parent on edits by co-parents
        delete payload.primary_guardian_member_id;
        const { error } = await supabase.from("children").update(payload).eq("id", child.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        payload.primary_guardian_member_id = memberId;
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
    enabled: !!child?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_child_guardians", {
        _child_id: child.id,
        _tenant_id: tenantId,
      });
      if (error) { toast.error(error.message); return []; }
      return data || [];
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["member-search", tenantId, search],
    enabled: !!tenantId && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_tenant_members_for_guardian", {
        _tenant_id: tenantId,
        _q: search,
      });
      if (error) { toast.error(error.message); return []; }
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
    onError: (e) => toast.error(e.message),
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
                  <p className="text-sm font-medium">{g.first_name} {g.last_name}</p>
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
  const { user, isAdmin } = useAuth();
  const { isSuperAdmin } = useTenant();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [childOpen, setChildOpen] = useState(false);
  const [editChild, setEditChild] = useState(null);
  const [guardianFor, setGuardianFor] = useState(null);
  const [delegateFor, setDelegateFor] = useState(null);
  const [deleteChild, setDeleteChild] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const tour = useTour();
  const { completed: tourDone } = useTourCompletion("my-family-v1");

  const { data: meMember } = useQuery({
    queryKey: ["me-member-id", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, first_name, last_name").eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle();
      if (error) { console.error("me-member lookup failed", error); throw error; }
      return data;
    },
  });

  const canSeeAll = isSuperAdmin;

  const removeChild = useMutation({
    mutationFn: async (child) => {
      // Preserve Children Church report history: block delete if any check-in records exist.
      const { count, error: cErr } = await supabase.from("child_checkins")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("child_id", child.id);
      if (cErr) throw cErr;
      if ((count || 0) > 0) {
        throw new Error("This child has Children Church check-in records. Please contact an admin to remove them.");
      }
      const { error } = await supabase.from("children").delete().eq("id", child.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Child removed"); setDeleteChild(null); qc.invalidateQueries({ queryKey: ["my-children"] }); },
    onError: (e) => toast.error(e.message),
  });

  const { data: children = [], refetch, error: childrenError } = useQuery({
    queryKey: ["my-children", tenantId, meMember?.id, showAll && canSeeAll],
    enabled: !!tenantId && (!!meMember?.id || (canSeeAll && showAll)),
    queryFn: async () => {
      if (canSeeAll && showAll) {
        const { data, error } = await supabase.from("children").select("*")
          .eq("tenant_id", tenantId).order("first_name");
        if (error) { console.error("all-children load failed", error); toast.error(`Could not load records: ${error.message}`); throw error; }
        return data || [];
      }
      const { data: primary = [], error: pErr } = await supabase.from("children").select("*")
        .eq("tenant_id", tenantId).eq("primary_guardian_member_id", meMember.id);
      if (pErr) { console.error("primary children load failed", pErr); toast.error(`Could not load your children: ${pErr.message}`); throw pErr; }
      const { data: coLinks = [], error: cErr } = await supabase.from("child_guardians")
        .select("child_id")
        .eq("tenant_id", tenantId).eq("member_id", meMember.id).eq("relationship", "Parent");
      if (cErr) console.warn("co-parent links load failed", cErr);
      const coIds = (coLinks || []).map(l => l.child_id).filter(Boolean);
      let co = [];
      if (coIds.length) {
        const { data } = await supabase.from("children").select("*")
          .eq("tenant_id", tenantId).in("id", coIds);
        co = data || [];
      }
      const map = new Map();
      [...(primary || []), ...co].forEach(c => map.set(c.id, c));
      return Array.from(map.values()).sort((a, b) => (a.first_name || "").localeCompare(b.first_name || ""));
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

  React.useEffect(() => {
    if (tourDone === false && meMember) {
      const t = setTimeout(() => tour?.startTour("my-family-v1"), 600);
      return () => clearTimeout(t);
    }
  }, [tourDone, meMember, tour]);

  if (!meMember && !canSeeAll) {
    return <div className="p-4"><Card><CardContent className="p-6 text-sm text-muted-foreground">Your member profile is not linked yet. Please contact an admin.</CardContent></Card></div>;
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Baby className="h-6 w-6 text-primary" /> My Family</h1>
          <p className="text-sm text-muted-foreground">
            {showAll && canSeeAll ? "Browsing all children in this tenant." : "Manage your children and authorised pickup adults."}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <HelpButton tourId="my-family-v1" dataTour="mf-help" />
          {canSeeAll && (
            <Button variant="outline" size="sm" onClick={() => setShowAll(s => !s)}>
              {showAll ? "Show my family" : "Show all tenant records"}
            </Button>
          )}
          {meMember && (
            <Button data-tour="mf-add-child" onClick={() => { setEditChild(null); setChildOpen(true); }} size="sm"><Plus className="h-4 w-4 mr-1" /> Add child</Button>
          )}
        </div>
      </div>

      {childrenError && (
        <Card><CardContent className="p-4 text-sm text-destructive">Could not load records: {childrenError.message}</CardContent></Card>
      )}

      {children.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{showAll && canSeeAll ? "No children registered in this tenant yet." : "No children added yet."}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {children.map((c, idx) => {
            const active = activeCheckins.find(a => a.child_id === c.id);
            const tourAttrs = idx === 0 ? { "data-tour": "mf-child-card" } : {};
            return (
              <Card key={c.id} {...tourAttrs}>
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
                    <Button data-tour={idx === 0 ? "mf-authorised" : undefined} size="sm" variant="outline" onClick={() => setGuardianFor(c)}><ShieldCheck className="h-4 w-4 mr-1" /> Authorised adults</Button>
                    <Button data-tour={idx === 0 ? "mf-onetime" : undefined} size="sm" variant="outline" onClick={() => setDelegateFor(c)}><KeyRound className="h-4 w-4 mr-1" /> One-time code</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (active) { toast.error("Release child from care before deleting"); return; }
                      setDeleteChild(c);
                    }}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {meMember && <ChildForm open={childOpen} onOpenChange={setChildOpen} child={editChild} memberId={meMember.id} onSaved={refetch} />}
      {guardianFor && <GuardianManager open={!!guardianFor} onOpenChange={() => setGuardianFor(null)} child={guardianFor} />}
      {delegateFor && <DelegationDialog open={!!delegateFor} onOpenChange={() => setDelegateFor(null)} child={delegateFor} />}

      <AlertDialog open={!!deleteChild} onOpenChange={(o) => !o && setDeleteChild(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteChild?.first_name} {deleteChild?.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this child's profile, authorised adults, and pickup delegations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); removeChild.mutate(deleteChild); }}
              disabled={removeChild.isPending}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
