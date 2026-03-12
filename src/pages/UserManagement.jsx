import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, UserPlus, Search, ShieldCheck, User, Crown, Pencil, Mail } from "lucide-react";
import { useCurrentUser } from "@/components/useCurrentUser";
import AccessDenied from "@/components/AccessDenied";

const ROLES = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access to all features including user management",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    icon: Crown,
    access: ["Dashboard", "Members", "Events", "First Timers", "Follow-up", "Pastoral Care", "WSF", "Communications", "User Management"],
  },
  {
    value: "unit_leader",
    label: "Unit Leader / Worker",
    description: "Access to members, events, follow-ups, WSF, comms — not pastoral care or user management",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: ShieldCheck,
    access: ["Dashboard", "My Profile", "My Pastoral Care", "Members", "Events", "First Timers", "Follow-up", "WSF", "Communications"],
  },
  {
    value: "user",
    label: "Member",
    description: "Basic access: dashboard, own profile, events and announcements only",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    icon: User,
    access: ["Dashboard", "My Profile", "My Pastoral Care", "Events", "Communications"],
  },
];

function RoleBadge({ role }) {
  const r = ROLES.find(r => r.value === role) || ROLES[2];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${r.color}`}>
      <r.icon className="h-3 w-3" />
      {r.label}
    </span>
  );
}

function InviteDialog({ open, onOpenChange, onInvite }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onInvite(email.trim(), role);
      setEmail("");
      setRole("user");
      onOpenChange(false);
    } catch (e) {
      setError(e.message || "Failed to invite user");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#1e3a5f]" /> Invite User
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input
              type="email"
              placeholder="member@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleInvite()}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${role === r.value ? "border-[#1e3a5f] bg-slate-50" : "border-slate-100 hover:border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <r.icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-800">{r.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.access.map(a => (
                        <span key={a} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleInvite}
            disabled={loading || !email.trim()}
            className="bg-[#1e3a5f] hover:bg-[#152d4a]"
          >
            {loading ? "Sending..." : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleDialog({ open, onOpenChange, targetUser, onSave }) {
  const [role, setRole] = useState(targetUser?.role || "user");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setRole(targetUser?.role || "user"); }, [targetUser]);

  const handleSave = async () => {
    setLoading(true);
    await onSave(targetUser.id, role);
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#1e3a5f]" /> Change Role
          </DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-slate-500 mb-4">
            Changing role for <span className="font-semibold text-slate-700">{targetUser?.full_name || targetUser?.email}</span>
          </p>
          <div className="space-y-2">
            {ROLES.map(r => (
              <label
                key={r.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${role === r.value ? "border-[#1e3a5f] bg-slate-50" : "border-slate-100 hover:border-slate-200"}`}
              >
                <input
                  type="radio"
                  name="change_role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <r.icon className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-800">{r.label}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.access.map(a => (
                      <span key={a} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{a}</span>
                    ))}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {loading ? "Saving..." : "Update Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UserManagement() {
  const { user: currentUser, isAdmin } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [changeRoleTarget, setChangeRoleTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list("-created_date", 200),
    enabled: isAdmin,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-users"] }),
  });

  const handleInvite = async (email, role) => {
    await base44.users.inviteUser(email, role);
    queryClient.invalidateQueries({ queryKey: ["all-users"] });
  };

  const handleChangeRole = async (id, role) => {
    await updateRoleMutation.mutateAsync({ id, role });
  };

  if (!isAdmin) return <AccessDenied />;

  const filtered = users.filter(u =>
    `${u.full_name || ""} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const roleCounts = ROLES.map(r => ({
    ...r,
    count: users.filter(u => u.role === r.value).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
          <UserPlus className="h-4 w-4 mr-2" /> Invite User
        </Button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {roleCounts.map(r => (
          <Card key={r.value} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center border ${r.color}`}>
                <r.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">{r.count}</p>
                <p className="text-xs text-slate-400">{r.label}s</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role permissions reference */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
            <Shield className="h-4 w-4" /> Access Control Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">Feature</th>
                  {ROLES.map(r => (
                    <th key={r.value} className="text-center py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${r.color}`}>
                        <r.icon className="h-3 w-3" />{r.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Dashboard", admin: true, unit_leader: true, user: true },
                  { feature: "My Profile", admin: false, unit_leader: true, user: true },
                  { feature: "My Pastoral Care", admin: false, unit_leader: true, user: true },
                  { feature: "Members", admin: true, unit_leader: true, user: false },
                  { feature: "Events", admin: true, unit_leader: true, user: true },
                  { feature: "First Timers", admin: true, unit_leader: true, user: false },
                  { feature: "Follow-up", admin: true, unit_leader: true, user: false },
                  { feature: "Pastoral Care", admin: true, unit_leader: false, user: false },
                  { feature: "WSF", admin: true, unit_leader: true, user: false },
                  { feature: "Communications", admin: true, unit_leader: true, user: true },
                  { feature: "User Management", admin: true, unit_leader: false, user: false },
                ].map(row => (
                  <tr key={row.feature} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-slate-700 font-medium">{row.feature}</td>
                    {["admin", "unit_leader", "user"].map(role => (
                      <td key={role} className="text-center py-2 px-3">
                        {row[role]
                          ? <span className="text-emerald-500 text-base">✓</span>
                          : <span className="text-slate-200 text-base">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            All Users ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#1e3a5f]">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{u.full_name || "—"}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{u.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <RoleBadge role={u.role} />
                    {u.id !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChangeRoleTarget(u)}
                        className="h-8 px-2 text-slate-500 hover:text-[#1e3a5f]"
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Role
                      </Button>
                    )}
                    {u.id === currentUser?.id && (
                      <span className="text-[10px] text-slate-400">(you)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvite={handleInvite} />
      {changeRoleTarget && (
        <ChangeRoleDialog
          open={!!changeRoleTarget}
          onOpenChange={v => { if (!v) setChangeRoleTarget(null); }}
          targetUser={changeRoleTarget}
          onSave={handleChangeRole}
        />
      )}
    </div>
  );
}