import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EXPIRY_OPTIONS = [
  { value: "0", label: "No expiry" },
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "24 hours" },
];

export default function BroadcastAlertSection() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = roles?.includes("super_admin");

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("all"); // "all" or tenant id
  const [expiry, setExpiry] = useState("60");
  const [sending, setSending] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["all-tenants-for-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  const { data: recent = [], refetch } = useQuery({
    queryKey: ["platform-alerts-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_alerts")
        .select("*, tenants(name)")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) return null;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    setSending(true);
    const minutes = parseInt(expiry, 10);
    const expires_at =
      minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
    const { error } = await supabase.from("platform_alerts").insert({
      title: title.trim() || null,
      message: message.trim(),
      tenant_id: target === "all" ? null : target,
      created_by: user.id,
      expires_at,
      active: true,
    });
    setSending(false);
    if (error) {
      toast.error("Failed to send alert: " + error.message);
      return;
    }
    toast.success("Alert broadcast sent");
    setTitle("");
    setMessage("");
    refetch();
  };

  const handleDeactivate = async (id) => {
    const { error } = await supabase
      .from("platform_alerts")
      .update({ active: false })
      .eq("id", id);
    if (error) {
      toast.error("Failed to deactivate: " + error.message);
      return;
    }
    toast.success("Alert deactivated");
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Broadcast On-Screen Alert
        </CardTitle>
        <CardDescription>
          Send a live overlay alert to all logged-in users across all tenants, or
          target a single tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Target</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants (global broadcast)</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Auto-expire</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Title (optional)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled maintenance"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Message *</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Write the alert users will see on screen..."
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sending || !message.trim()}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Alert
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-foreground mb-2">Recent alerts</p>
            <div className="space-y-2">
              {recent.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">
                        {a.title || a.message.slice(0, 60)}
                      </span>
                      <Badge variant={a.active ? "default" : "secondary"} className="text-[10px]">
                        {a.active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {a.tenant_id ? (a.tenants?.name || "Tenant") : "All tenants"}
                      </Badge>
                      {a.expires_at && (
                        <span className="text-[10px] text-muted-foreground">
                          expires {new Date(a.expires_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {a.message}
                    </p>
                  </div>
                  {a.active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeactivate(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
