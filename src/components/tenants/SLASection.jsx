import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSignature, Download, Eye, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { mergeSlaTokens, buildSlaPdf, downloadSlaPdf } from "@/lib/sla";

const APP_NAME = "Church Management Suite";

export default function SLASection() {
  const { user, isTenantOwner, isTenantAdmin } = useAuth();
  const { currentTenant } = useTenant();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: template, isLoading: tplLoading } = useQuery({
    queryKey: ["sla-active-template"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_templates")
        .select("*")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: signature, isLoading: sigLoading } = useQuery({
    queryKey: ["sla-signature", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_sla_signatures")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const ownerName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const tokens = useMemo(
    () => ({
      tenant_name: currentTenant?.name || "",
      tenant_slug: currentTenant?.slug || "",
      owner_name: ownerName,
      owner_email: user?.email || "",
      effective_date: format(new Date(), "d MMMM yyyy"),
      plan_name: currentTenant?.plan_tier || "Standard",
      app_name: APP_NAME,
    }),
    [currentTenant, user, ownerName]
  );

  const mergedBody = useMemo(
    () => mergeSlaTokens(template?.body_html || "", tokens),
    [template?.body_html, tokens]
  );

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No active SLA template");
      if (!tenantId) throw new Error("No tenant selected");
      const { error } = await supabase.from("tenant_sla_signatures").insert({
        tenant_id: tenantId,
        template_version: template.version,
        signed_by_user_id: user.id,
        signed_by_name: typedName.trim(),
        signed_by_email: user.email,
        user_agent: navigator.userAgent?.slice(0, 500),
        merged_body_html: mergedBody,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "SLA signed", description: "Thank you — your signature has been recorded." });
      setSignOpen(false);
      setTypedName("");
      setAgreed(false);
      queryClient.invalidateQueries({ queryKey: ["sla-signature", tenantId] });
    },
    onError: (err) => toast({ title: "Signing failed", description: err.message, variant: "destructive" }),
  });

  const handleDownload = (signed = false) => {
    downloadSlaPdf(
      {
        title: template?.title || "Service Level Agreement",
        bodyHtml: signed ? signature?.merged_body_html : template?.body_html,
        tokens: signed ? {} : tokens,
        signature: signed && signature
          ? {
              name: signature.signed_by_name,
              email: signature.signed_by_email,
              signed_at: format(new Date(signature.signed_at), "d MMMM yyyy 'at' HH:mm"),
              template_version: signature.template_version,
            }
          : null,
      },
      signed
        ? `sla-signed-${currentTenant?.slug || "tenant"}.pdf`
        : `sla-${currentTenant?.slug || "tenant"}.pdf`
    );
  };

  const handleSubmitSign = () => {
    const expected = ownerName.trim().toLowerCase();
    const provided = typedName.trim().toLowerCase();
    if (!provided) {
      toast({ title: "Please type your full name", variant: "destructive" });
      return;
    }
    if (expected && provided !== expected) {
      toast({
        title: "Name doesn't match",
        description: `Please type your full name exactly as it appears on your account (${ownerName}).`,
        variant: "destructive",
      });
      return;
    }
    if (!agreed) {
      toast({ title: "Please tick the agreement box", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    signMutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
  };

  if (tplLoading || sigLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading SLA…
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return null;
  }

  const currentVersion = template.version;
  const signedVersion = signature?.template_version;
  const isSignedCurrent = signedVersion === currentVersion;
  const isStale = signature && !isSignedCurrent;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-accent" /> Service Level Agreement
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {template.title} · v{currentVersion}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSignedCurrent ? (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-sm flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Signed</div>
              <div className="text-xs opacity-90">
                by {signature.signed_by_name} on{" "}
                {format(new Date(signature.signed_at), "d MMM yyyy 'at' HH:mm")}
              </div>
            </div>
          </div>
        ) : isStale ? (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">New version available</div>
              <div className="text-xs opacity-90">
                You signed v{signedVersion}. Please review and re-sign the latest version.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            Please review and sign the Service Level Agreement for {currentTenant?.name}.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload(false)}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download PDF
          </Button>
          {isSignedCurrent && (
            <Button variant="outline" size="sm" onClick={() => handleDownload(true)}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download signed copy
            </Button>
          )}
          {isTenantOwner && !isSignedCurrent && (
            <Button size="sm" onClick={() => setSignOpen(true)}>
              <FileSignature className="h-3.5 w-3.5 mr-1.5" /> Sign SLA
            </Button>
          )}
          {!isTenantOwner && isTenantAdmin && !isSignedCurrent && (
            <Badge variant="outline" className="text-xs">Awaiting owner signature</Badge>
          )}
        </div>
      </CardContent>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{template.title} · v{currentVersion}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              // Preview only — content authored by super-admins, merged with local tokens.
              dangerouslySetInnerHTML={{ __html: mergedBody }}
            />
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDownload(false)}>
              <Download className="h-4 w-4 mr-1.5" /> Download
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign dialog */}
      <Dialog
        open={signOpen}
        onOpenChange={(o) => {
          if (submitting) return;
          setSignOpen(o);
          if (!o) {
            setTypedName("");
            setAgreed(false);
          }
        }}
      >
        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-accent" /> Sign SLA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <div><span className="text-muted-foreground">Church:</span> {currentTenant?.name}</div>
              <div><span className="text-muted-foreground">Signing as:</span> {ownerName} ({user?.email})</div>
              <div><span className="text-muted-foreground">Version:</span> v{currentVersion}</div>
              <div><span className="text-muted-foreground">Timestamp:</span> {format(new Date(), "d MMM yyyy 'at' HH:mm")}</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sla-name" className="text-xs">Type your full name to sign</Label>
              <Input
                id="sla-name"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={ownerName}
                autoComplete="off"
                className="font-serif italic"
              />
              {ownerName && (
                <p className="text-[11px] text-muted-foreground">
                  Must match your account name exactly.
                </p>
              )}
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <span>
                I confirm that I have read the Service Level Agreement (v{currentVersion}) and I agree to
                its terms on behalf of {currentTenant?.name}.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSign} disabled={submitting || !typedName.trim() || !agreed}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Signing…</> : "Sign SLA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
