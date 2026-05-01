import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, Edit, FileText, ArrowUpDown, MoreVertical, Folder, Inbox } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SermonNoteFormDialog from "@/components/sermons/SermonNoteFormDialog";
import SermonFolderSidebar from "@/components/sermons/SermonFolderSidebar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const SORT_OPTIONS = [
  { value: "date_desc", label: "Date (newest)" },
  { value: "date_asc", label: "Date (oldest)" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "speaker_asc", label: "Speaker A-Z" },
];

export default function SermonNotes() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("all");
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

  const { data: folders = [] } = useQuery({
    queryKey: ["sermon_note_folders", user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sermon_note_folders")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!tenantId,
  });

  const folderMap = useMemo(() => {
    const m = {};
    folders.forEach((f) => { m[f.id] = f; });
    return m;
  }, [folders]);

  const categories = useMemo(() => {
    const cats = new Set();
    notes.forEach((n) => n.category && cats.add(n.category));
    return Array.from(cats).sort();
  }, [notes]);

  const processed = useMemo(() => {
    let list = notes;

    if (selectedFolder === "uncategorised") {
      list = list.filter((n) => !n.folder_id);
    } else if (selectedFolder !== "all") {
      list = list.filter((n) => n.folder_id === selectedFolder);
    }

    if (categoryFilter !== "all") {
      list = list.filter((n) => n.category === categoryFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.speaker && n.speaker.toLowerCase().includes(q)) ||
          (n.category && n.category.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          (n.service_date && n.service_date.includes(q))
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case "date_asc":
        sorted.sort((a, b) => a.service_date.localeCompare(b.service_date));
        break;
      case "title_asc":
        sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "speaker_asc":
        sorted.sort((a, b) => (a.speaker || "").localeCompare(b.speaker || ""));
        break;
      default:
        sorted.sort((a, b) => b.service_date.localeCompare(a.service_date));
    }
    return sorted;
  }, [notes, search, sortBy, categoryFilter, selectedFolder]);

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

  const handleMoveToFolder = async (noteId, folderId) => {
    const { error } = await supabase
      .from("sermon_notes")
      .update({ folder_id: folderId })
      .eq("id", noteId)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error("Failed to move note.");
    } else {
      toast.success(folderId ? "Note moved." : "Note unfiled.");
      queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });
    }
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });

  const headerLabel =
    selectedFolder === "all" ? "All Notes"
    : selectedFolder === "uncategorised" ? "Unfiled"
    : (folderMap[selectedFolder]?.name || "Folder");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Sermon Notes</h1>
        <Button onClick={() => { setEditNote(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Note
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <SermonFolderSidebar
          folders={folders}
          notes={notes}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
        />

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{headerLabel}</h2>
            <span className="text-xs text-muted-foreground">({processed.length})</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categories.length > 0 && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : processed.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{search || categoryFilter !== "all" || selectedFolder !== "all" ? "No notes match your filters." : "No sermon notes yet. Tap 'New Note' to start."}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {processed.map((n) => {
                const folder = n.folder_id ? folderMap[n.folder_id] : null;
                return (
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleMoveToFolder(n.id, null)}>
                                <Inbox className="h-3.5 w-3.5 mr-2" /> Unfiled
                              </DropdownMenuItem>
                              {folders.length > 0 && <DropdownMenuSeparator />}
                              {folders.map((f) => (
                                <DropdownMenuItem
                                  key={f.id}
                                  disabled={f.id === n.folder_id}
                                  onClick={() => handleMoveToFolder(n.id, f.id)}
                                >
                                  <Folder className="h-3.5 w-3.5 mr-2" /> {f.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(n.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete note
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(n.service_date), "PPP")}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {folder && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Folder className="h-3 w-3" />{folder.name}
                          </Badge>
                        )}
                        {n.category && <Badge variant="secondary" className="text-xs">{n.category}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground max-h-[80px] overflow-y-auto">{n.content?.replace(/<[^>]*>/g, "") || ""}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SermonNoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        note={editNote}
        folders={folders}
        defaultFolderId={
          !editNote && selectedFolder !== "all" && selectedFolder !== "uncategorised"
            ? selectedFolder
            : null
        }
        onSaved={refresh}
      />

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
