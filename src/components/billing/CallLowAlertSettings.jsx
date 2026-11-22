import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Bell, Loader2 } from "lucide-react";

const CHANNELS = [["in_app", "Bell alert"], ["email", "Email"], ["sms", "Text message"]];
const WHO = [["owner", "Church owners"], ["admin", "Church admins"]];

export default function CallLowAlertSettings({ tenantId, initial }) {
  const { toast } = useToast();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setS({ enabled: true, threshold: 30, channels: ["in_app", "email"], recipients: ["owner", "admin"], template: "", ...(initial || {}) });
  }, [initial]);
  if (!s) return null;
  const toggle = (k, v) => setS((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("tenants").update({ call_low_alert_settings: { ...s, threshold: Number(s.threshold) } }).eq("id", tenantId);
    setSaving(false);
    toast(error ? { title: "Couldn't save", description: error.message, variant: "destructive" } : { title: "Low minutes alert saved" });
  };
  const test = async () => {
    setTesting(true);
    const { error } = await supabase.functions.invoke("notify-low-call-minutes", { body: { tenant_id: tenantId } });
    setTesting(false);
    toast(error ? { title: "Couldn't send test", description: error.message, variant: "destructive" } : { title: "Test sent to you", description: "Using the saved settings." });
  };

  return (
    <div className="border-t border-border/50 pt-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium flex items-center gap-2"><Bell className="h-4 w-4 text-accent" /> Low minutes alert</p>
        <Switch checked={!!s.enabled} onCheckedChange={(v) => setS({ ...s, enabled: v })} aria-label="Turn low minutes alert on or off" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="low-thr" className="text-xs">Alert when minutes left drop to</Label>
        <Input id="low-thr" type="number" min={1} max={10000} value={s.threshold} onChange={(e) => setS({ ...s, threshold: e.target.value })} className="w-24 h-9" />
        <span className="text-xs text-muted-foreground">minutes</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><p className="text-xs font-medium">Send by</p>
          {CHANNELS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs"><Checkbox checked={s.channels.includes(k)} onCheckedChange={() => toggle("channels", k)} />{l}</label>)}
        </div>
        <div className="space-y-1"><p className="text-xs font-medium">Send to</p>
          {WHO.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-xs"><Checkbox checked={s.recipients.includes(k)} onCheckedChange={() => toggle("recipients", k)} />{l}</label>)}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="low-msg" className="text-xs">Your message (optional)</Label>
        <Textarea id="low-msg" maxLength={300} rows={2} value={s.template} onChange={(e) => setS({ ...s, template: e.target.value })}
          placeholder="Only {minutes_left} call minutes left for {church_name}. Please top up." />
        <p className="text-xs text-muted-foreground">Use {"{minutes_left}"} and {"{church_name}"}. Leave blank for the standard wording. A separate alert is always sent when minutes run out.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save alert</Button>
        <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Send test to me</Button>
      </div>
    </div>
  );
}
