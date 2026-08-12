import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useExamSessionFilter } from "@/contexts/ExamSessionFilterContext";
import { Loader2, Copy } from "lucide-react";

const UNASSIGNED = "unassigned";

/**
 * Copies a course's subjects (and optionally their exam questions) from one
 * session/edition into the currently selected edition. Nothing is moved or
 * removed from the source edition.
 */
export default function CopySyllabusDialog({ open, onOpenChange, course }) {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const { sessions, sessionId, sessionName } = useExamSessionFilter();
  const [fromSession, setFromSession] = useState("");
  const [includeQuestions, setIncludeQuestions] = useState(true);

  const sourceOptions = useMemo(
    () => sessions.filter((s) => s.id !== sessionId),
    [sessions, sessionId]
  );

  const copyMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("clone_exam_subjects_to_session", {
        p_tenant_id: tenantId,
        p_course_id: course.id,
        p_from_session: fromSession === UNASSIGNED ? null : fromSession,
        p_to_session: sessionId,
        p_include_questions: includeQuestions,
      });
      if (error) throw error;
      return data || {};
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["exam-subjects", course.id] });
      qc.invalidateQueries({ queryKey: ["exam-question-counts"] });
      qc.invalidateQueries({ queryKey: ["all-exam-subjects"] });
      toast({
        title: "Syllabus copied",
        description: `${res.subjects || 0} subject(s)${includeQuestions ? ` and ${res.questions || 0} question(s)` : ""} added to ${sessionName}.`,
      });
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Copy failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>Copy syllabus into {sessionName}</TenantDialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Duplicates the subjects of <span className="font-medium text-foreground">{course.name}</span> from
            another edition into <span className="font-medium text-foreground">{sessionName}</span>. The source
            edition is left untouched, and subjects that already exist here are skipped.
          </p>
          <div className="space-y-1.5">
            <Label>Copy from edition</Label>
            <Select value={fromSession} onValueChange={setFromSession}>
              <SelectTrigger><SelectValue placeholder="Select an edition" /></SelectTrigger>
              <SelectContent>
                {sourceOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
                <SelectItem value={UNASSIGNED}>Unassigned edition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div>
              <Label htmlFor="copy-questions" className="text-sm font-medium">Also copy exam questions</Label>
              <p className="text-[11px] text-muted-foreground">Question papers are duplicated per subject.</p>
            </div>
            <Switch id="copy-questions" checked={includeQuestions} onCheckedChange={setIncludeQuestions} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="gap-1.5"
            disabled={!fromSession || copyMutation.isPending}
            onClick={() => copyMutation.mutate()}
          >
            {copyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Copy syllabus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
