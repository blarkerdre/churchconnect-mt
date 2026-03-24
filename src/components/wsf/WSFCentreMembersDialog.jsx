import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, UserMinus, Search, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function WSFCentreMembersDialog({ open, onOpenChange, centre }) {
  const [search, setSearch] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: centreMembers = [], isLoading } = useQuery({
    queryKey: ["wsf-centre-members", centre?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, first_name, last_name, email, phone")
          .eq("wsf_centre_id", centre.id)
          .order("first_name")
      );
      if (error) throw error;
      return data;
    },
    enabled: !!centre?.id && open,
  });

  const { data: availableMembers = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["wsf-available-members", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, first_name, last_name, email, wsf_centre_id")
          .eq("membership_status", "Active")
          .order("first_name")
      );
      if (error) throw error;
      return data;
    },
    enabled: open && showAdd,
  });

  const unassignedMembers = useMemo(() => {
    return availableMembers.filter(m => !m.wsf_centre_id);
  }, [availableMembers]);

  const assignMutation = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from("members")
        .update({ wsf_centre_id: centre.id })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-centre-members", centre?.id] });
      queryClient.invalidateQueries({ queryKey: ["wsf-available-members"] });
      queryClient.invalidateQueries({ queryKey: ["wsf-member-counts"] });
      toast({ title: "Member added to centre" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from("members")
        .update({ wsf_centre_id: null })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-centre-members", centre?.id] });
      queryClient.invalidateQueries({ queryKey: ["wsf-available-members"] });
      queryClient.invalidateQueries({ queryKey: ["wsf-member-counts"] });
      toast({ title: "Member removed from centre" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredMembers = centreMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailable = unassignedMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(addSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            {centre?.name} — Members
            <Badge variant="outline" className="ml-2 font-mono">{centreMembers.length}</Badge>
          </DialogTitle>
        </DialogHeader>

        {!showAdd ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={() => { setShowAdd(true); setAddSearch(""); }}>
                <UserPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {search ? "No members match your search" : "No members assigned to this centre yet"}
              </p>
            ) : (
              <ScrollArea className="flex-1 -mx-1 px-1" style={{ maxHeight: "50vh" }}>
                <div className="space-y-1">
                  {filteredMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 group">
                      <div>
                        <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                        {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          if (window.confirm(`Remove ${m.first_name} ${m.last_name} from this centre?`))
                            removeMutation.mutate(m.id);
                        }}
                        disabled={removeMutation.isPending}
                      >
                        <UserMinus className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search unassigned members…"
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
                Back
              </Button>
            </div>

            {loadingAvailable ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredAvailable.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {addSearch ? "No unassigned members match" : "All active members are already assigned to a centre"}
              </p>
            ) : (
              <ScrollArea className="flex-1 -mx-1 px-1" style={{ maxHeight: "50vh" }}>
                <div className="space-y-1">
                  {filteredAvailable.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                        {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => assignMutation.mutate(m.id)}
                        disabled={assignMutation.isPending}
                      >
                        {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
