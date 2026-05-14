import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Key, Plus, Copy, Trash2, Loader2, AlertTriangle } from "lucide-react";

export default function ApiKeysSection() {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["tenant-api-keys", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_api_keys")
        .select("id, label, key_prefix, is_active, last_used_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (keyLabel) => {
      const { data, error } = await supabase.functions.invoke("create-tenant-api-key", {
        body: { tenant_id: tenantId, label: keyLabel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
      setShowCreate(false);
      setLabel("");
      setNewlyCreatedKey(data.api_key);
      toast({ title: "API key created", description: "Copy your key now — it will not be shown again." });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("tenant_api_keys")
        .update({ is_active: false })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("tenant_api_keys")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-api-keys"] });
      toast({ title: "API key deleted" });
    },
  });

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied to clipboard" });
  };

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-api`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5" /> API Access
        </CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Key
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p>External apps can query member data and attendance records using API keys.</p>
          <p className="mt-1 font-mono text-xs break-all">Endpoint: <code>{baseUrl}</code></p>
          <p className="mt-1">Pass the key via <code>X-API-Key</code> header. Resources: <code>members</code>, <code>attendance_sessions</code>, <code>attendance_records</code>.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No API keys yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.label}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {k.key_prefix ? `${k.key_prefix}••••••••` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? "default" : "secondary"}>
                        {k.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {k.is_active && (
                        <Button variant="outline" size="sm" onClick={() => revokeMutation.mutate(k.id)}>
                          Revoke
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(k.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input placeholder="e.g. Website Integration" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!label.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate(label.trim())}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newlyCreatedKey} onOpenChange={(open) => !open && setNewlyCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Copy your API key now
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This is the only time the full key will be shown. Store it securely — we keep only a hash on our servers.
            </p>
            <div className="font-mono text-xs break-all bg-muted p-3 rounded border">
              {newlyCreatedKey}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => copyKey(newlyCreatedKey)}>
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setNewlyCreatedKey(null)}>
                I've saved it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
