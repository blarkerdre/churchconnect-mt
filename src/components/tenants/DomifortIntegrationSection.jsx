import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Plus, KeyRound, ShieldCheck, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";

const SUPABASE_PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const INGEST_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/domifort-bookings-ingest`;

function CopyButton({ value, label = "Copy" }) {
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast({ title: "Copied", description: label });
        } catch {
          toast({ title: "Copy failed", variant: "destructive" });
        }
      }}
    >
      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
    </Button>
  );
}

function SecretReveal({ value }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 font-mono text-xs bg-muted p-2 rounded break-all">
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <span className="flex-1">{show ? value : "•".repeat(Math.min(value.length, 40))}</span>
      <CopyButton value={value} />
    </div>
  );
}

export default function DomifortIntegrationSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // { token, plaintext }
  const [revokeTarget, setRevokeTarget] = useState(null);

  const { data: tokens = [], isLoading: tokensLoading } = useQuery({
    queryKey: ["domifort-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domifort_api_tokens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["domifort-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domifort_bookings")
        .select("id, external_ref, status, customer_name, customer_email, service_type, booking_start, location, tenant_id, received_at")
        .order("received_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["domifort-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domifort_ingest_log")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("domifort_api_tokens")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Token revoked" });
      qc.invalidateQueries({ queryKey: ["domifort-tokens"] });
      setRevokeTarget(null);
    },
    onError: (err) => toast({ title: "Failed to revoke", description: err.message, variant: "destructive" }),
  });

  async function handleCreate() {
    if (!label.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("domifort-token-create", {
        body: { label: label.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCreated(data);
      setLabel("");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["domifort-tokens"] });
    } catch (err) {
      toast({ title: "Failed to create token", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  const curlSample = useMemo(() => {
    return `# Compute signature in your language of choice (example: Node.js)
# const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(rawBody).digest('hex');

curl -X POST '${INGEST_URL}' \\
  -H 'Authorization: Bearer df_live_<your-token>' \\
  -H 'X-CMS-Signature: <hex-hmac-sha256-of-body>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "bookings": [
      {
        "external_ref": "DF-12345",
        "status": "confirmed",
        "customer_name": "Jane Doe",
        "customer_email": "jane@example.com",
        "service_type": "transportation",
        "booking_start": "2026-05-01T10:00:00Z",
        "location": "Cardiff",
        "amount": 25.00,
        "currency": "GBP",
        "tenant_slug": "cardiff"
      }
    ]
  }'`;
  }, []);

  const nodeSample = `import crypto from 'crypto';

const body = JSON.stringify({ bookings: [/* ... */] });
const signature = crypto
  .createHmac('sha256', process.env.CMS_SIGNING_SECRET)
  .update(body)
  .digest('hex');

await fetch('${INGEST_URL}', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${process.env.CMS_BEARER_TOKEN}\`,
    'X-CMS-Signature': signature,
    'Content-Type': 'application/json',
  },
  body,
});`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                DomiFort Integration
              </CardTitle>
              <CardDescription>
                Global API tokens & inbound bookings webhook. Visible to super admins only.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tokens">
            <TabsList>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="endpoint">Endpoint</TabsTrigger>
              <TabsTrigger value="bookings">Recent bookings</TabsTrigger>
              <TabsTrigger value="logs">Ingest log</TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" className="mt-4">
              {tokensLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tokens yet. Create one to allow DomiFort to post bookings.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last used</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.label}</TableCell>
                          <TableCell className="font-mono text-xs">{t.token_prefix}…</TableCell>
                          <TableCell>
                            {t.is_active ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Revoked</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>{t.request_count ?? 0}</TableCell>
                          <TableCell className="text-xs">
                            {new Date(t.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {t.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevokeTarget(t)}
                              >
                                Revoke
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="endpoint" className="mt-4 space-y-4">
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Webhook URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">{INGEST_URL}</code>
                  <CopyButton value={INGEST_URL} />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Required headers</Label>
                <ul className="text-sm mt-1 space-y-1">
                  <li><code>Authorization: Bearer &lt;token&gt;</code></li>
                  <li><code>X-CMS-Signature: &lt;hex HMAC-SHA256 of raw body using signing secret&gt;</code></li>
                  <li><code>Content-Type: application/json</code></li>
                </ul>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">curl example</Label>
                <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-auto">{curlSample}</pre>
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Node.js example</Label>
                <pre className="text-xs bg-muted p-3 rounded mt-1 overflow-auto">{nodeSample}</pre>
              </div>
              <Alert>
                <AlertTitle>Schema</AlertTitle>
                <AlertDescription className="text-xs">
                  Mirrors DomiFort's <code>src/routes/api/public/cms/bookings.ts</code>. Required: <code>external_ref</code> (used as upsert key).
                  Optional: status, customer_name, customer_email, customer_phone, service_type, booking_start, booking_end,
                  location, amount, currency, tenant_slug. Full payload is stored in <code>payload</code> for forward compatibility.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              {bookingsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings ingested yet.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Received</TableHead>
                        <TableHead>External ref</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Tenant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-xs">{new Date(b.received_at).toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs">{b.external_ref}</TableCell>
                          <TableCell>
                            <div className="text-sm">{b.customer_name || "—"}</div>
                            {b.customer_email && (
                              <div className="text-xs text-muted-foreground">{b.customer_email}</div>
                            )}
                          </TableCell>
                          <TableCell>{b.status || "—"}</TableCell>
                          <TableCell className="text-xs">{b.service_type || "—"}</TableCell>
                          <TableCell className="text-xs">{b.tenant_id ? "Routed" : "Unrouted"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              {logsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Auth</TableHead>
                        <TableHead>Signature</TableHead>
                        <TableHead>External ref</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{new Date(l.received_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={l.status_code < 400 ? "default" : "destructive"}>
                              {l.status_code}
                            </Badge>
                          </TableCell>
                          <TableCell>{l.auth_valid ? "✓" : "✗"}</TableCell>
                          <TableCell>{l.signature_valid ? "✓" : "✗"}</TableCell>
                          <TableCell className="font-mono text-xs">{l.external_ref || "—"}</TableCell>
                          <TableCell className="text-xs text-destructive">{l.error || ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create DomiFort API token</DialogTitle>
            <DialogDescription>
              Generates a bearer token and HMAC signing secret. They will be shown only once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="df-label">Label</Label>
            <Input
              id="df-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. DomiFort Production"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time reveal dialog */}
      <Dialog open={!!created} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Token created</DialogTitle>
            <DialogDescription>
              Copy these values now. They will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Save before closing</AlertTitle>
                <AlertDescription>
                  Once you close this dialog the bearer token and signing secret cannot be retrieved.
                </AlertDescription>
              </Alert>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Bearer token</Label>
                <SecretReveal value={created.plaintext.bearer_token} />
              </div>
              <div>
                <Label className="text-xs uppercase text-muted-foreground">Signing secret (HMAC key)</Label>
                <SecretReveal value={created.plaintext.signing_secret} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>I've saved them</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.label} ({revokeTarget?.token_prefix}…) will stop working immediately.
              This cannot be undone — DomiFort will need to be issued a new token.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
