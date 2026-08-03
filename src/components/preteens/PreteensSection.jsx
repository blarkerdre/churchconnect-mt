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
import { Plus, Trash2, User, KeyRound, ShieldCheck, ShieldAlert, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";




function PreteenForm({ open, onOpenChange, preteen, memberId, onSaved }) {
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    first_name: preteen?.first_name || "",
    last_name: preteen?.last_name || "",
    date_of_birth: preteen?.date_of_birth || "",
    gender: preteen?.gender || "",
    notes: preteen?.notes || "",
    pin: "",
    clear_pin: false,
    // Default to true for new records so parents actively opt out; keep existing value on edit.
    attendance_consent: preteen?.id ? !!preteen?.attendance_consent : true,
    // Data-processing consent must be explicitly ticked before saving.
    data_processing_consent: preteen?.id ? !!preteen?.data_processing_consent : false,
  }));
  React.useEffect(() => {
    setForm({
      first_name: preteen?.first_name || "",
      last_name: preteen?.last_name || "",
      date_of_birth: preteen?.date_of_birth || "",
      gender: preteen?.gender || "",
      notes: preteen?.notes || "",
      pin: "",
      clear_pin: false,
      attendance_consent: preteen?.id ? !!preteen?.attendance_consent : true,
      data_processing_consent: preteen?.id ? !!preteen?.data_processing_consent : false,
    });
  }, [preteen, open]);


  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name) throw new Error("Name required");
      if (!form.data_processing_consent) throw new Error("Data-processing consent is required to save this preteen");
      if (!form.attendance_consent) throw new Error("Parental consent is required to save this preteen");
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        notes: form.notes || null,
      };
      // Consent transitions (audit trail)
      const prevConsent = !!preteen?.attendance_consent;
      if (form.attendance_consent !== prevConsent) {
        payload.attendance_consent = form.attendance_consent;
        payload.attendance_consent_at = form.attendance_consent ? new Date().toISOString() : null;
        payload.attendance_consent_by = form.attendance_consent ? (user?.id || null) : null;
      }
      const prevDp = !!preteen?.data_processing_consent;
      if (form.data_processing_consent !== prevDp) {
        payload.data_processing_consent = form.data_processing_consent;
        payload.data_processing_consent_at = form.data_processing_consent ? new Date().toISOString() : null;
        payload.data_processing_consent_by = form.data_processing_consent ? (user?.id || null) : null;
      } else if (!preteen?.id) {
        // New record: always stamp the initial consent metadata.
        payload.data_processing_consent = true;
        payload.data_processing_consent_at = new Date().toISOString();
        payload.data_processing_consent_by = user?.id || null;
      }

      if (form.clear_pin) payload.access_pin_hash = null;
      else if (form.pin) {
        if (!/^\d{4,6}$/.test(form.pin)) throw new Error("PIN must be 4-6 digits");
        const { data: hashed, error: hashErr } = await supabase.rpc("crypt_pin", { _pin: form.pin });
        if (hashErr) throw hashErr;
        payload.access_pin_hash = hashed;
      }
      if (preteen?.id) {
        const { error } = await supabase.from("preteens").update(payload).eq("id", preteen.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        payload.primary_guardian_member_id = memberId;
        const { error } = await supabase.from("preteens").insert(withTenant(payload));
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
          <DialogTitle>{preteen?.id ? "Edit preteen" : "Add preteen"}</DialogTitle>
          <DialogDescription>Preteens can check in on premises by scanning the church QR.</DialogDescription>
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
              placeholder={preteen?.id ? "Leave blank to keep current PIN" : "4-6 digits"}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              PIN lets your preteen check in from any phone (e.g. a friend's). Optional — signing in as parent also works.
            </p>
            {preteen?.id && (
              <label className="flex items-center gap-2 mt-2 text-xs">
                <input type="checkbox" checked={form.clear_pin} onChange={(e) => setForm({ ...form, clear_pin: e.target.checked })} />
                Remove PIN
              </label>
            )}
          </div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <div className={`rounded-md border p-3 space-y-1.5 ${form.data_processing_consent ? "border-primary/20 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.data_processing_consent}
                onChange={(e) => setForm({ ...form, data_processing_consent: e.target.checked })}
              />
              <span>
                <span className="font-medium">I am the parent/legal guardian</span> and consent to my preteen's personal data being held and processed for church ministry purposes. <span className="text-destructive">*</span>
              </span>
            </label>
            {preteen?.data_processing_consent && preteen?.data_processing_consent_at && (
              <p className="text-[11px] text-muted-foreground pl-6">
                Consent given on {format(new Date(preteen.data_processing_consent_at), "d MMM yyyy")}. Untick to revoke (you won't be able to save until you re-consent).
              </p>
            )}
            {!form.data_processing_consent && (
              <p className="text-[11px] text-destructive pl-6 font-medium">
                Data-processing consent is required to save this preteen.
              </p>
            )}
          </div>

          <div className={`rounded-md border p-3 space-y-1.5 ${form.attendance_consent ? "border-primary/20 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.attendance_consent}
                onChange={(e) => setForm({ ...form, attendance_consent: e.target.checked })}
              />
              <span>
                <span className="font-medium">I give parental consent</span> for my preteen to check in and out of on-premises Preteens attendance sessions. <span className="text-destructive">*</span>
              </span>
            </label>
            {preteen?.attendance_consent && preteen?.attendance_consent_at && (
              <p className="text-[11px] text-muted-foreground pl-6">
                Consent given on {format(new Date(preteen.attendance_consent_at), "d MMM yyyy")}. Untick to revoke (you won't be able to save until you re-consent).
              </p>
            )}
            {!form.attendance_consent && (
              <p className="text-[11px] text-destructive pl-6 font-medium">
                Parental consent is required to save this preteen.
              </p>
            )}
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.attendance_consent || !form.data_processing_consent}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PreteensSection({ memberId }) {
  const confirmDelete = useConfirmDelete();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editPreteen, setEditPreteen] = useState(null);
  const [deletePreteen, setDeletePreteen] = useState(null);
  const [promotePreteen, setPromotePreteen] = useState(null);

  const { data: preteens = [], refetch } = useQuery({
    queryKey: ["my-preteens", tenantId, memberId],
    enabled: !!tenantId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase.from("preteens").select("*")
        .eq("tenant_id", tenantId)
        .eq("primary_guardian_member_id", memberId)
        .neq("is_active", false)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const removePreteen = useMutation({
    mutationFn: async (t) => {
      const { error } = await supabase.from("preteens").delete().eq("id", t.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Preteen removed"); setDeletePreteen(null); qc.invalidateQueries({ queryKey: ["my-preteens"] }); },
    onError: (e) => toast.error(e.message),
  });

  const promoteToTeen = useMutation({
    mutationFn: async (p) => {
      // Block promotion while the preteen is currently checked in.
      const { count: openCount, error: oErr } = await supabase.from("preteen_attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("preteen_id", p.id).eq("status", "checked_in");
      if (oErr) throw oErr;
      if ((openCount || 0) > 0) throw new Error("Check this preteen out before promoting");

      const teenPayload = {
        tenant_id: tenantId,
        primary_guardian_member_id: p.primary_guardian_member_id || memberId,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth || null,
        gender: p.gender || null,
        notes: p.notes || null,
        attendance_consent: !!p.attendance_consent,
        attendance_consent_at: p.attendance_consent ? (p.attendance_consent_at || new Date().toISOString()) : null,
        data_processing_consent: !!p.data_processing_consent,
        data_processing_consent_at: p.data_processing_consent ? (p.data_processing_consent_at || new Date().toISOString()) : null,
      };
      const { error: tErr } = await supabase.from("teens").insert(teenPayload);
      if (tErr) throw tErr;

      // Keep attendance history: archive if records exist, otherwise delete.
      const { count, error: cErr } = await supabase.from("preteen_attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("preteen_id", p.id);
      if (cErr) throw cErr;
      if ((count || 0) > 0) {
        const { error } = await supabase.from("preteens").update({ is_active: false })
          .eq("id", p.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("preteens").delete()
          .eq("id", p.id).eq("tenant_id", tenantId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Promoted to teen");
      setPromotePreteen(null);
      qc.invalidateQueries({ queryKey: ["my-preteens"] });
      qc.invalidateQueries({ queryKey: ["my-teens"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Preteens</h2>
          <p className="text-xs text-muted-foreground">Ages 10-12. Register your preteens so they can check in on premises.</p>
        </div>
        <Button size="sm" onClick={() => { setEditPreteen(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add preteen
        </Button>
      </div>

      {preteens.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No preteens added yet.</CardContent></Card>
      ) : (
        preteens.map((t) => (
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
              <div className="flex gap-1 flex-wrap justify-end">
                <Button size="sm" variant="outline" onClick={() => { setEditPreteen(t); setOpen(true); }}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => setPromotePreteen(t)}><ArrowUpCircle className="h-4 w-4 mr-1" /> Promote to teen</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeletePreteen(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {memberId && <PreteenForm open={open} onOpenChange={setOpen} preteen={editPreteen} memberId={memberId} onSaved={refetch} />}

      <AlertDialog open={!!deletePreteen} onOpenChange={(o) => !o && setDeletePreteen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletePreteen?.first_name} {deletePreteen?.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>This also removes their attendance records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); removePreteen.mutate(deletePreteen); }}
              disabled={removePreteen.isPending}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!promotePreteen} onOpenChange={(o) => !o && setPromotePreteen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote {promotePreteen?.first_name} {promotePreteen?.last_name} to teen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Teenagers are 13-17 years old. A matching teenager record will be created under your family with consent carried over. You can set an optional check-in PIN afterwards in the Teenagers section.</p>
                <p>The preteen record will then be removed. If they have any preteen attendance history, the record is kept but hidden from My Family so reports stay intact.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); promoteToTeen.mutate(promotePreteen); }}
              disabled={promoteToTeen.isPending}
            >Promote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
