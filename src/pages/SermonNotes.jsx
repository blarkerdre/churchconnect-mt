import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Trash2, Edit, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SermonNoteFormDialog from "@/components/sermons/SermonNoteFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export default function SermonNotes() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["sermon_notes", user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sermon_notes")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tenantId,
  });

  const filtered = notes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.speaker && n.speaker.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.service_date && n.service_date.includes(q))
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("sermon_notes").delete().eq("id", deleteId).eq("user_id", user.id);
    if (error) {
      toast.error("Failed to delete note.");
    } else {
      toast.success("Note deleted.");
      queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });
    }
    setDeleteId(null);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Sermon Notes</h1>
        <Button onClick={() => { setEditNote(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>{search ? "No notes match your search." : "No sermon notes yet. Tap 'New Note' to start."}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <Card key={n.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setEditNote(n); setFormOpen(true); }}>
              <CardContent className="pt-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{n.title || "Untitled"}</p>
                    {n.speaker && <p className="text-sm text-muted-foreground truncate">{n.speaker}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditNote(n); setFormOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(n.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(n.service_date), "PPP")}</p>
                <p className="text-sm line-clamp-3 text-muted-foreground">{n.content?.replace(/<[^>]*>/g, "") || ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SermonNoteFormDialog open={formOpen} onOpenChange={setFormOpen} note={editNote} onSaved={refresh} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
