import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Send, Mail, Users, Info } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const AUDIENCES = [
  "All Members", "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation"
];

export default function EmailAlertForm({ currentUser, myUnits = [], isAdmin }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(isAdmin ? "All Members" : (myUnits[0] || "All Members"));

  const availableAudiences = isAdmin ? AUDIENCES : AUDIENCES.filter(a => myUnits.includes(a));

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-0 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Compose Email Alert</p>
            <p className="text-xs text-muted-foreground">Send an email notification directly to members</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Audience
          </label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
            <SelectContent>
              {availableAudiences.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subject</label>
          <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Message</label>
          <Textarea placeholder="Write your message here..." value={body} onChange={e => setBody(e.target.value)} rows={6} className="resize-none" />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Email sending requires email infrastructure to be configured. Set up an email domain in your project settings to enable sending.</span>
        </div>

        <Button
          onClick={() => toast({ title: "Email infrastructure required", description: "Please configure email sending in your project settings first.", variant: "destructive" })}
          disabled={!subject.trim() || !body.trim()}
          className="w-full sm:w-auto"
        >
          <Send className="h-4 w-4 mr-2" /> Send Email Alert
        </Button>
      </Card>
    </div>
  );
}
