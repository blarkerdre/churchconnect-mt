import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Send, Mail, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const availableAudiences = isAdmin ? AUDIENCES : AUDIENCES.filter(a => myUnits.includes(a));

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || !audience) return;
    setSending(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("sendEmailAlert", { subject, body, audience });
      setResult({ success: true, sent: res.data.sent, total: res.data.total, message: res.data.message });
      if (res.data.sent > 0) {
        setSubject("");
        setBody("");
      }
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-0 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Mail className="h-4 w-4 text-[#1e3a5f]" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Compose Email Alert</p>
            <p className="text-xs text-slate-400">Send an email notification directly to members</p>
          </div>
        </div>

        {/* Audience */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Audience
          </label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger>
              <SelectValue placeholder="Select audience" />
            </SelectTrigger>
            <SelectContent>
              {availableAudiences.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Subject</label>
          <Input
            placeholder="Email subject..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">Message</label>
          <Textarea
            placeholder="Write your message here..."
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            className="resize-none"
          />
        </div>

        {/* Result feedback */}
        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${result.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {result.success
              ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            }
            <span>
              {result.success
                ? result.message || `Email sent to ${result.sent} of ${result.total} recipients.`
                : `Failed: ${result.message}`
              }
            </span>
          </div>
        )}

        <Button
          onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim()}
          className="bg-[#1e3a5f] hover:bg-[#152d4a] w-full sm:w-auto"
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Sending..." : "Send Email Alert"}
        </Button>
      </Card>
    </div>
  );
}