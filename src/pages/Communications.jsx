import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Megaphone, Pin, Search, Plus, Loader2, Trash2, Pencil, MessageSquare, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import AnnouncementForm from "@/components/comms/AnnouncementForm";
import { logAudit } from "@/lib/audit";
import SMSDialog from "@/components/sms/SMSDialog";
import SMSHistoryDialog from "@/components/sms/SMSHistoryDialog";

const AUDIENCES = [
  "All Members", "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "Leaders Only"
];

export default function Communications() {
  const { user, isAdmin, isUnitLeader, leaderUnits } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsAnnouncement, setSmsAnnouncement] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Use leaderUnits from auth context for unit leaders
  const unitLeaderUnits = (!isAdmin && isUnitLeader && leaderUnits.length > 0)
    ? leaderUnits
    : null;

  // Fallback: if no unit_leader_assignments, check member's church_unit
  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("church_unit")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id && isUnitLeader && !isAdmin && !unitLeaderUnits,
  });

  const effectiveUnits = unitLeaderUnits || (myMember?.church_unit
    ? myMember.church_unit.split(",").map(u => u.trim()).filter(Boolean)
    : null);
  const lockedAudience = effectiveUnits?.length === 1 ? effectiveUnits[0] : null;

  // Fetch announcements
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, profiles:created_by(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(a => ({
        id: a.id,
        title: a.title,
        body: a.content,
        audience: a.target_audience || "All Members",
        pinned: a.category === "pinned",
        is_published: a.is_published,
        created_date: a.created_at,
        author_name: a.profiles?.full_name || "Admin",
        created_by: a.created_by,
      }));
    },
  });

  // Filter by unit leader's units — they only see their own unit announcements + "All Members"
  const visibleAnnouncements = announcements.filter(a => {
    if (isAdmin) return true;
    if (effectiveUnits) {
      return a.audience === "All Members" || effectiveUnits.includes(a.audience) || a.created_by === user?.id;
    }
    return true;
  });

  const filtered = visibleAnnouncements.filter(a =>
    `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  // Save (create or update)
  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const payload = {
        title: form.title,
        content: form.body,
        target_audience: form.audience,
        category: form.pinned ? "pinned" : null,
        is_published: true,
        created_by: user.id,
      };
      if (editing) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit("announcement_update", "announcements", editing.id, { title: form.title });
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
        await logAudit("announcement_create", "announcements", null, { title: form.title, audience: form.audience });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: editing ? "Announcement updated" : "Announcement posted" });
      setEditing(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      await logAudit("announcement_delete", "announcements", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const handleEdit = (a) => {
    // Unit leaders can only edit their own announcements
    if (!isAdmin && a.created_by !== user?.id) return;
    setEditing(a);
    setFormOpen(true);
  };

  const handleDelete = (a) => {
    if (!isAdmin && a.created_by !== user?.id) return;
    if (confirm("Delete this announcement?")) deleteMutation.mutate(a.id);
  };

  const canManage = (a) => isAdmin || a.created_by === user?.id;

  // Available audiences for the form
  const availableAudiences = isAdmin
    ? AUDIENCES
    : effectiveUnits
      ? AUDIENCES.filter(a => effectiveUnits.includes(a))
      : [];

  const renderCard = (a) => (
    <Card key={a.id} className={`border-0 shadow-sm ${a.pinned ? "border-l-4 border-l-accent" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {a.pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
              <h3 className="font-display font-bold text-foreground">{a.title}</h3>
              <Badge className="bg-accent/10 text-accent border-0">{a.audience}</Badge>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.body}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{a.author_name}</span>
              {a.created_date && <span>{format(new Date(a.created_date), "dd MMM yyyy, h:mm a")}</span>}
            </div>
          </div>
          {canManage(a) && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Send as SMS"
                onClick={() => { setSmsAnnouncement(a); setSmsOpen(true); }}>
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(a)}>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(a)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4 mr-2" /> SMS History
          </Button>
          <Button variant="outline" onClick={() => { setSmsAnnouncement(null); setSmsOpen(true); }}>
            <MessageSquare className="h-4 w-4 mr-2" /> Bulk SMS
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> New Announcement
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" /> Pinned</h3>
              {pinned.map(renderCard)}
            </div>
          )}
          <div className="space-y-3">
            {regular.map(renderCard)}
            {filtered.length === 0 && (
              <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
                <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-lg font-medium">No announcements found</p>
              </Card>
            )}
          </div>
        </>
      )}

      <AnnouncementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        announcement={editing}
        onSave={(form) => saveMutation.mutateAsync(form)}
        lockedAudience={lockedAudience}
        availableAudiences={availableAudiences}
      />

      <SMSDialog
        open={smsOpen}
        onOpenChange={setSmsOpen}
        prefillMessage={smsAnnouncement ? `${smsAnnouncement.title}: ${smsAnnouncement.body}` : ""}
        prefillAudience={smsAnnouncement?.audience || ""}
        smsType={smsAnnouncement ? "announcement" : "bulk"}
        referenceId={smsAnnouncement?.id || null}
        title={smsAnnouncement ? "Send Announcement as SMS" : "Bulk SMS"}
      />

      <SMSHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}
