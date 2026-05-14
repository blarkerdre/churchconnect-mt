import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { MemberAvatar } from "@/components/members/MemberAvatar";
import { format } from "date-fns";
import {
  X, Phone, Mail, MapPin, CheckCircle2, MessageSquarePlus, UserPlus, Loader2,
  ClipboardList, Users, Home, History, AlertCircle
} from "lucide-react";

const statusColors = {
  pending: "bg-accent/10 text-accent border-accent/20",
  contacted: "bg-primary/10 text-primary border-primary/20",
  engaged: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  joined: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  declined: "bg-muted text-muted-foreground border-border",
  closed: "bg-muted text-muted-foreground border-border",
};

const STATUS_OPTIONS = [
  { value: "contacted", label: "Contacted" },
  { value: "engaged", label: "In Progress / Engaged" },
  { value: "joined", label: "Joined / Completed" },
  { value: "declined", label: "Declined" },
  { value: "closed", label: "Closed" },
];

export default function SignPostDetailPanel({ open, onClose, referralId, onCreateFollowup }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [updateText, setUpdateText] = useState("");
  const [statusChange, setStatusChange] = useState("");
  const [acting, setActing] = useState(false);

  // Fetch full referral with member + centre
  const { data: referral, isLoading } = useQuery({
    queryKey: ["signpost-detail", referralId],
    enabled: !!referralId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followup_referrals")
        .select(`
          *,
          wsf_centres(id, name, location),
          members(
            id, first_name, last_name, phone, email, photo_url,
            membership_status, church_unit, wsf_centre_id, preferred_contact_modes,
            address, city, postcode
          )
        `)
        .eq("id", referralId)
        .maybeSingle();
      if (error) throw error;
      if (data?.referred_by) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", data.referred_by)
          .maybeSingle();
        data.referrer = prof;
      }
      return data;
    },
  });

  const { data: updates = [] } = useQuery({
    queryKey: ["signpost-updates", referralId],
    enabled: !!referralId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followup_referral_updates")
        .select("*")
        .eq("referral_id", referralId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const authorIds = [...new Set((data || []).map(u => u.author_id).filter(Boolean))];
      let profileMap = {};
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", authorIds);
        profileMap = Object.fromEntries((profs || []).map(p => [p.user_id, p]));
      }
      return (data || []).map(u => ({ ...u, author: profileMap[u.author_id] || null }));
    },
  });

  useEffect(() => {
    if (open) { setUpdateText(""); setStatusChange(""); }
  }, [open, referralId]);

  if (!open) return null;

  const member = referral?.members;
  const isUnit = referral?.referral_type === "unit_leader";
  const targetLabel = isUnit
    ? (referral?.target_unit_name || "Unit")
    : (referral?.wsf_centres?.name || "Home Cell");
  const TargetIcon = isUnit ? Users : Home;

  // Has the member already been added to this leader's unit/centre?
  const memberCurrentUnits = (member?.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
  const alreadyInUnit = isUnit && referral?.target_unit_name &&
    memberCurrentUnits.some(u => u.toLowerCase() === referral.target_unit_name.toLowerCase());
  const alreadyInCentre = !isUnit && referral?.target_wsf_centre_id &&
    member?.wsf_centre_id === referral.target_wsf_centre_id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["signpost-detail", referralId] });
    queryClient.invalidateQueries({ queryKey: ["signpost-updates", referralId] });
    queryClient.invalidateQueries({ queryKey: ["my-signposts"] });
    queryClient.invalidateQueries({ queryKey: ["signpost-inbox"] });
  };

  const postUpdate = async (text, status = null) => {
    const { error } = await supabase.from("followup_referral_updates").insert({
      tenant_id: referral.tenant_id,
      referral_id: referral.id,
      author_id: user.id,
      update_text: text,
      status_change: status,
    });
    if (error) throw error;
  };

  const handleAcknowledge = async () => {
    setActing(true);
    try {
      const leaderName = profile?.full_name || "Leader";
      await postUpdate(`Acknowledged by ${leaderName}. Will follow up soon.`, "contacted");
      toast({ title: "Acknowledged", description: "The referrer has been notified." });
      invalidate();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handlePostUpdate = async () => {
    if (!updateText.trim()) return;
    setActing(true);
    try {
      await postUpdate(updateText.trim(), statusChange || null);
      toast({ title: "Update posted", description: "The referrer has been notified." });
      setUpdateText(""); setStatusChange("");
      invalidate();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleAddToGroup = async () => {
    if (!member) return;
    setActing(true);
    try {
      let payload = {};
      let updateMsg = "";
      if (isUnit) {
        const target = referral.target_unit_name;
        const current = (member.church_unit || "").split(",").map(s => s.trim()).filter(Boolean);
        if (!current.some(u => u.toLowerCase() === target.toLowerCase())) {
          current.push(target);
        }
        payload = { church_unit: current.join(", ") };
        updateMsg = `Member added to unit: ${target}`;
      } else {
        payload = { wsf_centre_id: referral.target_wsf_centre_id, winners_satellite: true };
        updateMsg = `Member added to home cell: ${targetLabel}`;
      }
      const { error: updErr } = await supabase
        .from("members")
        .update(payload)
        .eq("id", member.id);
      if (updErr) throw updErr;
      await postUpdate(updateMsg, "joined");
      toast({ title: "Member added", description: updateMsg });
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const memberName = member ? `${member.first_name} ${member.last_name}` : "Member";
  const initials = member ? `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}` : "?";

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[60] animate-in fade-in"
        onClick={onClose}
      />
      <aside className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-background border-l border-border z-[61] flex flex-col shadow-2xl animate-in slide-in-from-right">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <TargetIcon className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sign-Post Referral</p>
              <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading || !referral ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* Member contact card */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    member={member}
                    alt={memberName}
                    className="h-12 w-12 rounded-full object-cover"
                    fallback={
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {initials}
                      </div>
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{memberName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {member?.membership_status || "Member"}
                      {member?.preferred_contact_modes && ` · Prefers ${member.preferred_contact_modes}`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  {member?.phone && (
                    <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {member.phone}
                    </a>
                  )}
                  {member?.email && (
                    <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> <span className="truncate">{member.email}</span>
                    </a>
                  )}
                  {(member?.address || member?.city) && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{[member.address, member.city, member.postcode].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>

                {(member?.church_unit || member?.wsf_centre_id) && (
                  <div className="pt-2 border-t border-border space-y-1">
                    {member?.church_unit && (
                      <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Units:</span> {member.church_unit}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Referral context */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Referral</p>
                  <Badge className={`text-[10px] border ${statusColors[referral.status] || ""}`}>{referral.status}</Badge>
                </div>
                <div className="text-xs space-y-1">
                  <p><span className="text-muted-foreground">Type:</span> <span className="font-medium">{isUnit ? "Unit Leader" : "Home Cell Leader"}</span></p>
                  <p><span className="text-muted-foreground">Target:</span> <span className="font-medium">{targetLabel}</span></p>
                  <p><span className="text-muted-foreground">From:</span> <span className="font-medium">{referral.referrer?.full_name || referral.referrer?.email || "Follow-up team"}</span></p>
                  <p><span className="text-muted-foreground">Date:</span> {format(new Date(referral.created_at), "dd MMM yyyy")}</p>
                </div>
                {referral.notes && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[11px] text-muted-foreground mb-1">Original notes</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap bg-background/60 rounded p-2">{referral.notes}</p>
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3" /> Actions
                </p>

                {referral.status === "pending" && (
                  <Button
                    onClick={handleAcknowledge}
                    disabled={acting}
                    className="w-full h-9 text-xs"
                    variant="default"
                  >
                    {acting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Acknowledge Referral
                  </Button>
                )}

                <Button
                  onClick={handleAddToGroup}
                  disabled={acting || alreadyInUnit || alreadyInCentre || !member}
                  variant="outline"
                  className="w-full h-9 text-xs"
                >
                  {acting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1.5" />}
                  {(alreadyInUnit || alreadyInCentre)
                    ? `Already in ${targetLabel}`
                    : `Add to ${targetLabel}`}
                </Button>

                {onCreateFollowup && (
                  <Button
                    onClick={() => onCreateFollowup(referral)}
                    variant="outline"
                    className="w-full h-9 text-xs"
                  >
                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                    Create Follow-up Task
                  </Button>
                )}
              </div>

              {/* Post update */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <MessageSquarePlus className="h-3 w-3" /> Post Update
                </p>
                <Textarea
                  value={updateText}
                  onChange={(e) => setUpdateText(e.target.value)}
                  placeholder="What progress have you made? Any blockers?"
                  rows={3}
                  className="text-sm"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusChange} onValueChange={setStatusChange}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Keep current status" />
                    </SelectTrigger>
                    <SelectContent className="z-[80]" position="popper" sideOffset={4}>
                      {STATUS_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handlePostUpdate}
                    disabled={acting || !updateText.trim()}
                    size="sm"
                    className="h-8 text-xs"
                  >
                    {acting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    Post
                  </Button>
                </div>
              </div>

              {/* History timeline */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-3">
                  <History className="h-3 w-3" /> History ({updates.length})
                </p>
                {updates.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No updates yet. Be the first to acknowledge or post.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {updates.map(u => (
                      <div key={u.id} className="border-l-2 border-primary/30 pl-3 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[11px] font-medium text-foreground">
                            {u.author?.full_name || "Unknown"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(u.created_at), "dd MMM yyyy · HH:mm")}
                          </p>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap">{u.update_text}</p>
                        {u.status_change && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            → {u.status_change}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}
