import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";

export default function TestimonyFormDialog({ open, onOpenChange, myMember }) {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "",
    title: "",
    situation: "",
    action: "",
    god_did: "",
    share_publicly: false,
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
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
          title: form.title.trim(),
          situation: form.situation.trim(),
          action: form.action.trim(),
          god_did: form.god_did.trim(),
          share_publicly: form.share_publicly,
          sender_email: myMember?.email || null,
          user_id: user?.id || null,
        },
      });
      if (error) throw error;
      toast({ title: "Testimony shared!", description: "Thank you for sharing what the Lord has done." });
      setForm({ name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "", title: "", situation: "", action: "", god_did: "", share_publicly: false });
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
            <Label className="text-sm font-medium">Testimony Title</Label>
            <Input value={form.title} onChange={set("title")} placeholder="Give your testimony a title..." maxLength={200} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">What was the situation?</Label>
            <Textarea value={form.situation} onChange={set("situation")} placeholder="Describe the challenge or circumstance you faced..." rows={3} maxLength={2000} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">What did you do?</Label>
            <Textarea value={form.action} onChange={set("action")} placeholder="What steps of faith did you take..." rows={3} maxLength={2000} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">What has the Lord done?</Label>
            <Textarea value={form.god_did} onChange={set("god_did")} placeholder="Share how God moved in your situation..." rows={3} maxLength={2000} required />
          </div>
          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="dialog_share_publicly"
              checked={form.share_publicly}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, share_publicly: !!checked }))}
            />
            <Label htmlFor="dialog_share_publicly" className="text-sm leading-snug cursor-pointer">
              I would like my testimony to be shared in church
            </Label>
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
