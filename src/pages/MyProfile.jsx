import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Phone, Mail, MapPin, Calendar, CheckCircle2, XCircle,
  Users, Pencil
} from "lucide-react";
import MemberFormDialog from "@/components/members/MemberFormDialog";
import { useCurrentUser } from "@/components/useCurrentUser";

const GROWTH_FIELDS = [
  { key: "water_baptism", label: "Water Baptism" },
  { key: "holy_spirit_baptism", label: "Holy Spirit Baptism" },
  { key: "winners_satellite", label: "WSF Member" },
  { key: "workers_in_training", label: "Workers in Training" },
  { key: "bfc_completed", label: "BFC" },
  { key: "bcc_completed", label: "BCC" },
  { key: "lcc_completed", label: "LCC" },
  { key: "ldc_completed", label: "LDC" },
];

export default function MyProfile() {
  const { user: currentUser, loading } = useCurrentUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Find the member record linked to this user by email
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["my-member-profile", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!currentUser?.email,
  });

  const member = members[0] || null;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-member-profile", currentUser?.email] }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-member-profile", currentUser?.email] }),
  });

  const handleSave = async (data) => {
    if (member) {
      await updateMutation.mutateAsync({ id: member.id, data });
    } else {
      await createMutation.mutateAsync({
        ...data,
        email: currentUser.email,
        membership_status: data.membership_status || "Active",
        join_date: data.join_date || new Date().toISOString().split("T")[0],
      });
    }
    setDialogOpen(false);
  };

  if (loading || (!!currentUser && isLoading)) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-0 shadow-sm p-12 text-center space-y-4">
          <User className="h-12 w-12 mx-auto text-slate-300" />
          <h2 className="text-lg font-semibold text-slate-700">Complete Your Profile</h2>
          <p className="text-sm text-slate-400">
            Welcome! Please fill in your member details to complete your registration.
          </p>
          <Button
            className="bg-[#1e3a5f] hover:bg-[#152d4a] mx-auto"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil className="h-4 w-4 mr-2" /> Set Up My Profile
          </Button>
        </Card>
        <MemberFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={null}
          onSave={handleSave}
        />
      </div>
    );
  }

  const statusColors = {
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-slate-100 text-slate-500",
    "New Convert": "bg-blue-100 text-blue-700",
    "First Timer": "bg-amber-100 text-amber-700",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Hero Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f]" />
        <CardContent className="pt-0 pb-6 px-6">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="h-16 w-16 rounded-2xl bg-[#c9a84c] flex items-center justify-center text-2xl font-bold text-[#0f1f33] shadow-lg">
              {member.first_name?.[0]}{member.last_name?.[0]}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="mb-1"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
          <h2 className="text-xl font-bold text-slate-800">{member.first_name} {member.last_name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge className={statusColors[member.membership_status] || "bg-slate-100 text-slate-600"}>
              {member.membership_status}
            </Badge>
            {member.church_units && member.church_units.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {member.church_units.map(unit => (
                  <Badge key={unit} variant="outline" className="text-xs">{unit}</Badge>
                ))}
              </div>
            )}
            {member.winners_satellite && (
              <Badge variant="outline" className="text-xs text-blue-600">WSF — {member.wsf_centre_name || "Member"}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Email", value: member.email, el: <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
            { label: "Phone", value: member.phone, el: <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
            { label: "Address", value: [member.address, member.city, member.postcode].filter(Boolean).join(", "), el: <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
            { label: "Date of Birth", value: member.date_of_birth, el: <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
            { label: "Marital Status", value: member.marital_status, el: <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
            { label: "Joined", value: member.join_date, el: <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> },
          ].map(({ el, label, value }) => value ? (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
              {el}
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-medium text-slate-700">{value}</p>
              </div>
            </div>
          ) : null)}
        </CardContent>
      </Card>

      {/* Growth Indices */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Growth Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GROWTH_FIELDS.map(({ key, label }) => (
              <div key={key} className={`rounded-xl p-3 text-center border ${member[key] ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}>
                {member[key]
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                  : <XCircle className="h-5 w-5 text-slate-300 mx-auto mb-1" />}
                <p className={`text-xs font-medium ${member[key] ? "text-emerald-700" : "text-slate-400"}`}>{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={member}
        onSave={handleSave}
      />
    </div>
  );
}