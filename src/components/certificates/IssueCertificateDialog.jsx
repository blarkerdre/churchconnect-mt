import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, CheckCircle2, RotateCw, Download, Eye } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const DEFAULT_TRAINING_TYPES = [
  "Believers Foundation Class (BFC)",
  "Basic Certificate Course (BCC)",
  "Leadership Certificate Course (LCC)",
  "Leadership Diploma Course (LDC)",
  "Water Baptism",
  "Workers in Training (WIT)",
];

export default function IssueCertificateDialog({ open, onOpenChange, member }) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [trainingType, setTrainingType] = useState("");
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [reissuingId, setReissuingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null); // completion id or "__new__"
  const [previewData, setPreviewData] = useState(null); // { image, meta, mode, completion? }

  // Fetch existing completions for this member
  const { data: completions = [] } = useQuery({
    queryKey: ["training-completions", member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_completions")
        .select("*")
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id && open,
  });

  // Fetch custom training types from app_settings
  const { data: customTypes = [] } = useQuery({
    queryKey: ["app-settings", "training_types", tenantId],
    queryFn: async () => {
      let q = supabase.from("app_settings").select("value").eq("key", "training_types");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  // Fetch active courses from exam_titles
  const { data: examTitles = [] } = useQuery({
    queryKey: ["exam-titles-active", tenantId],
    queryFn: async () => {
      let q = supabase.from("exam_titles").select("name").eq("is_active", true).order("name");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return data.map((t) => t.name);
    },
  });

  const toName = (v) => (typeof v === "string" ? v : v?.name || v?.title || v?.label || "");
  const allTypes = [...new Set(
    [...examTitles, ...customTypes, ...DEFAULT_TRAINING_TYPES]
      .map(toName)
      .filter(Boolean)
  )];
  const completedTypes = completions.map(c => c.training_type);

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("issue-certificate", {
        body: {
          member_id: member.id,
          training_type: trainingType,
          completion_date: completionDate,
          notes: notes || null,
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-completions"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({
        title: "Certificate issued!",
        description: `Certificate ${data.certificate_number} has been generated${member.email ? " and emailed" : ""}.`,
      });
      setTrainingType("");
      setNotes("");
      setPreviewData(null);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reissueMutation = useMutation({
    mutationFn: async (completion) => {
      setReissuingId(completion.id);
      const { data, error } = await supabase.functions.invoke("issue-certificate", {
        body: {
          member_id: member.id,
          training_type: completion.training_type,
          tenant_id: completion.tenant_id || tenantId,
          completion_id: completion.id,
          reissue: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["training-completions"] });
      toast({
        title: "Certificate reissued",
        description: `Certificate ${data.certificate_number} has been regenerated${member.email ? " and re-emailed" : ""}.`,
      });
      setReissuingId(null);
      setPreviewData(null);
    },
    onError: (err) => {
      setReissuingId(null);
      toast({ title: "Reissue failed", description: err.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ mode, completion }) => {
      const body =
        mode === "reissue"
          ? {
              member_id: member.id,
              training_type: completion.training_type,
              tenant_id: completion.tenant_id || tenantId,
              completion_id: completion.id,
              preview: true,
            }
          : {
              member_id: member.id,
              training_type: trainingType,
              completion_date: completionDate,
              tenant_id: tenantId,
              preview: true,
            };
      const { data, error } = await supabase.functions.invoke("issue-certificate", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return { data, mode, completion };
    },
    onSuccess: ({ data, mode, completion }) => {
      setPreviewData({
        image: data.image_base64,
        meta: {
          memberName: data.member_name,
          trainingType: data.training_type,
          completionDate: data.completion_date,
          certificateNumber: data.certificate_number,
        },
        mode,
        completion: completion || null,
      });
      setPreviewingId(null);
    },
    onError: (err) => {
      setPreviewingId(null);
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const handleDownload = async (completion) => {
    if (!completion.certificate_url) {
      toast({ title: "No file available", description: "Try reissuing the certificate.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.storage
      .from("church-documents")
      .createSignedUrl(completion.certificate_url, 60 * 5, { download: `${completion.certificate_number}.png` });
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message || "Could not generate link.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleIssue = () => {
    if (!trainingType) {
      toast({ title: "Please select a training type", variant: "destructive" });
      return;
    }
    issueMutation.mutate();
  };

  const handlePreviewNew = () => {
    if (!trainingType) {
      toast({ title: "Please select a training type", variant: "destructive" });
      return;
    }
    setPreviewingId("__new__");
    previewMutation.mutate({ mode: "new" });
  };

  const handlePreviewExisting = (completion) => {
    setPreviewingId(completion.id);
    previewMutation.mutate({ mode: "reissue", completion });
  };

  const isPreviewingNew = previewingId === "__new__" && previewMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <TenantDialogHeader>
              <Award className="h-5 w-5 text-primary" />
              Issue Certificate — {member?.first_name} {member?.last_name}
            </TenantDialogHeader>

          <div className="space-y-5 py-2">
            {/* Existing completions */}
            {completions.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Completed Trainings
                </h4>
                <div className="space-y-1.5">
                  {completions.map((c) => {
                    const isReissuing = reissuingId === c.id && reissueMutation.isPending;
                    const isPreviewingThis = previewingId === c.id && previewMutation.isPending;
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-chart-3/5">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="h-4 w-4 text-chart-3 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{c.training_type}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                {format(new Date(c.completion_date), "dd MMM yyyy")}
                              </span>
                              <Badge variant="outline" className="text-[10px]">{c.certificate_number}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Preview certificate"
                            onClick={() => handlePreviewExisting(c)}
                            disabled={isReissuing || isPreviewingThis || previewMutation.isPending}
                          >
                            {isPreviewingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Download certificate"
                            onClick={() => handleDownload(c)}
                            disabled={isReissuing}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Reissue certificate"
                            onClick={() => {
                              if (window.confirm(`Reissue certificate for "${c.training_type}"? The certificate number (${c.certificate_number}) will be kept and the file regenerated${member.email ? " and re-emailed" : ""}.`)) {
                                reissueMutation.mutate(c);
                              }
                            }}
                            disabled={isReissuing || reissueMutation.isPending}
                          >
                            {isReissuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Issue new */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Issue New Certificate
              </h4>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Training Programme *</Label>
                  <Select value={trainingType} onValueChange={setTrainingType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select training type" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTypes.map((t) => (
                        <SelectItem key={t} value={t} disabled={completedTypes.includes(t)}>
                          {t} {completedTypes.includes(t) ? "(already issued)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Completion Date</Label>
                  <Input
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={handlePreviewNew}
              disabled={isPreviewingNew || !trainingType || issueMutation.isPending}
            >
              {isPreviewingNew ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview
            </Button>
            <Button
              onClick={handleIssue}
              disabled={issueMutation.isPending || !trainingType}
            >
              {issueMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Issue Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CertificatePreviewDialog
        open={!!previewData}
        onOpenChange={(v) => { if (!v) setPreviewData(null); }}
        data={previewData}
        onConfirm={() => {
          if (!previewData) return;
          if (previewData.mode === "new") {
            handleIssue();
          } else if (previewData.mode === "reissue" && previewData.completion) {
            reissueMutation.mutate(previewData.completion);
          }
        }}
        confirming={issueMutation.isPending || reissueMutation.isPending}
        memberEmail={member?.email}
      />
    </>
  );
}

function CertificatePreviewDialog({ open, onOpenChange, data, onConfirm, confirming, memberEmail }) {
  if (!data) return null;
  const { image, meta, mode } = data;
  const isNew = mode === "new";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Eye className="h-5 w-5 text-primary" />
          Certificate Preview
        </TenantDialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{meta.memberName}</span>
            <span>·</span>
            <span>{meta.trainingType}</span>
            <span>·</span>
            <span>{meta.completionDate ? format(new Date(meta.completionDate), "dd MMM yyyy") : "—"}</span>
            <span>·</span>
            {isNew ? (
              <Badge variant="secondary" className="text-[10px]">PREVIEW — number assigned on issue</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">{meta.certificateNumber}</Badge>
            )}
          </div>
          <div className="rounded-lg overflow-hidden border bg-muted/30">
            {image ? (
              <img
                src={`data:image/png;base64,${image}`}
                alt="Certificate preview"
                className="w-full h-auto block"
              />
            ) : (
              <div className="aspect-[842/595] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            This is a preview only. {isNew
              ? "No certificate has been issued or emailed yet."
              : `Reissuing will regenerate the saved file${memberEmail ? " and re-email it" : ""}.`}
          </p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isNew ? "Issue Certificate" : "Reissue Certificate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
