import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { format } from "date-fns";

const resultColor = {
  pass: "bg-chart-3/10 text-chart-3",
  fail: "bg-destructive/10 text-destructive",
  needs_attention: "bg-accent/10 text-accent",
};

export default function InspectionHistoryDialog({ open, onOpenChange, item }) {
  const { tenantId } = useTenantQuery();

  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["inspection-history", item?.id, tenantId],
    enabled: open && !!item?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_inspections")
        .select("*, responses:inventory_inspection_responses(*)")
        .eq("item_id", item.id)
        .eq("tenant_id", tenantId)
        .order("inspected_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <History className="h-4 w-4" />
          Inspection History — {item.name}
        </TenantDialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : inspections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No inspections recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {inspections.map((insp) => (
              <div key={insp.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {format(new Date(insp.inspected_at), "dd MMM yyyy, HH:mm")}
                  </div>
                  <Badge className={resultColor[insp.overall_result]}>{insp.overall_result.replace("_", " ")}</Badge>
                </div>
                {insp.signature_name && (
                  <div className="text-xs text-muted-foreground">By: {insp.signature_name}</div>
                )}
                {insp.notes && <div className="text-sm">{insp.notes}</div>}
                {insp.responses?.length > 0 && (
                  <ul className="text-xs space-y-1 mt-2">
                    {insp.responses.sort((a, b) => a.position - b.position).map((r) => (
                      <li key={r.id} className="flex items-start gap-2">
                        <Badge variant="outline" className={`shrink-0 ${resultColor[r.result === "na" ? "needs_attention" : r.result] || ""}`}>
                          {r.result}
                        </Badge>
                        <span className="text-muted-foreground">{r.prompt_snapshot}{r.comment ? ` — ${r.comment}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
