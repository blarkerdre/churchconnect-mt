import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FolderOpen, Inbox, Layers, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function SermonFolderSidebar({
  folders,
  notes,
  selectedFolder,
  onSelectFolder,
}) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteFolder, setDeleteFolder] = useState(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sermon_note_folders"] });
    queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });
  };

  const counts = React.useMemo(() => {
    const map = { all: notes.length, uncat: 0 };
    notes.forEach((n) => {
      if (!n.folder_id) map.uncat += 1;
      else map[n.folder_id] = (map[n.folder_id] || 0) + 1;
    });
    return map;
  }, [notes]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase.from("sermon_note_folders").insert({
      name,
      user_id: user.id,
      tenant_id: tenantId,
    });
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "A folder with that name already exists." : "Failed to create folder.");
      return;
    }
    toast.success("Folder created.");
    setNewName("");
    setCreating(false);
    refresh();
  };

  const handleRename = async (id) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase
      .from("sermon_note_folders")
      .update({ name })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error("Failed to rename.");
      return;
    }
    toast.success("Folder renamed.");
    setEditingId(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteFolder) return;
    const { error } = await supabase
      .from("sermon_note_folders")
      .delete()
      .eq("id", deleteFolder.id)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error("Failed to delete folder.");
    } else {
      toast.success("Folder deleted. Notes moved to Unfiled.");
      if (selectedFolder === deleteFolder.id) onSelectFolder("all");
      refresh();
    }
    setDeleteFolder(null);
  };

  const item = (key, label, Icon, count, onClick, extras = null) => (
    <div
      key={key}
      className={cn(
        "group flex items-center gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors",
        selectedFolder === key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground shrink-0">{count}</span>
      {extras}
    </div>
  );

  return (
    <aside className="w-full lg:w-60 lg:shrink-0 space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2.5 mb-2">Folders</p>

      {item("all", "All Notes", Layers, counts.all, () => onSelectFolder("all"))}
      {item("uncategorised", "Unfiled", Inbox, counts.uncat, () => onSelectFolder("uncategorised"))}

      <div className="h-px bg-border my-2" />

      {folders.map((f) => {
        if (editingId === f.id) {
          return (
            <div key={f.id} className="flex items-center gap-1 px-1.5 py-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(f.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="h-8 text-sm"
                autoFocus
                maxLength={60}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(f.id)}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        return item(
          f.id,
          f.name,
          selectedFolder === f.id ? FolderOpen : Folder,
          counts[f.id] || 0,
          () => onSelectFolder(f.id),
          <div className="hidden group-hover:flex items-center gap-0.5 ml-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setEditingId(f.id); setEditName(f.name); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteFolder(f); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}

      {creating ? (
        <div className="flex items-center gap-1 px-1.5 py-1">
          <Input
            placeholder="Folder name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") { setCreating(false); setNewName(""); }
            }}
            className="h-8 text-sm"
            autoFocus
            maxLength={60}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreate}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setCreating(false); setNewName(""); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground mt-1"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" /> New Folder
        </Button>
      )}

      <AlertDialog open={!!deleteFolder} onOpenChange={(o) => !o && setDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder "{deleteFolder?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The folder will be removed. Any notes inside will be moved to <strong>Unfiled</strong> — your notes are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete folder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
