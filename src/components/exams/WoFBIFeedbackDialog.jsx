import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Send } from "lucide-react";
import { FEEDBACK_CONFIDENTIALITY_NOTE } from "@/lib/wofbi-feedback-defaults";
import WoFBIDynamicForm from "./WoFBIDynamicForm";

/**
 * Student-facing Bible School course feedback form.
 * Props: open, onOpenChange, course {id,name}, memberId, memberRecord, registrationId
 */
export default function WoFBIFeedbackDialog({ open, onOpenChange, course, memberId, memberRecord, registrationId }) {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [values, setValues] = useState({});

  const { data: form, isLoading } = useQuery({
    queryKey: ["wofbi-feedback-form", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_feedback_forms")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["my-wofbi-feedback", registrationId, tenantId],
    enabled: !!registrationId && !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_feedback_responses")
        .select("*")
        .eq("registration_id", registrationId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const fields = useMemo(() => form?.fields || [], [form]);
  const submitted = !!existing;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setValues(existing.answers || {});
      return;
    }
    const prefill = {};
    fields.forEach((f) => {
      if (f.type === "date" && /date/.test(f.id)) prefill[f.id] = new Date().toISOString().slice(0, 10);
      if (f.id === "first_name") prefill[f.id] = memberRecord?.first_name || "";
      if (f.id === "surname") prefill[f.id] = memberRecord?.last_name || "";
      if (f.type === "email") prefill[f.id] = memberRecord?.email || "";
      if (f.type === "tel") prefill[f.id] = memberRecord?.phone || "";
    });
    setValues(prefill);
  }, [open, existing, fields, memberRecord]);

  const submit = useMutation({
    mutationFn: async () => {
      for (const f of fields) {
        if (!f.required || f.type === "section_heading") continue;
        const v = values[f.id];
        if (f.type === "rating_grid") {
          const missing = (f.rows || []).some((r) => !v?.[r]);
          if (missing) throw Object.assign(new Error(`Please rate every item under "${f.label}"`), { __friendly: true });
        } else if (v === undefined || v === null || v === "" || v === false) {
          throw Object.assign(new Error(`"${f.label}" is required`), { __friendly: true });
        }
      }
      const { error } = await supabase.from("wofbi_feedback_responses").insert({
        tenant_id: tenantId,
        registration_id: registrationId || null,
        course_id: course?.id || null,
        member_id: memberId,
        answers: values,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Thank you", description: "Your feedback has been submitted." });
      qc.invalidateQueries({ queryKey: ["my-wofbi-feedback", registrationId, tenantId] });
      qc.invalidateQueries({ queryKey: ["my-wofbi-feedback-ids", memberId, tenantId] });
      onOpenChange(false);
    },
    onError: (e) => toast({ title: e.__friendly ? "Incomplete form" : "Submission failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form?.title || "Bible School — Feedback Form"}</DialogTitle>
          {form?.intro_text && <p className="text-sm text-muted-foreground">{form.intro_text}</p>}
          {course?.name && <p className="text-xs text-muted-foreground">Course: {course.name}</p>}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading form...
          </div>
        ) : (
          <>
            {submitted && (
              <p className="text-xs rounded-md border bg-muted/40 p-2">
                You submitted this feedback on {new Date(existing.submitted_at).toLocaleDateString()}. It is shown here for your records.
              </p>
            )}
            <WoFBIDynamicForm
              fields={fields}
              values={values}
              disabled={submitted}
              onChange={(id, v) => setValues((prev) => ({ ...prev, [id]: v }))}
            />
            <p className="text-xs text-muted-foreground pt-2 border-t">{FEEDBACK_CONFIDENTIALITY_NOTE}</p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{submitted ? "Close" : "Cancel"}</Button>
          {!submitted && (
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || isLoading} className="gap-1.5">
              {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit feedback
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
