import React, { useState, useRef } from "react";
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
import { Loader2, User, Mail, Phone, MapPin, Calendar, CheckCircle2, XCircle, Church, Edit, Save, X, Shield, BookOpen, Camera } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { suggestClosestWSFCentre } from "@/lib/wsf-suggest";
import { useChurchUnits } from "@/hooks/useChurchUnits";
import MyCertificates from "@/components/certificates/MyCertificates";
import MemberJourneyTimeline from "@/components/members/MemberJourneyTimeline";
import TakeExamDialog from "@/components/exams/TakeExamDialog";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const GENDERS = ["Male", "Female"];
const MEMBERSHIP_STATUSES = ["Active", "First Timer", "New Convert", "Visitor"];
const HIDE_SPIRITUAL_STATUSES = ["First Timer", "New Convert", "Visitor"];
const SHOW_BAPTISM_STATUSES = ["First Timer", "New Convert"];

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
  "Visitor": "bg-primary/10 text-primary",
};

const buildOwnMemberProfilePayload = (memberId, updates = {}) => ({
  _member_id: memberId,
  _first_name: updates.first_name ?? null,
  _last_name: updates.last_name ?? null,
  _email: updates.email ?? null,
  _phone: updates.phone ?? null,
  _address: updates.address ?? null,
  _city: updates.city ?? null,
  _postcode: updates.postcode ?? null,
  _date_of_birth: updates.date_of_birth ?? null,
  _gender: updates.gender ?? null,
  _emergency_contact_name: updates.emergency_contact_name ?? null,
  _emergency_contact_phone: updates.emergency_contact_phone ?? null,
  _notes: updates.notes ?? null,
  _photo_url: updates.photo_url ?? null,
  _membership_status: updates.membership_status ?? null,
  _church_unit: updates.church_unit ?? null,
  _water_baptism: updates.water_baptism ?? null,
  _holy_spirit_baptism: updates.holy_spirit_baptism ?? null,
  _winners_satellite: updates.winners_satellite ?? null,
  _wsf_centre_id: updates.wsf_centre_id ?? null,
  _workers_in_training: updates.workers_in_training ?? null,
  _bfc_completed: updates.bfc_completed ?? null,
  _bcc_completed: updates.bcc_completed ?? null,
  _lcc_completed: updates.lcc_completed ?? null,
  _ldc_completed: updates.ldc_completed ?? null,
});

function ProfilePhotoUpload({ member, user, onUpdated }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
      const { error: rpcError } = await supabase.rpc(
        "update_own_member_profile",
        buildOwnMemberProfilePayload(member.id, {
          photo_url: urlData.publicUrl,
          workers_in_training: member.workers_in_training,
        })
      );
      if (rpcError) throw rpcError;
      onUpdated();
      toast({ title: "Profile photo updated" });
    } catch (err) {
      console.error("Photo upload error:", err);
      toast({ title: "Upload failed", description: `${err.message}${err.statusCode ? ` (${err.statusCode})` : ""}`, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative shrink-0 cursor-pointer group" onClick={() => fileRef.current?.click()}>
      {member.photo_url ? (
        <img src={member.photo_url} alt="" className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover" />
      ) : (
        <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg sm:text-xl">
          {member.first_name[0]}{member.last_name[0]}
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

export default function MyProfile() {
  const { user, roles, isAdmin, isUnitLeader, isWSFLeader } = useAuth();
  const { data: churchUnitsData = [] } = useChurchUnits();
  const CHURCH_UNITS = churchUnitsData.map(u => u.name);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [examSelection, setExamSelection] = useState(null);

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
      if (data) return data;

      const { data: claimedMemberId, error: claimError } = await supabase.rpc("claim_own_member_profile");
      if (claimError) throw claimError;
      if (!claimedMemberId) return null;

      const { data: claimedMember, error: claimedMemberError } = await supabase
        .from("members")
        .select("*, wsf_centres!fk_members_wsf_centre(name)")
        .eq("id", claimedMemberId)
        .maybeSingle();

      if (claimedMemberError) throw claimedMemberError;
      return claimedMember;
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
      const { error } = await supabase.rpc(
        "update_own_member_profile",
        buildOwnMemberProfilePayload(member.id, {
          ...updates,
          workers_in_training: member.workers_in_training,
        })
      );
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
      church_unit: member.church_unit || "",
      water_baptism: member.water_baptism || false,
      holy_spirit_baptism: member.holy_spirit_baptism || false,
      winners_satellite: member.winners_satellite || false,
      wsf_centre_id: member.wsf_centre_id || "",
      bfc_completed: member.bfc_completed || false,
      bcc_completed: member.bcc_completed || false,
      lcc_completed: member.lcc_completed || false,
      ldc_completed: member.ldc_completed || false,
    });
    setEditing(true);
  };

  const handleSave = () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }
    const showUnits = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
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
      church_unit: showUnits ? (form.church_unit || null) : null,
      water_baptism: form.water_baptism,
      holy_spirit_baptism: form.holy_spirit_baptism,
      winners_satellite: form.winners_satellite,
      wsf_centre_id: form.wsf_centre_id || null,
      bfc_completed: form.bfc_completed,
      bcc_completed: form.bcc_completed,
      lcc_completed: form.lcc_completed,
      ldc_completed: form.ldc_completed,
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

  const showChurchUnits = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showSpiritualDev = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showBaptism = SHOW_BAPTISM_STATUSES.includes(form.membership_status);

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
            <div className="flex flex-col sm:flex-row items-start gap-4 flex-1 min-w-0">
              <ProfilePhotoUpload member={member} user={user} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["my-member-profile"] })} />
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
                        <div className="space-y-1">
                          <Label>Membership Status</Label>
                          <Select value={form.membership_status || ""} onValueChange={v => set("membership_status", v)}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{MEMBERSHIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s === "Active" ? "Active Member" : s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Church Units — only for Active/Inactive */}
                    {showChurchUnits && (
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
                    )}

                    {/* Baptism — only for First Timer / New Convert */}
                    {showBaptism && !showSpiritualDev && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Baptism</h3>
                        <div className="space-y-3">
                          <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
                          <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
                        </div>
                      </div>
                    )}

                    {/* Spiritual Development — only for Active/Inactive */}
                    {showSpiritualDev && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Spiritual Development</h3>
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

                          {/* Word of Faith Bible Institute - WoFBI */}
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Word of Faith Bible Institute — WoFBI</p>
                            <div className="space-y-3">
                              <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
                              <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
                              <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visitor BFC prompt */}
                    {form.membership_status === "Visitor" && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Foundation Class</h3>
                        <SwitchRow id="bfc_completed" label="Have you completed Believers Foundation Class (BFC)?" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
                      </div>
                    )}

                    {/* Emergency Contact */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div className="space-y-1"><Label>Contact Name (Optional)</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
                        <div className="space-y-1"><Label>Contact Phone (Optional)</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label>Prayer Request</Label>
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

      {/* Profile Note / Prayer Request */}
      {!editing && member.notes && (
        <Card className="border-0 shadow-sm border-l-4 border-l-primary/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Prayer Request</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{member.notes}</p>
          </CardContent>
        </Card>
      )}

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

      {/* Member Journey */}
      {!editing && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base">Member Journey</CardTitle></CardHeader>
          <CardContent>
            <MemberJourneyTimeline memberId={member.id} />
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      {!editing && <MyCertificates memberId={member.id} />}

      {/* Take Exams */}
      {!editing && <DynamicExamButtons memberId={member.id} onSelect={setExamSelection} />}

      <TakeExamDialog
        open={!!examSelection}
        onOpenChange={(v) => { if (!v) setExamSelection(null); }}
        trainingType={examSelection?.type}
        memberId={member.id}
        subjectId={examSelection?.subjectId}
        subjectName={examSelection?.subjectName}
      />

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
  const nameParts = (user?.user_metadata?.full_name || "").trim().split(/\s+/);
  const defaultFirst = nameParts[0] || "";
  const defaultLast = nameParts.slice(1).join(" ") || "";

  const [form, setForm] = useState({
    first_name: defaultFirst, last_name: defaultLast, email: user?.email || "", phone: "", address: "",
    city: "Cardiff", postcode: "", date_of_birth: "", gender: "",
    membership_status: "First Timer",
    emergency_contact_name: "", emergency_contact_phone: "",
    church_unit: "", notes: "",
    water_baptism: false, holy_spirit_baptism: false, winners_satellite: false,
    wsf_centre_id: "", bfc_completed: false, bcc_completed: false, lcc_completed: false, ldc_completed: false,
    gdpr_consent: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const showChurchUnits = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showSpiritualDev = !HIDE_SPIRITUAL_STATUSES.includes(form.membership_status);
  const showBaptism = SHOW_BAPTISM_STATUSES.includes(form.membership_status);

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
      const { data, error } = await supabase.functions.invoke("public-register", {
        body: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          postcode: form.postcode || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          membership_status: form.membership_status || "First Timer",
          church_unit: showChurchUnits ? (form.church_unit || null) : null,
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
          notes: form.notes || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Profile updated successfully!" });
      onCreated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const MEMBERSHIP_STATUSES = ["Active", "Inactive", "First Timer", "New Convert", "Visitor"];

  const SwitchRow = ({ id, label, checked, onChange }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Card className="border-0 shadow-sm max-w-2xl">
      <CardHeader>
        <CardTitle className="font-display">Update My Profile</CardTitle>
        <p className="text-sm text-muted-foreground">Review and update your details below.</p>
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
            <div className="space-y-1">
              <Label>Membership Status</Label>
              <Select value={form.membership_status} onValueChange={v => set("membership_status", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{MEMBERSHIP_STATUSES.map(s => <SelectItem key={s} value={s}>{s === "Active" ? "Active Member" : s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Church Units — only for Active/Inactive */}
        {showChurchUnits && (
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
        )}

        {/* Baptism — only for First Timer / New Convert */}
        {showBaptism && !showSpiritualDev && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Baptism</h3>
            <div className="space-y-3">
              <SwitchRow id="water_baptism" label="Water Baptism" checked={form.water_baptism} onChange={v => set("water_baptism", v)} />
              <SwitchRow id="holy_spirit_baptism" label="Holy Spirit Baptism" checked={form.holy_spirit_baptism} onChange={v => set("holy_spirit_baptism", v)} />
            </div>
          </div>
        )}

        {/* Spiritual Development — only for Active/Inactive */}
        {showSpiritualDev && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Spiritual Development</h3>
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

              {/* Word of Faith Bible Institute - WoFBI */}
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Word of Faith Bible Institute — WoFBI</p>
                <div className="space-y-3">
                  <SwitchRow id="bcc_completed" label="Basic Certificate Course (BCC)" checked={form.bcc_completed} onChange={v => set("bcc_completed", v)} />
                  <SwitchRow id="lcc_completed" label="Leadership Certificate Course (LCC)" checked={form.lcc_completed} onChange={v => set("lcc_completed", v)} />
                  <SwitchRow id="ldc_completed" label="Leadership Diploma Course (LDC)" checked={form.ldc_completed} onChange={v => set("ldc_completed", v)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visitor BFC prompt */}
        {form.membership_status === "Visitor" && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Foundation Class</h3>
            <SwitchRow id="bfc_completed" label="Have you completed Believers Foundation Class (BFC)?" checked={form.bfc_completed} onChange={v => set("bfc_completed", v)} />
          </div>
        )}

        {/* Emergency Contact */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Emergency Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Contact Name (Optional)</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Contact Phone (Optional)</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
          </div>
        </div>

        {/* GDPR */}
        <div className={`rounded-xl border p-4 space-y-2 transition-colors ${form.gdpr_consent ? "border-chart-3/30 bg-chart-3/5" : "border-accent/30 bg-accent/5"}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.gdpr_consent} onChange={e => set("gdpr_consent", e.target.checked)} className="mt-0.5 rounded h-4 w-4 shrink-0" />
            <span className="text-sm text-foreground leading-relaxed">
              I consent to processing my personal data including attendance records in accordance with <strong>UK GDPR</strong>.{" "}
              <a href="https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">View our Privacy Policy</a>.
            </span>
          </label>
          {!form.gdpr_consent && <p className="text-xs text-accent pl-7">⚠️ Consent is required to complete registration.</p>}
        </div>

        <Button onClick={handleCreate} disabled={saving || !form.first_name || !form.last_name || !form.gdpr_consent} className="w-full">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update My Profile
        </Button>
      </CardContent>
    </Card>
  );
}

function DynamicExamButtons({ memberId, onSelect }) {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["exam-titles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_titles").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["my-course-registrations", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from("course_registrations").select("course_id").eq("member_id", memberId);
      if (error) throw error;
      return data.map(r => r.course_id);
    },
    enabled: !!memberId,
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["all-exam-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_subjects").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: myAttempts = [] } = useQuery({
    queryKey: ["my-course-attempts", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("subject_id, training_type, score, total_points, passed, retake_allowed")
        .eq("member_id", memberId);
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  if (isLoading || courses.length === 0) return null;

  // Only show registered courses with exams_open
  const registeredCourses = courses.filter(c => registrations.includes(c.id) && c.exams_open);
  if (registeredCourses.length === 0) return null;

  // Build best attempt per subject
  const bestBySubject = {};
  myAttempts.forEach(a => {
    if (!a.subject_id) return;
    const pct = a.total_points > 0 ? a.score / a.total_points : 0;
    if (!bestBySubject[a.subject_id] || pct > (bestBySubject[a.subject_id].score / bestBySubject[a.subject_id].total_points)) {
      bestBySubject[a.subject_id] = a;
    }
  });

  const downloadScoreReport = (course, subjects) => {
    const courseSubjects = subjects.filter(s => s.course_id === course.id);
    let totalScore = 0, totalPoints = 0;
    const rows = courseSubjects.map(s => {
      const best = bestBySubject[s.id];
      if (best) { totalScore += best.score; totalPoints += best.total_points; }
      return [s.name, best ? `${best.score}/${best.total_points}` : "Not taken", best ? `${Math.round((best.score / best.total_points) * 100)}%` : "—"];
    });
    const aggPct = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    const passed = aggPct >= course.pass_mark_percentage;

    const html = `<!DOCTYPE html><html><head><title>${course.name} Score Report</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;color:#1e3a5f}
    table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#1e3a5f;color:#fff;text-align:left;padding:8px 10px;font-size:11px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f8fafc}
    .summary{margin-top:20px;padding:12px;border-radius:8px;font-size:14px}
    .pass{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}.fail{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    @media print{body{margin:0}}</style></head><body>
    <h1>${course.name} — Score Report</h1>
    <p style="font-size:11px;color:#666">Generated: ${new Date().toLocaleString("en-GB")}</p>
    <table><thead><tr><th>Subject</th><th>Score</th><th>%</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table>
    <div class="summary ${passed ? 'pass' : 'fail'}">
    <strong>Aggregate: ${totalScore}/${totalPoints} (${aggPct}%)</strong> — Pass mark: ${course.pass_mark_percentage}% — <strong>${passed ? "PASSED ✓" : "NOT PASSED"}</strong>
    </div></body></html>`;

    const win = window.open("", "_blank", "width=700,height=500");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> WoFBI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {registeredCourses.map(course => {
          const subjects = allSubjects.filter(s => s.course_id === course.id);
          if (subjects.length === 0) return null;

          const completedSubjectIds = subjects.filter(s => bestBySubject[s.id]).map(s => s.id);
          const totalScore = completedSubjectIds.reduce((sum, id) => sum + (bestBySubject[id]?.score || 0), 0);
          const totalPoints = completedSubjectIds.reduce((sum, id) => sum + (bestBySubject[id]?.total_points || 0), 0);
          const aggPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
          const allDone = completedSubjectIds.length === subjects.length;
          const passed = allDone && aggPct >= course.pass_mark_percentage;

          return (
            <div key={course.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{course.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {completedSubjectIds.length}/{subjects.length} subjects completed
                    {totalPoints > 0 && ` · Aggregate: ${Math.round(aggPct)}%`}
                    {` · Pass mark: ${course.pass_mark_percentage}%`}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {allDone && (
                    <Badge variant={passed ? "default" : "destructive"} className="text-xs">
                      {passed ? "Passed ✓" : "Not Passed"}
                    </Badge>
                  )}
                  {completedSubjectIds.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => downloadScoreReport(course, allSubjects)}>
                      📄 Score Report
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => {
                  const taken = !!bestBySubject[s.id];
                  const best = bestBySubject[s.id];
                  const bestPct = best && best.total_points > 0 ? (best.score / best.total_points) * 100 : 0;
                  const subjectPassMark = s.pass_mark_percentage ?? 50;
                  const hasPassed = taken && bestPct >= subjectPassMark;
                  const canRetake = taken && !hasPassed && myAttempts.some(a => a.subject_id === s.id && a.retake_allowed === true);
                  const isDisabled = taken && !canRetake;
                  return (
                    <Button
                      key={s.id}
                      variant={taken ? "secondary" : "outline"}
                      size="sm"
                      disabled={isDisabled}
                      onClick={() => onSelect({ type: course.name, subjectId: s.id, subjectName: s.name })}
                      className="gap-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {s.name} {taken ? (canRetake ? "↻ Retake" : `✓ ${best.score}/${best.total_points}`) : ""}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
