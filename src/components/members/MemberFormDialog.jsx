import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info, Shield, ShieldCheck, UserCog, Globe, User, Link2, Unlink2, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { suggestClosestWSFCentre } from "@/lib/wsf-suggest";
import { normalizePhone } from "@/lib/phone-utils";
import { useChurchUnits } from "@/hooks/useChurchUnits";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";

const STATUSES = ["Active", "Inactive", "New Convert", "First Timer"];
const GENDERS = ["Male", "Female"];

const emptyMember = {
  first_name: "", last_name: "", email: "", phone: "", address: "",
  date_of_birth: "", gender: "", membership_status: "Active",
  church_unit: "", notes: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  city: "Cardiff", postcode: "",
  water_baptism: false, holy_spirit_baptism: false,
  winners_satellite: false, wsf_centre_id: "", workers_in_training: false,
  bfc_completed: false, bcc_completed: false, lcc_completed: false, ldc_completed: false,
  gdpr_consent: false,
};

export default function MemberFormDialog({ open, onOpenChange, member, onSaved }) {
  const { data: churchUnits = [] } = useChurchUnits();
  const CHURCH_UNITS = churchUnits.map(u => u.name);
  const { isAdmin, roles: currentUserRoles, user: currentUser } = useAuth();
  const isSuperAdmin = currentUserRoles.includes("super_admin");
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyMember);
  const [saving, setSaving] = useState(false);

  // Fetch roles for the member being edited (if they have a linked user account)
  const memberUserId = member?.user_id;
  const { data: memberRoles = [] } = useQuery({
    queryKey: ["member-roles", memberUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*").eq("user_id", memberUserId);
      if (error) throw error;
      return data;
    },
    enabled: !!memberUserId && isAdmin,
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, add }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
        await logAudit("role_add", "user_roles", userId, { role, target_name: `${member?.first_name} ${member?.last_name}` });
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
        await logAudit("role_remove", "user_roles", userId, { role, target_name: `${member?.first_name} ${member?.last_name}` });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-roles", memberUserId] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const { data: wsfCentres = [] } = useQuery({
    queryKey: ["wsf-centres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wsf_centres").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      setForm(member ? { ...emptyMember, ...member } : emptyMember);
    }
  }, [member, open]);

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: "First name and last name are required", variant: "destructive" });
      return;
    }
    if (!member && !form.gdpr_consent) {
      toast({ title: "GDPR consent is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        membership_status: form.membership_status,
        church_unit: form.church_unit || null,
        notes: form.notes || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        water_baptism: form.water_baptism,
        holy_spirit_baptism: form.holy_spirit_baptism,
        winners_satellite: form.winners_satellite,
        wsf_centre_id: form.wsf_centre_id || null,
        bfc_completed: form.bfc_completed,
        workers_in_training: form.workers_in_training,
        bcc_completed: form.bcc_completed,
        lcc_completed: form.lcc_completed,
        ldc_completed: form.ldc_completed,
        gdpr_consent: form.gdpr_consent,
        gdpr_consent_date: !member && form.gdpr_consent ? new Date().toISOString() : (member?.gdpr_consent_date || null),
      };

      if (member) {
        const { error } = await supabase.from("members").update(payload).eq("id", member.id);
        if (error) throw error;
        toast({ title: "Member updated" });
      } else {
        const { data: inserted, error } = await supabase.from("members").insert(payload).select().single();
        if (error) throw error;
        toast({ title: "Member registered" });

        // Follow-up is auto-created by database trigger (auto_create_followup)
      }
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  // Auto-suggest WSF centre when address/postcode changes and WSF is enabled
  const autoSuggestWSF = (updatedForm) => {
    if (updatedForm.winners_satellite && (updatedForm.postcode || updatedForm.address || updatedForm.city)) {
      const best = suggestClosestWSFCentre(wsfCentres, updatedForm);
      if (best) {
        setForm(f => ({ ...f, wsf_centre_id: best.id }));
      }
    }
  };

  const SwitchRow = ({ id, label, description, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{member ? "Edit Member" : "Register New Member"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Personal Details */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Last Name *</Label><Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label>Phone</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        <p>Use international format with country code, e.g. <strong>+447888873207</strong></p>
                        <p className="mt-1 text-muted-foreground">UK numbers starting with 0 are auto-converted (07xxx → +447xxx)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+447888873207"
                />
                {form.phone && !normalizePhone(form.phone) && (
                  <p className="text-[11px] text-destructive">Invalid format. Use +country code then number, e.g. +447888873207</p>
                )}
              </div>
              <div className="space-y-1.5 md:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={(e) => { set("address", e.target.value); autoSuggestWSF({ ...form, address: e.target.value }); }} /></div>
              <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => { set("city", e.target.value); autoSuggestWSF({ ...form, city: e.target.value }); }} /></div>
              <div className="space-y-1.5"><Label>Post Code</Label><Input value={form.postcode} onChange={(e) => { set("postcode", e.target.value); autoSuggestWSF({ ...form, postcode: e.target.value }); }} /></div>
              <div className="space-y-1.5"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender || ""} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Membership Status</Label>
                <Select value={form.membership_status} onValueChange={(v) => set("membership_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Church Units (select multiple)</Label>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-background min-h-[40px]">
                  {CHURCH_UNITS.filter(u => u !== "None").map(unit => {
                    const selected = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
                    const isSelected = selected.includes(unit);
                    return (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => {
                          const current = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
                          const updated = isSelected
                            ? current.filter(u => u !== unit)
                            : [...current, unit];
                          set("church_unit", updated.join(", "));
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {unit}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Church Growth Indices */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Growth Indices</h3>
            <div className="space-y-3">
              <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={(v) => set("water_baptism", v)} />
              <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={(v) => set("holy_spirit_baptism", v)} />
              <SwitchRow id="winners_satellite" label="Winners Satellite Fellowship" checked={form.winners_satellite} onChange={(v) => {
                set("winners_satellite", v);
                if (v && !form.wsf_centre_id) {
                  const best = suggestClosestWSFCentre(wsfCentres, form);
                  if (best) set("wsf_centre_id", best.id);
                }
              }} />
              {form.winners_satellite && (
                <div className="space-y-1.5 pl-4">
                  <Label>WSF Centre {form.wsf_centre_id && wsfCentres.find(c => c.id === form.wsf_centre_id) ? <span className="text-xs text-muted-foreground font-normal ml-1">(auto-suggested by location)</span> : null}</Label>
                  <Select value={form.wsf_centre_id || ""} onValueChange={(v) => set("wsf_centre_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select WSF Centre" /></SelectTrigger>
                    <SelectContent>{wsfCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <SwitchRow id="bfc_completed" label="Believers Foundation Class (BFC)" checked={form.bfc_completed} onChange={(v) => set("bfc_completed", v)} />
              <SwitchRow id="workers_in_training" label="Workers in Training (WIT)" checked={form.workers_in_training} onChange={(v) => set("workers_in_training", v)} />
              <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={(v) => set("bcc_completed", v)} />
              <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={(v) => set("lcc_completed", v)} />
              <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={(v) => set("ldc_completed", v)} />
            </div>
          </div>

          {/* User Role Assignment — only for linked members, visible to admins */}
          {member && memberUserId && isAdmin && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">User Roles</h3>
              {(() => {
                const ROLES = ["super_admin", "admin", "unit_leader", "wsf_leader", "member"];
                const roleIcons = { super_admin: ShieldCheck, admin: Shield, unit_leader: UserCog, wsf_leader: Globe, member: User };
                const roleColors = { super_admin: "bg-destructive/10 text-destructive", admin: "bg-primary/10 text-primary", unit_leader: "bg-accent/10 text-accent", wsf_leader: "bg-chart-3/10 text-chart-3", member: "bg-muted text-muted-foreground" };
                const userRoles = memberRoles.map(r => r.role);
                const isOwnAccount = memberUserId === currentUser?.id;
                const hasAdminRole = userRoles.some(r => ["admin", "super_admin"].includes(r));
                const canChange = !isOwnAccount && (isSuperAdmin || (!hasAdminRole && isAdmin));
                const availableRoles = isSuperAdmin ? ROLES : ROLES.filter(r => !["super_admin", "admin"].includes(r));

                return (
                  <div className="space-y-3">
                    {/* Current roles display */}
                    <div className="flex flex-wrap gap-1.5">
                      {userRoles.length === 0 ? (
                        <Badge className="bg-muted text-muted-foreground border-0 gap-1"><User className="h-3 w-3" /> member (default)</Badge>
                      ) : userRoles.map(r => {
                        const RoleIcon = roleIcons[r] || User;
                        return <Badge key={r} className={`${roleColors[r]} border-0 gap-1`}><RoleIcon className="h-3 w-3" />{r.replace("_", " ")}</Badge>;
                      })}
                    </div>
                    {/* Role checkboxes */}
                    {canChange ? (
                      <div className="grid grid-cols-2 gap-2">
                        {availableRoles.map(r => {
                          const hasRole = userRoles.includes(r);
                          return (
                            <label key={r} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg hover:bg-muted/50">
                              <Checkbox
                                checked={hasRole}
                                onCheckedChange={(checked) => {
                                  toggleRoleMutation.mutate({ userId: memberUserId, role: r, add: !!checked });
                                }}
                                disabled={toggleRoleMutation.isPending}
                              />
                              <span className="capitalize">{r.replace("_", " ")}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {isOwnAccount ? "Cannot change your own roles" : "Insufficient permissions to change roles"}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Emergency Contact */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} /></div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>

          {/* GDPR Consent — new registrations only */}
          {!member && (
            <div className={`rounded-xl border p-4 space-y-2 transition-colors ${form.gdpr_consent ? "border-chart-3/30 bg-chart-3/5" : "border-accent/30 bg-accent/5"}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
                <span className="text-sm text-foreground leading-relaxed">
                  I consent to processing my personal data including attendance records in accordance with <strong>UK GDPR</strong>.
                </span>
              </label>
              {!form.gdpr_consent && <p className="text-xs text-accent pl-7">⚠️ Consent is required to complete registration.</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.first_name || !form.last_name || (!member && !form.gdpr_consent)}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {member ? "Update" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
