import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquareHeart } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

export default function Testimony() {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      const { data } = await supabase
        .from("members")
        .select("first_name, last_name, email")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!tenantId,
  });

  const [form, setForm] = useState({
    name: "",
    situation: "",
    action: "",
    god_did: "",
  });

  // Update name when myMember loads
  React.useEffect(() => {
    if (myMember) {
      setForm((f) => ({ ...f, name: `${myMember.first_name} ${myMember.last_name}` }));
    }
  }, [myMember]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.situation.trim() || !form.action.trim() || !form.god_did.trim()) {
      toast({ title: "Please fill in all three fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("send-testimony", {
        body: {
          tenant_id: tenantId,
          member_name: form.name.trim() || "Anonymous",
          situation: form.situation.trim(),
          action: form.action.trim(),
          god_did: form.god_did.trim(),
          sender_email: myMember?.email || null,
        },
      });
      if (error) throw error;
      toast({ title: "Testimony shared!", description: "Thank you for sharing what the Lord has done." });
      setForm({ name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "", situation: "", action: "", god_did: "" });
    } catch (err) {
      toast({ title: "Error sending testimony", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Share Your Testimony</h1>
        <p className="text-sm text-muted-foreground mt-1">Tell us what the Lord has done in your life</p>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <MessageSquareHeart className="h-5 w-5 text-accent" />
            </div>
            <CardTitle className="text-lg font-semibold">Your Testimony</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Your Name</Label>
              <Input value={form.name} onChange={set("name")} placeholder="Your name (optional)" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What was the situation?</Label>
              <Textarea
                value={form.situation}
                onChange={set("situation")}
                placeholder="Describe the challenge or circumstance you faced..."
                rows={4}
                maxLength={2000}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What did you do?</Label>
              <Textarea
                value={form.action}
                onChange={set("action")}
                placeholder="What steps of faith did you take..."
                rows={4}
                maxLength={2000}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What has the Lord done?</Label>
              <Textarea
                value={form.god_did}
                onChange={set("god_did")}
                placeholder="Share how God moved in your situation..."
                rows={4}
                maxLength={2000}
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Testimony
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
