import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ReEngagementDialog({ open, onOpenChange, member }) {
  const [subject, setSubject] = useState(`We miss you, ${member?.name?.split(" ")[0] || ""}!`);
  const [body, setBody] = useState(
    `Dear ${member?.name || ""},\n\nWe noticed you haven't been with us recently and we wanted to reach out to let you know you are missed and loved.\n\nWe would love to see you back with us. Please do not hesitate to reach out if there is anything we can do to support you.\n\nGod bless you,\nWinners Chapel International Cardiff`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const recipientEmail = member?.email;

  const handleSend = async () => {
    if (!recipientEmail) {
      setError("No email address found for this member.");
      return;
    }
    setSending(true);
    setError("");
    await base44.integrations.Core.SendEmail({
      to: recipientEmail,
      subject,
      body: body.replace(/\n/g, "<br/>"),
      from_name: "Winners Chapel International Cardiff",
    });
    setSending(false);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onOpenChange(false);
    }, 1500);
  };

  // Reset when member changes
  React.useEffect(() => {
    if (member) {
      setSubject(`We miss you, ${member.name?.split(" ")[0] || ""}!`);
      setBody(
        `Dear ${member.name || ""},\n\nWe noticed you haven't been with us recently and we wanted to reach out to let you know you are missed and loved.\n\nWe would love to see you back with us. Please do not hesitate to reach out if there is anything we can do to support you.\n\nGod bless you,\nWinners Chapel International Cardiff`
      );
      setSent(false);
      setError("");
    }
  }, [member?.id, member?.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#1e3a5f]" />
            Send Re-engagement Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-slate-500">To</Label>
            <p className="text-sm font-medium text-slate-700 mt-1">
              {member?.name}
              {recipientEmail ? (
                <span className="text-slate-400 font-normal ml-2">({recipientEmail})</span>
              ) : (
                <span className="text-red-400 font-normal ml-2">(No email on file)</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Message</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={8}
              className="text-sm resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#1e3a5f] hover:bg-[#152d4a] gap-2"
              onClick={handleSend}
              disabled={sending || sent || !recipientEmail}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? "✓ Sent!" : <><Send className="h-4 w-4" /> Send Email</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}