import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";

const STATUSES = ["pending", "contacted", "engaged", "joined", "declined", "closed"];

export default function ReferralUpdateDialog({ open, onOpenChange, referral, onSaved }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && referral) {
      setText("");
      setStatus("");
    }
  }, [open, referral]);

  const handleSubmit = async () => {
    if (!referral || !text.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("followup_referral_updates").insert({
        tenant_id: referral.tenant_id,
        referral_id: referral.id,
        author_id: user.id,
        update_text: text.trim(),
        status_change: status || null,
      });
      if (error) throw error;
      toast({ title: "Update added" });
      onSaved?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <MessageSquarePlus className="h-4 w-4" /> Add Progress Update
        </TenantDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Update</Label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What progress have you made? Any blockers or next steps?"
              rows={4}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status (optional)</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Keep current status" /></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !text.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Update
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
