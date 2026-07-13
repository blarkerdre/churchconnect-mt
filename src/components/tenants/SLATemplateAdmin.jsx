import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, Save, Loader2, Eye } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_SLA_BODY, SLA_TOKENS, mergeSlaTokens } from "@/lib/sla";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SLATemplateAdmin() {
  const { user, roles } = useAuth();
  const isSuperAdmin = roles?.includes("super_admin");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Service Level Agreement");
  const [body, setBody] = useState(DEFAULT_SLA_BODY);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["sla-templates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_templates")
        .select("*")
        .order("version", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const active = templates.find((t) => t.is_active);

  useEffect(() => {
    if (active) {
      setTitle(active.title);
      setBody(active.body_html);
    }
  }, [active?.id]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sla_templates").insert({
        title: title.trim(),
        body_html: body,
        is_active: true,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "New SLA version published" });
      queryClient.invalidateQueries({ queryKey: ["sla-templates-all"] });
      queryClient.invalidateQueries({ queryKey: ["sla-active-template"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activateMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("sla_templates")
        .update({ is_active: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Version activated" });
      queryClient.invalidateQueries({ queryKey: ["sla-templates-all"] });
      queryClient.invalidateQueries({ queryKey: ["sla-active-template"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Super admin access required.
        </CardContent>
      </Card>
    );
  }

  const previewTokens = {
    tenant_name: "Example Church",
    tenant_slug: "example",
    owner_name: "Jane Doe",
    owner_email: "jane@example.com",
    effective_date: format(new Date(), "d MMMM yyyy"),
    plan_name: "Standard",
    app_name: "Church Management Suite",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-4 w-4 text-accent" /> SLA Template Editor
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Publishing creates a new immutable version. Tenants who signed a previous version will be prompted to re-sign.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Body (HTML supported)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Merge tokens (wrap in <code>{'{{ }}'}</code>):{" "}
              {SLA_TOKENS.map((t) => (
                <code key={t} className="mx-0.5 px-1 bg-muted rounded">
                  {`{{${t}}}`}
                </code>
              ))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
            </Button>
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !body.trim() || !title.trim()}
            >
              {publishMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Publishing…</>
              ) : (
                <><Save className="h-3.5 w-3.5 mr-1.5" /> Publish new version</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet — publish the first one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">v{t.version}</TableCell>
                    <TableCell>{t.title}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(t.created_at), "d MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {t.is_active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Active</Badge>
                      ) : (
                        <Badge variant="outline">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!t.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateMutation.mutate(t.id)}
                          disabled={activateMutation.isPending}
                        >
                          Re-activate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title} — Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: mergeSlaTokens(body, previewTokens) }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
