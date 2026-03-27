import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const ALL_UNITS = [
  "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "WSF",
];

export default function UnitLeaderAssignments({ userId }) {
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();

  const { data: assignments = [] } = useQuery({
    queryKey: ["unit-leader-assignments", userId, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("unit_leader_assignments")
          .select("*")
          .eq("user_id", userId)
      );
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const assignedUnits = assignments.map((a) => a.unit_name);
  const availableUnits = ALL_UNITS.filter((u) => !assignedUnits.includes(u));

  const addMutation = useMutation({
    mutationFn: async (unitName) => {
      const { error } = await supabase
        .from("unit_leader_assignments")
        .insert(withTenant({ user_id: userId, unit_name: unitName }));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-leader-assignments", userId, tenantId] });
      toast({ title: "Unit assigned" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (unitName) => {
      let q = supabase
        .from("unit_leader_assignments")
        .delete()
        .eq("user_id", userId)
        .eq("unit_name", unitName);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-leader-assignments", userId, tenantId] });
      toast({ title: "Unit removed" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {assignedUnits.map((unit) => (
        <Badge key={unit} variant="outline" className="gap-1 text-xs">
          {unit}
          <button onClick={() => removeMutation.mutate(unit)} className="ml-0.5 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {availableUnits.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableUnits.map((unit) => (
                <button
                  key={unit}
                  onClick={() => addMutation.mutate(unit)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  {unit}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {assignedUnits.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No units assigned</span>
      )}
    </div>
  );
}