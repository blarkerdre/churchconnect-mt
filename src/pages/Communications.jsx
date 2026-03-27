import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useChurchUnits } from "@/hooks/useChurchUnits";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Pin, Search, Plus, Loader2, Trash2, Pencil, MessageSquare, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import AnnouncementForm from "@/components/comms/AnnouncementForm";
import EmailAlertForm from "@/components/comms/EmailAlertForm";

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

import { logAudit } from "@/lib/audit";
import SMSDialog from "@/components/sms/SMSDialog";

import { useSubFeature } from "@/hooks/useSubFeature";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const STATIC_AUDIENCES = ["All Members", "Leaders Only"];

export default function Communications() {
  const { user, isAdmin, isUnitLeader, isWSFLeader, leaderUnits } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { data: churchUnitsData = [] } = useChurchUnits();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsAnnouncement, setSmsAnnouncement] = useState(null);
  
  const [waOpen, setWaOpen] = useState(false);
  

  const canManageComms = isAdmin || isUnitLeader || isWSFLeader;

  const { enabled: announcementsEnabled } = useSubFeature("communications.announcements");
  const { enabled: emailEnabled } = useSubFeature("communications.email");
  const { enabled: smsEnabled } = useSubFeature("communications.sms");
  const { enabled: whatsappEnabled } = useSubFeature("communications.whatsapp");

  // Get WSF centre names for WSF leader scoping
  const { data: myWsfCentres = [] } = useQuery({
    queryKey: ["my-wsf-centres-comms", user?.id],
    queryFn: async () => {
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!memberData) return [];
      const { data, error } = await supabase
        .from("wsf_centres")
        .select("id, name")
        .eq("leader_id", memberData.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && isWSFLeader,
  });

  // Build dynamic AUDIENCES
  const AUDIENCES = [...new Set([
    "All Members",
    ...churchUnitsData.map(u => u.name),
    ...myWsfCentres.map(c => c.name),
    "Leaders Only",
  ])];

  const unitLeaderUnits = (!isAdmin && isUnitLeader && leaderUnits.length > 0)
    ? leaderUnits : null;
  const wsfLeaderCentres = (!isAdmin && isWSFLeader && myWsfCentres.length > 0)
    ? myWsfCentres.map(c => c.name) : null;

  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("members").select("church_unit").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id && !isAdmin && !unitLeaderUnits && !wsfLeaderCentres,
  });

  // Build effective units/centres for audience scoping
  const effectiveScopes = [
    ...(unitLeaderUnits || []),
    ...(wsfLeaderCentres || []),
    ...(myMember?.church_unit ? myMember.church_unit.split(",").map(u => u.trim()).filter(Boolean) : []),
  ];
  const lockedAudience = !isAdmin && effectiveScopes.length === 1 ? effectiveScopes[0] : null;

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("announcements")
          .select("*, profiles:created_by(full_name)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data.map(a => ({
        id: a.id, title: a.title, body: a.content,
        audience: a.target_audience || "All Members",
        pinned: a.category === "pinned",
        is_published: a.is_published,
        created_date: a.created_at,
        author_name: a.profiles?.full_name || "Admin",
        created_by: a.created_by,
      }));
    },
  });

  // All users see "All Members" announcements + their unit announcements
  const visibleAnnouncements = announcements.filter(a => {
    if (isAdmin) return true;
    if (a.audience === "All Members") return true;
    if (effectiveScopes.includes(a.audience)) return true;
    if (a.created_by === user?.id) return true;
    // Regular members: check their church_unit
    if (myMember?.church_unit) {
      const units = myMember.church_unit.split(",").map(u => u.trim());
      if (units.includes(a.audience)) return true;
    }
    return false;
  });

  const filtered = visibleAnnouncements.filter(a =>
    `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const payload = {
        title: form.title, content: form.body,
        target_audience: form.audience,
        category: form.pinned ? "pinned" : null,
        is_published: true, created_by: user.id,
      };
      if (editing) {
        const { error } = await supabase.from("announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit("announcement_update", "announcements", editing.id, { title: form.title }, tenantId);
      } else {
        const { error } = await supabase.from("announcements").insert(withTenant(payload));
        if (error) throw error;
        await logAudit("announcement_create", "announcements", null, { title: form.title, audience: form.audience }, tenantId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: editing ? "Communication updated" : "Communication posted" });
      setEditing(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
      await logAudit("announcement_delete", "announcements", id, null, tenantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Communication deleted" });
    },
  });

  const handleEdit = (a) => {
    if (!isAdmin && a.created_by !== user?.id) return;
    setEditing(a); setFormOpen(true);
  };

  const handleDelete = (a) => {
    if (!isAdmin && a.created_by !== user?.id) return;
    if (confirm("Delete this communication?")) deleteMutation.mutate(a.id);
  };

  const canManage = (a) => isAdmin || a.created_by === user?.id;

  const availableAudiences = isAdmin ? AUDIENCES
    : effectiveScopes.length > 0 ? AUDIENCES.filter(a => effectiveScopes.includes(a)) : [];

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
          {canManage(a) && canManageComms && (
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
      <Tabs defaultValue={announcementsEnabled ? "announcements" : (emailEnabled ? "email" : (smsEnabled ? "sms" : "whatsapp"))} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="flex flex-nowrap h-auto gap-1 overflow-x-auto w-full justify-start">
            {announcementsEnabled && (
              <TabsTrigger value="announcements" className="gap-1.5 text-xs">
                <Megaphone className="h-3.5 w-3.5" /> Announcements
              </TabsTrigger>
            )}
            {canManageComms && (
              <>
                {emailEnabled && (
                  <TabsTrigger value="email" className="gap-1.5 text-xs">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </TabsTrigger>
                )}
                {smsEnabled && (
                  <TabsTrigger value="sms" className="gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" /> SMS
                  </TabsTrigger>
                )}
                {whatsappEnabled && (
                  <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
                    <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                  </TabsTrigger>
                )}
              </>
            )}
          </TabsList>
        </div>

        {announcementsEnabled && <TabsContent value="announcements">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search communications..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
              </div>
              {canManageComms && (
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" /> New Announcement
                </Button>
              )}
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
                      <p className="text-lg font-medium">No communications found</p>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>}

        {canManageComms && emailEnabled && (
          <TabsContent value="email">
            <EmailAlertForm
              currentUser={user}
              myUnits={leaderUnits}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}

        {canManageComms && smsEnabled && (
          <TabsContent value="sms">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button onClick={() => { setSmsAnnouncement(null); setSmsOpen(true); }} className="bg-primary hover:bg-primary/90">
                  <MessageSquare className="h-4 w-4 mr-2" /> Send Bulk SMS
                </Button>
              </div>
              <Card className="border-0 shadow-sm p-8 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Use the button above to compose and send SMS messages to members.</p>
              </Card>
            </div>
          </TabsContent>
        )}

        {canManageComms && whatsappEnabled && (
          <TabsContent value="whatsapp">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button onClick={() => setWaOpen(true)} className="bg-primary hover:bg-primary/90">
                  <WhatsAppIcon className="h-4 w-4 mr-2" /> Send Bulk WhatsApp
                </Button>
              </div>
              <Card className="border-0 shadow-sm p-8 text-center text-muted-foreground">
                <WhatsAppIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Use the button above to compose and send WhatsApp messages to members.</p>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <AnnouncementForm
        open={formOpen} onOpenChange={setFormOpen}
        announcement={editing}
        onSave={(form) => saveMutation.mutateAsync(form)}
        lockedAudience={lockedAudience}
        availableAudiences={availableAudiences}
      />

      <SMSDialog
        open={smsOpen} onOpenChange={setSmsOpen}
        prefillMessage={smsAnnouncement ? `${smsAnnouncement.title}: ${smsAnnouncement.body}` : ""}
        prefillAudience={smsAnnouncement?.audience || ""}
        smsType={smsAnnouncement ? "announcement" : "bulk"}
        referenceId={smsAnnouncement?.id || null}
        title={smsAnnouncement ? "Send as SMS" : "Bulk SMS"}
      />

      <SMSDialog
        open={waOpen} onOpenChange={setWaOpen}
        prefillMessage=""
        prefillAudience=""
        smsType="bulk"
        referenceId={null}
        title="Send Bulk WhatsApp"
        defaultChannel="whatsapp"
      />

      
    </div>
  );
}
