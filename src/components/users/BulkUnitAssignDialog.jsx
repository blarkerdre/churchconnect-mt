import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useChurchUnits } from "@/hooks/useChurchUnits";

export default function BulkUnitAssignDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { data: churchUnits = [] } = useChurchUnits();
  const allUnitNames = churchUnits.map(u => u.name);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");

  // Get all unit leaders scoped to tenant
  const { data: unitLeaders = [] } = useQuery({
    queryKey: ["unit-leader-profiles", tenantId],
    queryFn: async () => {
      let rolesQuery = supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "unit_leader");
      if (tenantId) rolesQuery = rolesQuery.eq("tenant_id", tenantId);
      const { data: roles } = await rolesQuery;
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await scopeQuery(
        supabase
          .from("profiles")
          .select("*")
          .in("user_id", userIds)
          .order("full_name")
      );
      return profiles || [];
    },
    enabled: open,
  });

  // Get existing assignments for selected unit scoped to tenant
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["unit-assignments-for", selectedUnit, tenantId],
    queryFn: async () => {
      const { data } = await scopeQuery(
        supabase
          .from("unit_leader_assignments")
          .select("user_id")
          .eq("unit_name", selectedUnit)
      );
      return data?.map(a => a.user_id) || [];
    },
    enabled: !!selectedUnit && open,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const newAssignments = selectedUsers
        .filter(uid => !existingAssignments.includes(uid))
        .map(uid => withTenant({ user_id: uid, unit_name: selectedUnit }));
      if (!newAssignments.length) return;
      const { error } = await supabase
        .from("unit_leader_assignments")
        .insert(newAssignments);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-leader-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["unit-assignments-for"] });
      toast({ title: `Assigned ${selectedUsers.length} leader(s) to ${selectedUnit}` });
      setSelectedUsers([]);
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredLeaders = unitLeaders.filter(p =>
    (p.full_name || p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>Bulk Unit Assignment</TenantDialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Select Unit</Label>
            <Select value={selectedUnit} onValueChange={(v) => { setSelectedUnit(v); setSelectedUsers([]); }}>
              <SelectTrigger><SelectValue placeholder="Choose a unit" /></SelectTrigger>
              <SelectContent>
                {allUnitNames.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUnit && (
            <>
              <div className="space-y-1.5">
                <Label>Select Unit Leaders to Assign</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leaders..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-border">
                {filteredLeaders.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    No unit leaders found. Assign the "unit leader" role first.
                  </p>
                ) : (
                  filteredLeaders.map(p => {
                    const alreadyAssigned = existingAssignments.includes(p.user_id);
                    return (
                      <label
                        key={p.user_id}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${alreadyAssigned ? "opacity-50" : ""}`}
                      >
                        <Checkbox
                          checked={alreadyAssigned || selectedUsers.includes(p.user_id)}
                          disabled={alreadyAssigned}
                          onCheckedChange={() => toggleUser(p.user_id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.full_name || p.email}</p>
                          {alreadyAssigned && (
                            <Badge variant="outline" className="text-xs mt-0.5">Already assigned</Badge>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {selectedUsers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedUsers.length} leader(s) selected
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!selectedUnit || selectedUsers.length === 0 || assignMutation.isPending}
          >
            {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign Leaders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}