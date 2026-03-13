import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Mail, Phone, MapPin, Calendar, CheckCircle2, XCircle, Church, Edit, Save, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

const GENDERS = ["Male", "Female"];

export default function MyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const { data: member, isLoading } = useQuery({
    queryKey: ["my-member-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*, wsf_centres(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
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
      const { error } = await supabase.from("members").update(updates).eq("id", member.id);
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
      emergency_contact_name: member.emergency_contact_name || "",
      emergency_contact_phone: member.emergency_contact_phone || "",
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
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!member) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No member profile linked</p>
          <p className="text-sm mt-1">Please contact an administrator to link your account to a member record.</p>
        </CardContent>
      </Card>
    );
  }

  const units = member.church_unit ? member.church_unit.split(",").map(u => u.trim()).filter(Boolean) : [];

  const BoolBadge = ({ value, label }) => (
    <div className="flex items-center gap-2 text-sm">
      {value ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                {member.first_name[0]}{member.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
                      <div className="space-y-1 sm:col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
                      <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Postcode</Label><Input value={form.postcode} onChange={e => set("postcode", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} /></div>
                      <div className="space-y-1">
                        <Label>Gender</Label>
                        <Select value={form.gender || ""} onValueChange={v => set("gender", v)}>
                          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>{GENDERS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">Emergency Contact</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={e => set("emergency_contact_name", e.target.value)} /></div>
                      <div className="space-y-1"><Label>Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={e => set("emergency_contact_phone", e.target.value)} /></div>
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
                    <h2 className="text-xl font-bold text-foreground">{member.first_name} {member.last_name}</h2>
                    <Badge variant="outline" className="mt-1">{member.membership_status}</Badge>
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

      {/* Growth Milestones */}
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
