import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Mail, Phone, MapPin, Calendar, CheckCircle2, XCircle, Church, Edit, Save, X, Shield } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { suggestClosestWSFCentre } from "@/lib/wsf-suggest";
import { useChurchUnits } from "@/hooks/useChurchUnits";

const GENDERS = ["Male", "Female"];

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
};

export default function MyProfile() {
  const { user, roles, isAdmin, isUnitLeader, isWSFLeader } = useAuth();
  const { data: churchUnitsData = [] } = useChurchUnits();
  const CHURCH_UNITS = churchUnitsData.map(u => u.name);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const isSuperAdmin = roles.includes("super_admin");
  const getRoleTitle = () => {
    if (isSuperAdmin) return "Super Admin";
    if (isAdmin) return "Admin";
    if (isUnitLeader && isWSFLeader) return "Unit & WSF Leader";
    if (isUnitLeader) return "Unit Leader";
    if (isWSFLeader) return "WSF Leader";
    return "Member";
  };

  const { data: member, isLoading } = useQuery({
    queryKey: ["my-member-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*, wsf_centres!fk_members_wsf_centre(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: wsfCentres = [] } = useQuery({
    queryKey: ["wsf-centres-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wsf_centres").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["my-attendance", member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, attendance_sessions(title, session_date, session_type)")
        .eq("member_id", member.id)
        .order("checked_in_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const { error } = await supabase.rpc("update_own_member_profile", {
        _member_id: member.id,
        _first_name: updates.first_name,
        _last_name: updates.last_name,
        _email: updates.email,
        _phone: updates.phone,
        _address: updates.address,
        _city: updates.city,
        _postcode: updates.postcode,
        _date_of_birth: updates.date_of_birth,
        _gender: updates.gender,
        _emergency_contact_name: updates.emergency_contact_name,
        _emergency_contact_phone: updates.emergency_contact_phone,
        _notes: updates.notes,
        _photo_url: updates.photo_url,
        _membership_status: updates.membership_status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-member-profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-completion"] });
      toast({ title: "Profile updated successfully" });
      setEditing(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startEditing = () => {
    setForm({
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
      city: member.city || "",
      postcode: member.postcode || "",
      date_of_birth: member.date_of_birth || "",
      gender: member.gender || "",
      membership_status: member.membership_status || "Active",
      emergency_contact_name: member.emergency_contact_name || "",
      emergency_contact_phone: member.emergency_contact_phone || "",
      notes: member.notes || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      postcode: form.postcode || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      membership_status: form.membership_status || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      notes: form.notes || null,
      photo_url: member.photo_url || null,
    });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddressChange = (key, value) => {
    const updated = { ...form, [key]: value };
    set(key, value);
    if (form.winners_satellite) {
      const best = suggestClosestWSFCentre(wsfCentres, updated);
      if (best) set("wsf_centre_id", best.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!member) {
    return <CreateMemberProfile user={user} onCreated={() => queryClient.invalidateQueries({ queryKey: ["my-member-profile"] })} wsfCentres={wsfCentres} churchUnits={CHURCH_UNITS} />;
  }

  const units = member.church_unit ? member.church_unit.split(",").map(u => u.trim()).filter(Boolean) : [];

  const BoolBadge = ({ value, label }) => (
    <div className="flex items-center gap-2 text-sm">
      {value ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  const SwitchRow = ({ id, label, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Role Badge */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <Badge variant="outline" className="text-xs font-medium">{getRoleTitle()}</Badge>
        <Badge className={`${statusColors[member.membership_status] || "bg-muted text-muted-foreground"} border-0 text-xs`}>
          {member.membership_status}
        </Badge>
      </div>

      {/* Profile Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                {member.first_name[0]}{member.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-5">
                    {/* Personal Details */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
                        <div className="space-y-1 sm:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => handleAddressChange("address", e.target.value)} /></div>
                        <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => handleAddressChange("city", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Postcode</Label><Input value={form.postcode} onChange={e => handleAddressChange("postcode", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} /></div>
                        <div className="space-y-1">
                          <Label>Gender</Label>
                          <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Church Units */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Units</h3>
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
                                const updated = isSelected ? current.filter(u => u !== unit) : [...current, unit];
                                set("church_unit", updated.join(", "));
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {unit}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Growth Indices */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Growth Indices</h3>
                      <div className="space-y-3">
                        <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
                        <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
                        <SwitchRow id="winners_satellite" label="Winners Satellite Fellowship" checked={form.winners_satellite} onChange={v => {
                          set("winners_satellite", v);
                          if (v && !form.wsf_centre_id) {
                            const best = suggestClosestWSFCentre(wsfCentres, form);
                            if (best) set("wsf_centre_id", best.id);
                          }
                        }} />
                        {form.winners_satellite && (
                          <div className="space-y-1.5 pl-4">
                            <Label>WSF Centre</Label>
                            <Select value={form.wsf_centre_id || ""} onValueChange={v => set("wsf_centre_id", v)}>
                              <SelectTrigger><SelectValue placeholder="Select WSF Centre" /></SelectTrigger>
                              <SelectContent>{wsfCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        )}
                        <SwitchRow id="bfc_completed" label="Believers Foundation Class (BFC)" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
                        <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
                        <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
                        <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
                        {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-foreground">{member.first_name} {member.last_name}</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-muted-foreground">
                      {member.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{member.email}</div>}
                      {member.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{member.phone}</div>}
                      {(member.address || member.city) && (
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{[member.address, member.city, member.postcode].filter(Boolean).join(", ")}</div>
                      )}
                      {member.date_of_birth && (
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />DOB: {format(new Date(member.date_of_birth), "dd MMM yyyy")}</div>
                      )}
                      {member.gender && (
                        <div className="flex items-center gap-2"><User className="h-4 w-4" />{member.gender}</div>
                      )}
                      {member.membership_date && (
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Member since {format(new Date(member.membership_date), "MMM yyyy")}</div>
                      )}
                      {units.length > 0 && (
                        <div className="flex items-center gap-2 sm:col-span-2 flex-wrap">
                          <Church className="h-4 w-4 shrink-0" />
                          {units.map(u => <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>)}
                        </div>
                      )}
                      {member.emergency_contact_name && (
                        <div className="flex items-center gap-2 sm:col-span-2 text-xs">
                          <span className="font-medium text-foreground">Emergency:</span> {member.emergency_contact_name} {member.emergency_contact_phone && `· ${member.emergency_contact_phone}`}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEditing} className="shrink-0">
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Growth Milestones (read-only view) */}
      {!editing && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Growth Milestones</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <BoolBadge value={member.water_baptism} label="Water Baptism" />
              <BoolBadge value={member.holy_spirit_baptism} label="HS Baptism" />
              <BoolBadge value={member.bfc_completed} label="BFC Completed" />
              <BoolBadge value={member.bcc_completed} label="BCC Completed" />
              <BoolBadge value={member.lcc_completed} label="LCC Completed" />
              <BoolBadge value={member.ldc_completed} label="LDC Completed" />
              <BoolBadge value={member.winners_satellite} label="Winners Satellite" />
            </div>
            {member.wsf_centres?.name && (
              <p className="text-sm text-muted-foreground mt-3">WSF Centre: <span className="text-foreground font-medium">{member.wsf_centres.name}</span></p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendance History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent Attendance ({attendanceRecords.length})</CardTitle></CardHeader>
        <CardContent>
          {attendanceRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance records found.</p>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.attendance_sessions?.title || r.attendance_sessions?.session_type || "Service"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.attendance_sessions?.session_date && format(new Date(r.attendance_sessions.session_date), "dd MMM yyyy")}
                      {r.attendance_sessions?.session_type && ` · ${r.attendance_sessions.session_type}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Present</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateMemberProfile({ user, onCreated, wsfCentres, churchUnits }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: user?.email || "", phone: "", address: "",
    city: "Cardiff", postcode: "", date_of_birth: "", gender: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    church_unit: "", notes: "",
    water_baptism: false, holy_spirit_baptism: false, winners_satellite: false,
    wsf_centre_id: "", bfc_completed: false, bcc_completed: false, lcc_completed: false, ldc_completed: false,
    gdpr_consent: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: "First name and last name are required", variant: "destructive" });
      return;
    }
    if (!form.gdpr_consent) {
      toast({ title: "GDPR consent is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("members").insert({
        user_id: user.id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        postcode: form.postcode || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        membership_status: "Active",
        church_unit: form.church_unit || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        water_baptism: form.water_baptism,
        holy_spirit_baptism: form.holy_spirit_baptism,
        winners_satellite: form.winners_satellite,
        wsf_centre_id: form.wsf_centre_id || null,
        bfc_completed: form.bfc_completed,
        bcc_completed: form.bcc_completed,
        lcc_completed: form.lcc_completed,
        ldc_completed: form.ldc_completed,
        gdpr_consent: form.gdpr_consent,
        gdpr_consent_date: new Date().toISOString(),
        notes: form.notes || null,
      });
      if (error) throw error;
      toast({ title: "Profile created successfully!" });
      onCreated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const SwitchRow = ({ id, label, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card className="border-0 shadow-sm max-w-2xl">
      <CardHeader>
        <CardTitle className="font-display">Complete Your Member Profile</CardTitle>
        <p className="text-sm text-muted-foreground">Fill in your details to get started.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Details */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+447888873207" /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
            <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
            <div className="space-y-1"><Label>Postcode</Label><Input value={form.postcode} onChange={e => set("postcode", e.target.value)} /></div>
            <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{["Male", "Female"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Church Units */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Units</h3>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border bg-background min-h-[40px]">
            {churchUnits.filter(u => u !== "None").map(unit => {
              const selected = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
              const isSelected = selected.includes(unit);
              return (
                <button key={unit} type="button" onClick={() => {
                  const current = (form.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
                  const updated = isSelected ? current.filter(u => u !== unit) : [...current, unit];
                  set("church_unit", updated.join(", "));
                }} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                  {unit}
                </button>
              );
            })}
          </div>
        </div>

        {/* Growth Indices */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Church Growth Indices</h3>
          <div className="space-y-3">
            <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
            <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
            <SwitchRow id="winners_satellite" label="Winners Satellite Fellowship" checked={form.winners_satellite} onChange={v => set("winners_satellite", v)} />
            {form.winners_satellite && (
              <div className="space-y-1.5 pl-4">
                <Label>WSF Centre</Label>
                <Select value={form.wsf_centre_id || ""} onValueChange={v => set("wsf_centre_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select WSF Centre" /></SelectTrigger>
                  <SelectContent>{wsfCentres.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.location ? ` — ${c.location}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <SwitchRow id="bfc_completed" label="Believers Foundation Class (BFC)" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
            <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
            <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
            <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
          </div>
        </div>

        {/* Emergency Contact */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
          </div>
        </div>

        {/* GDPR */}
        <div className={`rounded-xl border p-4 space-y-2 transition-colors ${form.gdpr_consent ? "border-chart-3/30 bg-chart-3/5" : "border-accent/30 bg-accent/5"}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
            <span className="text-sm text-foreground leading-relaxed">
              I consent to processing my personal data including attendance records in accordance with <strong>UK GDPR</strong>.
            </span>
          </label>
          {!form.gdpr_consent && <p className="text-xs text-accent pl-7">⚠️ Consent is required to complete registration.</p>}
        </div>

        <Button onClick={handleCreate} disabled={saving || !form.first_name || !form.last_name || !form.gdpr_consent} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create My Profile
        </Button>
      </CardContent>
    </Card>
  );
}
