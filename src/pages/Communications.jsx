import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Plus, Megaphone, Pin, Mail } from "lucide-react";
import EmailAlertForm from "@/components/comms/EmailAlertForm";
import { Skeleton } from "@/components/ui/skeleton";
import AnnouncementForm from "@/components/comms/AnnouncementForm";
import AnnouncementCard from "@/components/comms/AnnouncementCard";

const AUDIENCES = [
  "All", "All Members", "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "Leaders Only"
];

export default function Communications() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [audienceFilter, setAudienceFilter] = useState("All");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Announcement.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const handleSave = async (data) => {
    const payload = {
      ...data,
      author_name: currentUser?.full_name || currentUser?.email || "Admin",
      author_email: currentUser?.email || "",
    };
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setEditing(null);
  };

  const handleDelete = (a) => {
    if (window.confirm(`Delete "${a.title}"?`)) deleteMutation.mutate(a.id);
  };

  const isAdmin = currentUser?.role === "admin";
  const isLeader = currentUser?.role === "unit_leader";
  const isRegularUser = currentUser?.role === "user";

  // Fetch member profile for unit-based filtering
  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-comms", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!(currentUser?.email && !isAdmin),
  });
  const myMember = myMemberArr[0] || null;
  const myUnits = myMember?.church_units || [];

  // Members only see announcements relevant to them (by unit + all-members)
  const visibleAnnouncements = announcements.filter(a => {
    if (isAdmin) return true;
    if (a.audience === "Leaders Only") return isLeader;
    if (a.audience === "All Members") return true;
    // Check if member's units match the announcement audience
    if (myUnits.includes(a.audience)) return true;
    // For backward compatibility with old single-unit announcements
    if (myMember?.church_unit && myMember.church_unit !== "None" && a.audience === myMember.church_unit) return true;
    return false;
  });

  const filtered = visibleAnnouncements
    .filter(a => audienceFilter === "All" || a.audience === audienceFilter)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

  const pinnedCount = visibleAnnouncements.filter(a => a.pinned).length;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="announcements">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="announcements" className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Announcements
            </TabsTrigger>
            {(isAdmin || isLeader) && (
              <TabsTrigger value="email-alerts" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email Alerts
              </TabsTrigger>
            )}
          </TabsList>
          <div className="flex items-center gap-3">
            {(isAdmin || isLeader) && (
                <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
                  <Plus className="h-4 w-4 mr-2" /> New Announcement
                </Button>
              )}
          </div>
        </div>

        <TabsContent value="announcements" className="space-y-4 mt-0">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{visibleAnnouncements.length}</p>
              <p className="text-xs text-slate-400">Total</p>
            </Card>
            <Card className="border-0 shadow-sm p-4 text-center">
              <p className="text-2xl font-bold text-[#c9a84c] flex items-center justify-center gap-1"><Pin className="h-5 w-5" />{pinnedCount}</p>
              <p className="text-xs text-slate-400">Pinned</p>
            </Card>
            <Card className="border-0 shadow-sm p-4 text-center sm:block hidden">
              <p className="text-2xl font-bold text-indigo-600">{[...new Set(visibleAnnouncements.map(a => a.audience))].length}</p>
              <p className="text-xs text-slate-400">Groups Reached</p>
            </Card>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-3">
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Filter by audience" />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map(a => <SelectItem key={a} value={a}>{a === "All" ? "All Audiences" : a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="border-0 shadow-sm p-16 text-center text-slate-400">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">No announcements yet</p>
              {isAdmin && <p className="text-sm mt-1">Click "New Announcement" to post one</p>}
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(a => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  isAdmin={isAdmin || (isLeader && a.author_email === currentUser?.email)}
                  onEdit={(ann) => { setEditing(ann); setDialogOpen(true); }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {(isAdmin || isLeader) && (
          <TabsContent value="email-alerts" className="mt-4">
            <EmailAlertForm
              currentUser={currentUser}
              myUnits={myUnits}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}
      </Tabs>

      <AnnouncementForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        announcement={editing}
        onSave={handleSave}
        lockedAudience={isLeader ? myUnits[0] : null}
      />
    </div>
  );
}