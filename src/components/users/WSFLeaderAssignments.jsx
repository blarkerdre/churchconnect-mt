import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function WSFLeaderAssignments({ userId }) {
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery } = useTenantQuery();

  // Get the member record linked to this user
  const { data: member } = useQuery({
    queryKey: ["member-by-user", userId, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("members").select("id").eq("user_id", userId).maybeSingle()
      );
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const memberId = member?.id;

  // Get centres led by this member
  const { data: ledCentres = [] } = useQuery({
    queryKey: ["wsf-leader-centres", memberId, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("wsf_centres").select("id, name").eq("leader_id", memberId)
      );
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  // Get all active centres (for the add popover)
  const { data: allCentres = [] } = useQuery({
    queryKey: ["wsf-centres-all", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("wsf_centres").select("id, name, leader_id").eq("is_active", true).order("name")
      );
      if (error) throw error;
      return data;
    },
  });

  const ledCentreIds = ledCentres.map(c => c.id);
  // Available = unassigned centres OR centres not led by anyone
  const availableCentres = allCentres.filter(c => !c.leader_id && !ledCentreIds.includes(c.id));

  const addMutation = useMutation({
    mutationFn: async (centreId) => {
      let q = supabase.from("wsf_centres").update({ leader_id: memberId }).eq("id", centreId);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-leader-centres", memberId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["wsf-centres-all", tenantId] });
      toast({ title: "Home Cell centre assigned" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (centreId) => {
      let q = supabase.from("wsf_centres").update({ leader_id: null }).eq("id", centreId);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-leader-centres", memberId, tenantId] });
      queryClient.invalidateQueries({ queryKey: ["wsf-centres-all", tenantId] });
      toast({ title: "Home Cell centre removed" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!memberId) {
    return <span className="text-xs text-muted-foreground italic">No member linked</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {ledCentres.map((centre) => (
        <Badge key={centre.id} variant="outline" className="gap-1 text-xs">
          {centre.name}
          <button onClick={() => removeMutation.mutate(centre.id)} className="ml-0.5 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {availableCentres.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableCentres.map((centre) => (
                <button
                  key={centre.id}
                  onClick={() => addMutation.mutate(centre.id)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted transition-colors"
                >
                  {centre.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {ledCentres.length === 0 && (
        <span className="text-xs text-muted-foreground italic">No centres assigned</span>
      )}
    </div>
  );
}
