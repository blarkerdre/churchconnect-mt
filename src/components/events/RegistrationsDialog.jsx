import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserPlus, CheckCircle2, XCircle, Trash2 } from "lucide-react";

export default function RegistrationsDialog({ open, onOpenChange, event }) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["registrations", event?.id],
    queryFn: () => base44.entities.EventRegistration.filter({ event_id: event?.id }),
    enabled: !!event?.id && open,
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.EventRegistration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] });
      queryClient.invalidateQueries({ queryKey: ["allRegistrations"] });
      setNewName(""); setNewEmail(""); setNewPhone("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventRegistration.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventRegistration.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registrations", event?.id] });
      queryClient.invalidateQueries({ queryKey: ["allRegistrations"] });
    },
  });

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    await addMutation.mutateAsync({
      event_id: event.id,
      event_title: event.title,
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      attended: false,
    });
    setAdding(false);
  };

  const attendedCount = registrations.filter(r => r.attended).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrations — {event?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-xl font-bold text-slate-800">{registrations.length}</p>
              <p className="text-xs text-slate-400">Registered</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-xl font-bold text-emerald-700">{attendedCount}</p>
              <p className="text-xs text-slate-400">Attended</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-xl font-bold text-slate-800">{event?.capacity ? event.capacity - registrations.length : "∞"}</p>
              <p className="text-xs text-slate-400">Remaining</p>
            </div>
          </div>

          {/* Add new registrant */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-slate-700">Add Registrant</p>
            <div className="grid grid-cols-1 gap-2">
              <Input placeholder="Full Name *" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <Input placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={!newName.trim() || adding} className="bg-[#1e3a5f] hover:bg-[#152d4a] w-full">
              {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add
            </Button>
          </div>

          {/* Registrant list */}
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
            ) : registrations.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No registrations yet</p>
            ) : (
              registrations.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    {(r.email || r.phone) && <p className="text-xs text-slate-400">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      {r.attended
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        : <XCircle className="h-4 w-4 text-slate-300" />}
                      <Switch
                        checked={!!r.attended}
                        onCheckedChange={v => updateMutation.mutate({ id: r.id, data: { attended: v } })}
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
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