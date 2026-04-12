import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function TestimonyFormDialog({ open, onOpenChange, myMember }) {
  const { tenantId } = useTenantQuery();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "",
    situation: "",
    action: "",
    god_did: "",
  });

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
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error sending testimony", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-display">Share Your Testimony</DialogTitle>
        </DialogHeader>
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
              rows={3}
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
              rows={3}
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
              rows={3}
              maxLength={2000}
              required
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Submit Testimony
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
