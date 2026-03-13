import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserPlus, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function RegistrationsDialog({ open, onOpenChange, event }) {
  const { user } = useAuth();
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations", event?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!event?.id && open,
  });

  const addMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from("event_registrations").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] });
      setNewName(""); setNewEmail("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from("event_registrations").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("event_registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] }),
  });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    await addMutation.mutateAsync({
      event_id: event.id,
      guest_name: newName.trim(),
      guest_email: newEmail.trim() || null,
      user_id: user?.id,
      status: "registered",
    });
    setAdding(false);
  };

  const attendedCount = registrations.filter(r => r.status === "attended").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrations — {event?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-muted/50 rounded-xl">
              <p className="text-xl font-bold text-foreground">{registrations.length}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
            <div className="text-center p-3 bg-chart-3/10 rounded-xl">
              <p className="text-xl font-bold text-chart-3">{attendedCount}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-xl">
              <p className="text-xl font-bold text-foreground">{event?.capacity ? event.capacity - registrations.length : "∞"}</p>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-foreground">Add Registrant</p>
            <div className="grid grid-cols-1 gap-2">
              <Input placeholder="Full Name *" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={!newName.trim() || adding} className="w-full">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No registrations yet</p>
            ) : (
              registrations.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.guest_name || "Unknown"}</p>
                    {r.guest_email && <p className="text-xs text-muted-foreground">{r.guest_email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {r.status === "attended"
                        ? <CheckCircle2 className="h-4 w-4 text-chart-3" />
                        : <XCircle className="h-4 w-4 text-muted-foreground/30" />}
                      <Switch
                        checked={r.status === "attended"}
                        onCheckedChange={v => updateMutation.mutate({ id: r.id, data: { status: v ? "attended" : "registered" } })}
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
