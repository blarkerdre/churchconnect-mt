import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, User, KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";




function TeenForm({ open, onOpenChange, teen, memberId, onSaved }) {
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    first_name: teen?.first_name || "",
    last_name: teen?.last_name || "",
    date_of_birth: teen?.date_of_birth || "",
    gender: teen?.gender || "",
    notes: teen?.notes || "",
    pin: "",
    clear_pin: false,
    attendance_consent: !!teen?.attendance_consent,
  }));
  React.useEffect(() => {
    setForm({
      first_name: teen?.first_name || "",
      last_name: teen?.last_name || "",
      date_of_birth: teen?.date_of_birth || "",
      gender: teen?.gender || "",
      notes: teen?.notes || "",
      pin: "",
      clear_pin: false,
      attendance_consent: !!teen?.attendance_consent,
    });
  }, [teen, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name) throw new Error("Name required");
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        notes: form.notes || null,
      };
      // Consent transitions (audit trail)
      const prevConsent = !!teen?.attendance_consent;
      if (form.attendance_consent !== prevConsent) {
        payload.attendance_consent = form.attendance_consent;
        payload.attendance_consent_at = form.attendance_consent ? new Date().toISOString() : null;
        payload.attendance_consent_by = form.attendance_consent ? (user?.id || null) : null;
      }
      if (form.clear_pin) payload.access_pin_hash = null;
      else if (form.pin) {
        if (!/^\d{4,6}$/.test(form.pin)) throw new Error("PIN must be 4-6 digits");
        const { data: hashed, error: hashErr } = await supabase.rpc("crypt_pin", { _pin: form.pin });
        if (hashErr) throw hashErr;
        payload.access_pin_hash = hashed;
      }
      if (teen?.id) {
        const { error } = await supabase.from("teens").update(payload).eq("id", teen.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        payload.primary_guardian_member_id = memberId;
        const { error } = await supabase.from("teens").insert(withTenant(payload));
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); onSaved?.(); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teen?.id ? "Edit teen" : "Add teen"}</DialogTitle>
          <DialogDescription>Teens can check in on premises by scanning the church QR.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender || ""} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>PIN (optional)</Label>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder={teen?.id ? "Leave blank to keep current PIN" : "4-6 digits"}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              PIN lets your teen check in from any phone (e.g. a friend's). Optional — signing in as parent also works.
            </p>
            {teen?.id && (
              <label className="flex items-center gap-2 mt-2 text-xs">
                <input type="checkbox" checked={form.clear_pin} onChange={(e) => setForm({ ...form, clear_pin: e.target.checked })} />
                Remove PIN
              </label>
            )}
          </div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.attendance_consent}
                onChange={(e) => setForm({ ...form, attendance_consent: e.target.checked })}
              />
              <span>
                <span className="font-medium">I give parental consent</span> for my teen to check in and out of on-premises Teens attendance sessions.
              </span>
            </label>
            {teen?.attendance_consent && teen?.attendance_consent_at && (
              <p className="text-[11px] text-muted-foreground pl-6">
                Consent given on {format(new Date(teen.attendance_consent_at), "d MMM yyyy")}. Untick to revoke.
              </p>
            )}
            {!form.attendance_consent && (
              <p className="text-[11px] text-amber-700 pl-6">
                Without consent, your teen cannot be signed in at any session.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TeensSection({ memberId }) {
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editTeen, setEditTeen] = useState(null);
  const [deleteTeen, setDeleteTeen] = useState(null);

  const { data: teens = [], refetch } = useQuery({
    queryKey: ["my-teens", tenantId, memberId],
    enabled: !!tenantId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase.from("teens").select("*")
        .eq("tenant_id", tenantId)
        .eq("primary_guardian_member_id", memberId)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const removeTeen = useMutation({
    mutationFn: async (t) => {
      const { error } = await supabase.from("teens").delete().eq("id", t.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Teen removed"); setDeleteTeen(null); qc.invalidateQueries({ queryKey: ["my-teens"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Teenagers</h2>
          <p className="text-xs text-muted-foreground">Register your teens so they can check in on premises.</p>
        </div>
        <Button size="sm" onClick={() => { setEditTeen(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add teen
        </Button>
      </div>

      {teens.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No teens added yet.</CardContent></Card>
      ) : (
        teens.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-base font-semibold">{t.first_name} {t.last_name}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {t.gender && <Badge variant="outline" className="text-[10px]">{t.gender}</Badge>}
                  {t.access_pin_hash && (
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                      <KeyRound className="h-3 w-3 mr-1" /> PIN set
                    </Badge>
                  )}
                  {t.attendance_consent ? (
                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Consent given
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                      <ShieldAlert className="h-3 w-3 mr-1" /> Consent needed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setEditTeen(t); setOpen(true); }}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteTeen(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {memberId && <TeenForm open={open} onOpenChange={setOpen} teen={editTeen} memberId={memberId} onSaved={refetch} />}

      <AlertDialog open={!!deleteTeen} onOpenChange={(o) => !o && setDeleteTeen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTeen?.first_name} {deleteTeen?.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>This also removes their attendance records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); removeTeen.mutate(deleteTeen); }}
              disabled={removeTeen.isPending}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
