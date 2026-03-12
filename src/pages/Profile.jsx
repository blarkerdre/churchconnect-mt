import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Phone, Mail, MapPin, Calendar, Church, Pencil, Save, X, CheckCircle2 } from "lucide-react";

const statusColors = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-slate-100 text-slate-600",
  "New Convert": "bg-blue-100 text-blue-700",
  "First Timer": "bg-amber-100 text-amber-700",
};

const CHURCH_UNITS = [
  "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts", "None"
];

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function GrowthBadge({ label, done }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 ${done ? "text-emerald-500" : "text-slate-300"}`} />
      {label}
    </div>
  );
}

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  // Find the member record linked to this user by email
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 500),
    enabled: !!currentUser,
  });

  const memberRecord = members.find(
    (m) => m.email?.toLowerCase() === currentUser?.email?.toLowerCase()
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const startEdit = () => {
    setForm({
      first_name: memberRecord?.first_name || currentUser?.full_name?.split(" ")[0] || "",
      last_name: memberRecord?.last_name || currentUser?.full_name?.split(" ").slice(1).join(" ") || "",
      email: memberRecord?.email || currentUser?.email || "",
      phone: memberRecord?.phone || "",
      address: memberRecord?.address || "",
      city: memberRecord?.city || "",
      postcode: memberRecord?.postcode || "",
      gender: memberRecord?.gender || "",
      marital_status: memberRecord?.marital_status || "",
      church_unit: memberRecord?.church_unit || "None",
      membership_status: memberRecord?.membership_status || "Active",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (memberRecord) {
      await updateMutation.mutateAsync({ id: memberRecord.id, data: form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setSaving(false);
    setEditing(false);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  if (!currentUser || isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const displayName = memberRecord
    ? `${memberRecord.first_name} ${memberRecord.last_name}`
    : currentUser.full_name || currentUser.email;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[#1e3a5f] to-[#2d5491]" />
        <CardContent className="pt-0 pb-6 px-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="h-20 w-20 rounded-2xl bg-[#c9a84c] flex items-center justify-center shadow-lg border-4 border-white">
              <User className="h-9 w-9 text-white" />
            </div>
            {memberRecord?.membership_status && (
              <Badge className={`${statusColors[memberRecord.membership_status] || statusColors.Active} border-0`}>
                {memberRecord.membership_status}
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-bold text-slate-800">{displayName}</h2>
          <p className="text-sm text-slate-400">{currentUser.email}</p>
          {memberRecord?.church_unit && memberRecord.church_unit !== "None" && (
            <p className="text-xs text-[#1e3a5f] font-medium mt-1 flex items-center gap-1">
              <Church className="h-3.5 w-3.5" /> {memberRecord.church_unit}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Details / Edit card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Personal Details</CardTitle>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152d4a] gap-2">
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Postcode</Label>
                <Input value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Marital Status</Label>
                <Select value={form.marital_status} onValueChange={(v) => set("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Church Unit</Label>
                <Select value={form.church_unit} onValueChange={(v) => set("church_unit", v)}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {CHURCH_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow icon={Mail} label="Email" value={memberRecord?.email || currentUser.email} />
              <InfoRow icon={Phone} label="Phone" value={memberRecord?.phone} />
              <InfoRow icon={MapPin} label="Address" value={[memberRecord?.address, memberRecord?.city, memberRecord?.postcode].filter(Boolean).join(", ")} />
              <InfoRow icon={User} label="Gender" value={memberRecord?.gender} />
              <InfoRow icon={Calendar} label="Marital Status" value={memberRecord?.marital_status} />
              <InfoRow icon={Church} label="Church Unit" value={memberRecord?.church_unit !== "None" ? memberRecord?.church_unit : null} />
              <InfoRow icon={Calendar} label="Join Date" value={memberRecord?.join_date} />
              {!memberRecord && (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No member profile found. Click Edit to create your profile.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Growth indices (read-only) */}
      {memberRecord && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Spiritual Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <GrowthBadge label="Water Baptism" done={memberRecord.water_baptism} />
              <GrowthBadge label="Holy Spirit Baptism" done={memberRecord.holy_spirit_baptism} />
              <GrowthBadge label="BFC" done={memberRecord.bfc_completed} />
              <GrowthBadge label="BCC" done={memberRecord.bcc_completed} />
              <GrowthBadge label="LCC" done={memberRecord.lcc_completed} />
              <GrowthBadge label="LDC" done={memberRecord.ldc_completed} />
              <GrowthBadge label="Workers in Training" done={memberRecord.workers_in_training} />
              <GrowthBadge label="Satellite Fellowship" done={memberRecord.winners_satellite} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}