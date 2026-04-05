import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function ReEngagementDialog({ open, onOpenChange, member }) {
  const [subject, setSubject] = useState(`We miss you, ${member?.name?.split(" ")[0] || ""}!`);
  const [body, setBody] = useState(
    `Dear ${member?.name || ""},\n\nWe noticed you haven't been with us recently and we wanted to reach out to let you know you are missed and loved.\n\nWe would love to see you back with us. Please do not hesitate to reach out if there is anything we can do to support you.\n\nGod bless you,\nWinners Chapel International Cardiff`
  );

  const recipientEmail = member?.email;

  useEffect(() => {
    if (member) {
      setSubject(`We miss you, ${member.name?.split(" ")[0] || ""}!`);
      setBody(
        `Dear ${member.name || ""},\n\nWe noticed you haven't been with us recently and we wanted to reach out to let you know you are missed and loved.\n\nWe would love to see you back with us. Please do not hesitate to reach out if there is anything we can do to support you.\n\nGod bless you,\nWinners Chapel International Cardiff`
      );
    }
  }, [member?.id, member?.name]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <TenantDialogHeader>
            <Mail className="h-4 w-4 text-primary" />
            Re-engagement Contact
          </TenantDialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Member</Label>
            <p className="text-sm font-medium text-foreground mt-1">
              {member?.name}
              {recipientEmail ? (
                <span className="text-muted-foreground font-normal ml-2">({recipientEmail})</span>
              ) : (
                <span className="text-destructive font-normal ml-2">(No email on file)</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} className="text-sm resize-none" />
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            Email sending requires email infrastructure to be configured. You can copy this message and send it manually, or set up email sending in your project settings.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
            <Button
              size="sm"
              onClick={() => {
                if (recipientEmail) {
                  window.open(`mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
                  toast({ title: "Opening email client..." });
                } else {
                  toast({ title: "No email address", description: "This member has no email on file.", variant: "destructive" });
                }
              }}
              disabled={!recipientEmail}
            >
              <Send className="h-4 w-4 mr-1" /> Open in Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
