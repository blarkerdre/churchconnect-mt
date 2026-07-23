import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Trash2, ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

export default function MyData() {
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenant();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [reason, setReason] = useState("");

  // Member record for consent toggles
  const { data: member } = useQuery({
    queryKey: ["my-member", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("*")
        .eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
      return data;
    },
  });

  const { data: erasure } = useQuery({
    queryKey: ["my-erasure", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("erasure_requests").select("*")
        .eq("user_id", user.id).eq("tenant_id", tenantId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const exportData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-member-data", { body: {} });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Your data has been downloaded" });
    } catch (e) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally { setExporting(false); }
  };

  const consentMutation = useMutation({
    mutationFn: async (updates) => {
      if (!member) throw new Error("No member record");
      const { error } = await supabase.from("members").update(updates)
        .eq("id", member.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-member"] });
      toast({ title: "Preferences updated" });
    },
    onError: (e) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const erasureMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("erasure_requests").insert({
        tenant_id: tenantId,
        user_id: user.id,
        member_id: member?.id ?? null,
        reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-erasure"] });
      setReason("");
      toast({ title: "Erasure request submitted", description: "Your church administrator has been notified." });
    },
    onError: (e) => toast({ title: "Failed to submit", description: e.message, variant: "destructive" }),
  });

  const openReason = () => window.dispatchEvent(new CustomEvent("open-cookie-preferences"));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> My Data
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your rights under UK GDPR. See our <Link to="/privacy" className="underline text-primary">Privacy Notice</Link> for details.
        </p>
      </div>

      <Tabs defaultValue="export">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger value="export">Download</TabsTrigger>
          <TabsTrigger value="rectify">Rectify</TabsTrigger>
          <TabsTrigger value="erase">Erase</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card>
            <CardHeader><CardTitle>Download my data</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Under Article 15 you can request a copy of the personal data we hold about you. The export is a JSON file including your member profile, attendance, follow-ups, pastoral notes, sermon notes, testimonies and communications logs.</p>
              <p className="text-muted-foreground text-xs">Limit: 3 exports per 24 hours.</p>
              <Button onClick={exportData} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Download my data (JSON)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rectify">
          <Card>
            <CardHeader><CardTitle>Correct my details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Most personal information can be updated from your profile. If something can't be changed there, ask your church administrator via the pastoral care form.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to={tenantSlug ? `/t/${tenantSlug}/my-profile` : "/my-profile"}>Edit my profile</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={tenantSlug ? `/t/${tenantSlug}/pastoral-care` : "/pastoral-care"}>Contact pastoral team</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="erase">
          <Card>
            <CardHeader><CardTitle>Request erasure</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {erasure && erasure.status !== "rejected" && (
                <Alert>
                  <AlertDescription>
                    You have a request from {new Date(erasure.created_at).toLocaleDateString()} — status:
                    {" "}<Badge variant={erasure.status === "completed" ? "default" : "secondary"}>{erasure.status}</Badge>
                    {erasure.review_note && <div className="text-xs mt-1">Note: {erasure.review_note}</div>}
                  </AlertDescription>
                </Alert>
              )}
              <p>Under Article 17 you can request deletion of your personal data. Your church administrator will review the request — some records (giving, attendance for statutory reports) may be retained under legal obligation.</p>
              <p className="text-muted-foreground text-xs">
                Approved requests anonymise your record and remove your personal artefacts. A 30-day recovery archive is kept then destroyed.
              </p>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Help us understand — this is optional." maxLength={500} />
              </div>
              <Button variant="destructive" onClick={() => erasureMutation.mutate()}
                disabled={erasureMutation.isPending || (erasure && ["pending", "approved"].includes(erasure.status))}>
                {erasureMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Submit erasure request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent">
          <Card>
            <CardHeader><CardTitle>Consent preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {member ? (
                <>
                  <ConsentRow
                    label="Marketing communications"
                    desc="Newsletters, event promotion, sermon summaries."
                    checked={!!member.consent_marketing}
                    onChange={(v) => consentMutation.mutate({ consent_marketing: v })}
                  />
                  <ConsentRow
                    label="Photos & media"
                    desc="Appear in service photos, videos, social posts."
                    checked={!!member.consent_photos}
                    onChange={(v) => consentMutation.mutate({ consent_photos: v })}
                  />
                  <ConsentRow
                    label="Pastoral contact"
                    desc="Leaders may reach out for prayer and welfare checks."
                    checked={!!member.consent_pastoral_contact}
                    onChange={(v) => consentMutation.mutate({ consent_pastoral_contact: v })}
                  />
                  <ConsentRow
                    label="Share with WCI network"
                    desc="Referrals to sister churches or global reports."
                    checked={!!member.consent_third_party_sharing}
                    onChange={(v) => consentMutation.mutate({ consent_third_party_sharing: v })}
                  />
                </>
              ) : (
                <p className="text-muted-foreground">No member record for this church yet.</p>
              )}
              <div className="border-t pt-3">
                <Button variant="outline" size="sm" onClick={openReason}>Manage cookie preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConsentRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
