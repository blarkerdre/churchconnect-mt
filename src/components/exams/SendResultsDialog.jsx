import React, { useMemo, useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Loader2, Award, FileText, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { StatementPreview } from "@/components/exams/StatementOfResult";

/**
 * Combined preview + send dialog for Statement of Result and/or Certificate.
 *
 * Props:
 *  - open, onOpenChange
 *  - course: { id, name, tenant_id }
 *  - subjects: exam subjects for the course
 *  - members: [{ id, name, passed, subjects: {subjectId: {score,total_points}} }]
 *  - onSent(): callback after a successful send
 */
export default function SendResultsDialog({
  open,
  onOpenChange,
  course,
  subjects,
  members = [],
  onSent,
}) {
  const qc = useQueryClient();
  const [sendStatement, setSendStatement] = useState(true);
  const [sendCertificate, setSendCertificate] = useState(true);
  const [activeMemberId, setActiveMemberId] = useState(null);
  const [certPreviews, setCertPreviews] = useState({}); // { [memberId]: { image, loading, error } }
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const passedMembers = useMemo(() => members.filter((m) => m.passed), [members]);
  const eligibleForCert = passedMembers.length;
  const notPassedCount = members.length - eligibleForCert;

  useEffect(() => {
    if (!open) return;
    if (members.length > 0) {
      setActiveMemberId((prev) => (prev && members.some((m) => m.id === prev) ? prev : members[0].id));
    }
  }, [open, members]);

  // Track which member ids have a fetch in-flight or already completed, so
  // the load effect doesn't self-cancel when it triggers its own state update.
  const inflightRef = useRef(new Set());
  const membersRef = useRef(members);
  useEffect(() => { membersRef.current = members; }, [members]);

  useEffect(() => {
    if (!open) {
      setCertPreviews({});
      inflightRef.current = new Set();
    }
  }, [open]);

  const activePassed = !!members.find((m) => m.id === activeMemberId)?.passed;

  // Load cert preview for the active member on demand.
  useEffect(() => {
    if (!open || !activeMemberId || !sendCertificate || !activePassed) return;
    if (inflightRef.current.has(activeMemberId)) return;
    inflightRef.current.add(activeMemberId);

    setCertPreviews((p) => (p[activeMemberId] ? p : { ...p, [activeMemberId]: { loading: true } }));

    let cancelled = false;
    (async () => {
      try {
        // Detect existing completion so we preview a reissue when appropriate.
        const { data: existing } = await supabase
          .from("training_completions")
          .select("id")
          .eq("tenant_id", course.tenant_id)
          .eq("training_type", course.name)
          .eq("member_id", activeMemberId)
          .maybeSingle();

        const body = existing?.id
          ? {
              member_id: activeMemberId,
              training_type: course.name,
              tenant_id: course.tenant_id,
              completion_id: existing.id,
              preview: true,
            }
          : {
              member_id: activeMemberId,
              training_type: course.name,
              tenant_id: course.tenant_id,
              preview: true,
            };

        const { data, error } = await supabase.functions.invoke("issue-certificate", { body });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setCertPreviews((p) => ({
          ...p,
          [activeMemberId]: { image: data.image_base64, loading: false },
        }));
      } catch (e) {
        if (cancelled) return;
        inflightRef.current.delete(activeMemberId);
        setCertPreviews((p) => ({
          ...p,
          [activeMemberId]: { loading: false, error: e.message || "Failed to load preview" },
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally exclude `members` (unstable reference) and `certPreviews`
    // (updated inside the effect) to avoid cancelling the in-flight fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeMemberId, sendCertificate, activePassed, course.tenant_id, course.name]);

  const activeMember = members.find((m) => m.id === activeMemberId) || null;

  const totalTargets = (sendStatement ? members.length : 0) + (sendCertificate ? eligibleForCert : 0);
  const canSend = totalTargets > 0 && !sending && (sendStatement || sendCertificate);

  const primaryLabel = useMemo(() => {
    if (sendStatement && sendCertificate) {
      const skipped = notPassedCount > 0 ? ` (${notPassedCount} skipped)` : "";
      return `Send to ${members.length}${skipped}`;
    }
    if (sendStatement) return `Send statement to ${members.length}`;
    if (sendCertificate) return `Send certificate to ${eligibleForCert} eligible`;
    return "Send";
  }, [sendStatement, sendCertificate, members.length, eligibleForCert, notPassedCount]);

  const handlePrimaryClick = () => {
    if (totalTargets > 5) {
      setConfirmOpen(true);
    } else {
      void performSend();
    }
  };

  const performSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    let stmtSent = 0, stmtFailed = 0, certSent = 0, certFailed = 0;
    const skipped = sendCertificate ? notPassedCount : 0;

    try {
      if (sendStatement && members.length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke("send-statement-email", {
            body: {
              member_ids: members.map((m) => m.id),
              course_id: course.id,
              tenant_id: course.tenant_id,
            },
          });
          if (error) throw error;
          stmtSent = data?.sent ?? 0;
          stmtFailed = data?.failed ?? Math.max(0, members.length - stmtSent);
        } catch (e) {
          stmtFailed = members.length;
        }
      }

      if (sendCertificate && passedMembers.length > 0) {
        const { data: existing } = await supabase
          .from("training_completions")
          .select("member_id")
          .eq("tenant_id", course.tenant_id)
          .eq("training_type", course.name)
          .in("member_id", passedMembers.map((m) => m.id));
        const existingSet = new Set((existing || []).map((r) => r.member_id));

        for (const m of passedMembers) {
          try {
            const { data, error } = await supabase.functions.invoke("issue-certificate", {
              body: {
                member_id: m.id,
                training_type: course.name,
                tenant_id: course.tenant_id,
                reissue: existingSet.has(m.id),
                admin_override: true,
                send_certificate_email: true,
              },
            });
            if (error || !data?.success) certFailed++;
            else certSent++;
          } catch {
            certFailed++;
          }
        }
      }

      qc.invalidateQueries({ queryKey: ["training-completions"] });
      qc.invalidateQueries({ queryKey: ["course-attempts"] });

      const parts = [];
      if (sendStatement) parts.push(`Statements: ${stmtSent} sent${stmtFailed ? `, ${stmtFailed} failed` : ""}`);
      if (sendCertificate) {
        parts.push(
          `Certificates: ${certSent} sent${certFailed ? `, ${certFailed} failed` : ""}${skipped ? ` (${skipped} skipped — not passed)` : ""}`
        );
      }
      const anyFail = stmtFailed > 0 || certFailed > 0;
      const anyOk = stmtSent > 0 || certSent > 0;
      toast({
        title: anyFail && !anyOk ? "Send failed" : anyFail ? "Partially sent" : "Sent",
        description: parts.join(" · "),
        variant: anyFail && !anyOk ? "destructive" : undefined,
      });

      if (onSent) onSent();
      if (!anyFail || anyOk) onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
        <DialogContent className="max-w-3xl">
          <TenantDialogHeader>
            <Send className="h-4 w-4 text-primary" /> Preview & Send Results
          </TenantDialogHeader>

          <div className="space-y-4 max-h-[75vh] overflow-y-auto">
            {/* What to send */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to send</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={sendStatement} onCheckedChange={(v) => setSendStatement(!!v)} />
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Statement of Result
                  <span className="text-xs text-muted-foreground">({members.length})</span>
                </label>
                <label className={`flex items-center gap-2 text-sm ${eligibleForCert === 0 ? "opacity-50" : "cursor-pointer"}`}>
                  <Checkbox
                    checked={sendCertificate && eligibleForCert > 0}
                    disabled={eligibleForCert === 0}
                    onCheckedChange={(v) => setSendCertificate(!!v)}
                  />
                  <Award className="h-3.5 w-3.5 text-muted-foreground" />
                  Certificate
                  <span className="text-xs text-muted-foreground">
                    ({eligibleForCert} of {members.length} eligible)
                  </span>
                </label>
              </div>
            </div>

            {/* Recipients summary */}
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Recipients ({members.length})
              </p>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {members.map((m) => (
                  <Badge
                    key={m.id}
                    variant={m.id === activeMemberId ? "default" : "outline"}
                    className="cursor-pointer text-xs gap-1"
                    onClick={() => setActiveMemberId(m.id)}
                  >
                    {m.name}
                    {sendCertificate && !m.passed && (
                      <span className="text-[9px] italic ml-1">no cert</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Preview */}
            {activeMember && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Preview
                  </p>
                  {members.length > 1 && (
                    <Select value={activeMemberId} onValueChange={setActiveMemberId}>
                      <SelectTrigger className="h-8 w-56 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Tabs defaultValue={sendStatement ? "statement" : "certificate"}>
                  <TabsList className="h-8">
                    <TabsTrigger value="statement" className="text-xs h-7" disabled={!sendStatement}>
                      <FileText className="h-3 w-3 mr-1" /> Statement
                    </TabsTrigger>
                    <TabsTrigger value="certificate" className="text-xs h-7" disabled={!sendCertificate}>
                      <Award className="h-3 w-3 mr-1" /> Certificate
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="statement" className="pt-3">
                    <div className="border rounded p-3 bg-background">
                      <StatementPreview
                        member={{ id: activeMember.id, name: activeMember.name }}
                        course={course}
                        subjects={subjects}
                        memberSubjects={activeMember.subjects}
                        enabled={open}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="certificate" className="pt-3">
                    <div className="border rounded p-3 bg-muted/30 flex items-center justify-center min-h-[240px]">
                      {!activeMember.passed ? (
                        <p className="text-sm text-muted-foreground italic">
                          {activeMember.name} did not pass — no certificate will be issued.
                        </p>
                      ) : certPreviews[activeMemberId]?.loading ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Rendering certificate…
                        </div>
                      ) : certPreviews[activeMemberId]?.error ? (
                        <p className="text-xs text-destructive">
                          {certPreviews[activeMemberId].error}
                        </p>
                      ) : certPreviews[activeMemberId]?.image ? (
                        <img
                          src={certPreviews[activeMemberId].image}
                          alt="Certificate preview"
                          className="max-w-full max-h-[480px] object-contain rounded shadow-sm"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handlePrimaryClick} disabled={!canSend} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {primaryLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {members.length} recipient{members.length === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will email {sendStatement && sendCertificate
                ? "the Statement of Result and Certificate"
                : sendStatement
                ? "the Statement of Result"
                : "the Certificate"}
              {" "}to each selected member. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performSend}>Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
