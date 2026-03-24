import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, CheckCircle2 } from "lucide-react";
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
    queryKey: ["app-settings", "training_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "training_types")
        .maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  // Fetch active courses from exam_titles
  const { data: examTitles = [] } = useQuery({
    queryKey: ["exam-titles-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_titles")
        .select("name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data.map((t) => t.name);
    },
  });

  const allTypes = [...new Set([...examTitles, ...customTypes, ...DEFAULT_TRAINING_TYPES])];
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
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleIssue = () => {
    if (!trainingType) {
      toast({ title: "Please select a training type", variant: "destructive" });
      return;
    }
    issueMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Issue Certificate — {member?.first_name} {member?.last_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Existing completions */}
          {completions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Completed Trainings
              </h4>
              <div className="space-y-1.5">
                {completions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-chart-3/5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-chart-3" />
                      <span className="text-sm font-medium text-foreground">{c.training_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.completion_date), "dd MMM yyyy")}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{c.certificate_number}</Badge>
                    </div>
                  </div>
                ))}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
  );
}
