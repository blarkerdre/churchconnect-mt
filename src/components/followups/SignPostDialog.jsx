import React, { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Home, Sparkles, MapPin, UserCircle2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { suggestClosestWSFCentre } from "@/lib/wsf-suggest";

export default function SignPostDialog({ open, onOpenChange, followup, member, onCreated, defaultType = "unit_leader" }) {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { user } = useAuth();
  const [type, setType] = useState(defaultType);

  useEffect(() => {
    if (open) setType(defaultType);
  }, [open, defaultType]);

  const [unitName, setUnitName] = useState("");
  const [unitLeaderId, setUnitLeaderId] = useState("");
  const [centreId, setCentreId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Church units
  const { data: units = [] } = useQuery({
    queryKey: ["church-units-active", tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("church_units").select("id, name").eq("is_active", true).order("name")
      );
      if (error) throw error;
      return data;
    },
  });

  // Unit leaders for the selected unit
  const { data: unitLeaders = [] } = useQuery({
    queryKey: ["unit-leaders", tenantId, unitName],
    enabled: open && !!tenantId && !!unitName && type === "unit_leader",
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("unit_leader_assignments").select("user_id").eq("unit_name", unitName)
      );
      if (error) throw error;
      const ids = [...new Set((data || []).map(r => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
      return profs || [];
    },
  });

  // Home cell centres
  const { data: centres = [] } = useQuery({
    queryKey: ["wsf-centres-active", tenantId],
    enabled: open && !!tenantId && type === "home_cell_leader",
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("wsf_centres").select("*").eq("is_active", true).order("name")
      );
      if (error) throw error;
      return data;
    },
  });

  // Suggest closest centre once when switching to home cell type
  const suggestedOnceRef = useRef(false);
  useEffect(() => {
    if (!open) { suggestedOnceRef.current = false; return; }
    if (type !== "home_cell_leader") return;
    if (suggestedOnceRef.current) return;
    if (!centres.length || !member) return;
    const suggestion = suggestClosestWSFCentre(centres, {
      postcode: member.postcode,
      address: member.address,
      city: member.city,
    });
    if (suggestion) {
      setCentreId(suggestion.id);
    }
    suggestedOnceRef.current = true;
  }, [open, type, centres, member]);

  const selectedCentre = useMemo(() => centres.find(c => c.id === centreId), [centres, centreId]);
  const suggestedCentre = useMemo(() => {
    if (!member || !centres.length) return null;
    return suggestClosestWSFCentre(centres, {
      postcode: member.postcode,
      address: member.address,
      city: member.city,
    });
  }, [centres, member]);

  // Resolve the leader for the currently-selected centre (members.id -> profiles)
  const { data: centreLeader } = useQuery({
    queryKey: ["centre-leader", selectedCentre?.leader_id, tenantId],
    enabled: !!selectedCentre?.leader_id,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("members")
        .select("user_id, first_name, last_name")
        .eq("id", selectedCentre.leader_id)
        .maybeSingle();
      const fallbackName = `${m?.first_name ?? ""} ${m?.last_name ?? ""}`.trim() || null;
      if (!m?.user_id) return { name: fallbackName, linked: false };
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", m.user_id)
        .maybeSingle();
      return { name: p?.full_name || fallbackName || p?.email, linked: true };
    },
  });

  // Toast guards (fire once per relevant change)
  const noUnitLeadersToastRef = useRef(null);
  useEffect(() => {
    if (type !== "unit_leader" || !unitName) return;
    const key = `${unitName}:${unitLeaders.length}`;
    if (noUnitLeadersToastRef.current === key) return;
    if (unitLeaders.length === 0) {
      toast({
        title: "No leaders assigned",
        description: "This unit has no leaders yet. Ask an admin to assign one.",
        variant: "destructive",
      });
    }
    noUnitLeadersToastRef.current = key;
  }, [type, unitName, unitLeaders]);

  const noCentresToastRef = useRef(false);
  const noSuggestionToastRef = useRef(false);
  useEffect(() => {
    if (!open || type !== "home_cell_leader") {
      noCentresToastRef.current = false;
      noSuggestionToastRef.current = false;
      return;
    }
    if (centres.length === 0 && !noCentresToastRef.current) {
      toast({ title: "No home cell centres", description: "No centres are configured yet.", variant: "destructive" });
      noCentresToastRef.current = true;
      return;
    }
    if (centres.length > 0 && member && !suggestedCentre && !noSuggestionToastRef.current) {
      toast({ title: "No closest match", description: "Pick a centre manually below." });
      noSuggestionToastRef.current = true;
    }
  }, [open, type, centres, member, suggestedCentre]);

  const noLeaderLinkedToastRef = useRef(null);
  useEffect(() => {
    if (!selectedCentre || !centreLeader) return;
    if (noLeaderLinkedToastRef.current === selectedCentre.id) return;
    if (!centreLeader.linked) {
      toast({
        title: "Centre has no linked leader",
        description: "This centre's leader is not linked to a user account and cannot be notified.",
        variant: "destructive",
      });
    }
    noLeaderLinkedToastRef.current = selectedCentre.id;
  }, [selectedCentre, centreLeader]);

  const reset = () => {
    setType("unit_leader");
    setUnitName("");
    setUnitLeaderId("");
    setCentreId("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!followup || !tenantId) return;

    let assignedLeader = null;
    let payload = {
      tenant_id: tenantId,
      followup_id: followup.id,
      member_id: followup.member_id || null,
      referral_type: type,
      notes: notes || null,
      referred_by: user.id,
      status: "pending",
    };

    if (type === "unit_leader") {
      if (!unitName) return toast({ title: "Choose a unit", variant: "destructive" });
      if (!unitLeaderId) return toast({ title: "Choose a unit leader", variant: "destructive" });
      assignedLeader = unitLeaderId;
      payload.target_unit_name = unitName;
      payload.assigned_leader_id = assignedLeader;
    } else {
      if (!centreId) return toast({ title: "Choose a home cell centre", variant: "destructive" });
      const centre = centres.find(c => c.id === centreId);
      if (!centre?.leader_id) {
        return toast({ title: "This centre has no leader assigned", variant: "destructive" });
      }
      // centre.leader_id refers to a member id; resolve to user_id
      const { data: leaderMember } = await supabase
        .from("members")
        .select("user_id")
        .eq("id", centre.leader_id)
        .maybeSingle();
      if (!leaderMember?.user_id) {
        return toast({ title: "Centre leader is not linked to a user account", variant: "destructive" });
      }
      assignedLeader = leaderMember.user_id;
      payload.target_wsf_centre_id = centreId;
      payload.assigned_leader_id = assignedLeader;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("followup_referrals").insert(payload);
      if (error) throw error;
      toast({ title: "Sign-posted", description: "The leader has been notified." });
      reset();
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <Sparkles className="h-4 w-4" /> Sign-Post {followup?.person_name || "Member"}
        </TenantDialogHeader>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType("unit_leader")}
              className={`p-3 rounded-xl border text-left transition-colors ${
                type === "unit_leader"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Users className="h-4 w-4 text-primary mb-1" />
              <p className="text-sm font-semibold">Unit Leader</p>
              <p className="text-xs text-muted-foreground">Choose a church unit</p>
            </button>
            <button
              type="button"
              onClick={() => setType("home_cell_leader")}
              className={`p-3 rounded-xl border text-left transition-colors ${
                type === "home_cell_leader"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Home className="h-4 w-4 text-primary mb-1" />
              <p className="text-sm font-semibold">Home Cell</p>
              <p className="text-xs text-muted-foreground">Closest centre</p>
            </button>
          </div>

          {type === "unit_leader" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Church Unit</Label>
                <Select value={unitName} onValueChange={(v) => { setUnitName(v); setUnitLeaderId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {unitName && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Leader to assign</span>
                    <span className="text-[10px] text-muted-foreground">
                      {unitLeaders.length} {unitLeaders.length === 1 ? "leader" : "leaders"}
                    </span>
                  </Label>
                  {unitLeaders.length === 0 ? (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive">
                        No leaders assigned to this unit yet. Ask an admin to assign one.
                      </p>
                    </div>
                  ) : (
                    <Select value={unitLeaderId} onValueChange={setUnitLeaderId}>
                      <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                      <SelectContent>
                        {unitLeaders.map(l => (
                          <SelectItem key={l.user_id} value={l.user_id}>
                            {l.full_name || l.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </>
          )}

          {type === "home_cell_leader" && (
            <div className="space-y-2">
              {suggestedCentre && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-primary">Suggested: {suggestedCentre.name}</p>
                  </div>
                  {(suggestedCentre.address || suggestedCentre.postcode || suggestedCentre.location) && (
                    <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>
                        {suggestedCentre.address || suggestedCentre.location}
                        {suggestedCentre.postcode ? ` · ${suggestedCentre.postcode}` : ""}
                      </span>
                    </p>
                  )}
                  {centreId !== suggestedCentre.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setCentreId(suggestedCentre.id)}
                    >
                      Use this centre
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center justify-between">
                  <span>Home Cell Centre</span>
                  {suggestedCentre && centreId === suggestedCentre.id && (
                    <span className="text-[10px] text-primary font-medium">✨ Closest match</span>
                  )}
                </Label>
                <Select value={centreId} onValueChange={setCentreId}>
                  <SelectTrigger><SelectValue placeholder="Select centre" /></SelectTrigger>
                  <SelectContent>
                    {centres.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.location ? `— ${c.location}` : c.city ? `— ${c.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCentre && (
                  <div className="space-y-1 pt-1">
                    {(selectedCentre.address || selectedCentre.location) && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          {selectedCentre.address || selectedCentre.location}
                          {selectedCentre.postcode ? ` · ${selectedCentre.postcode}` : ""}
                        </span>
                      </p>
                    )}
                    {centreLeader?.linked ? (
                      <p className="text-xs text-foreground flex items-center gap-1">
                        <UserCircle2 className="h-3 w-3 shrink-0 text-primary" />
                        <span>Leader: <strong>{centreLeader.name}</strong></span>
                      </p>
                    ) : selectedCentre.leader_id ? (
                      <p className="text-xs text-destructive flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          {centreLeader?.name ? `${centreLeader.name} is not linked to a user account.` : "Centre leader has no linked account."}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-destructive flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>No leader assigned to this centre.</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes for the leader (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Context, prayer requests, or background info..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sign-Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
