import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, Edit, FileText, ArrowUpDown, MoreVertical, Folder, Inbox, CheckSquare, X, FolderInput } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import SermonNoteFormDialog from "@/components/sermons/SermonNoteFormDialog";
import SermonFolderSidebar from "@/components/sermons/SermonFolderSidebar";
import { cn } from "@/lib/utils";
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enterSelection = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(processed.map((n) => n.id)));
  };

  const handleBulkMove = async (folderId) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("sermon_notes")
      .update({ folder_id: folderId })
      .in("id", ids)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error("Failed to move notes.");
      return;
    }
    toast.success(`Moved ${ids.length} note${ids.length === 1 ? "" : "s"}${folderId ? "" : " to Unfiled"}.`);
    queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });
    exitSelection();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { setBulkDeleteOpen(false); return; }
    const { error } = await supabase
      .from("sermon_notes")
      .delete()
      .in("id", ids)
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);
    if (error) {
      toast.error("Failed to delete notes.");
    } else {
      toast.success(`Deleted ${ids.length} note${ids.length === 1 ? "" : "s"}.`);
      queryClient.invalidateQueries({ queryKey: ["sermon_notes"] });
      exitSelection();
    }
    setBulkDeleteOpen(false);
  };

  const headerLabel =
    selectedFolder === "all" ? "All Notes"
    : selectedFolder === "uncategorised" ? "Unfiled"
    : (folderMap[selectedFolder]?.name || "Folder");

  const selectedCount = selectedIds.size;
  const allFilteredSelected = processed.length > 0 && processed.every((n) => selectedIds.has(n.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Sermon Notes</h1>
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <Button variant="outline" size="sm" onClick={exitSelection}>
              <X className="h-4 w-4 mr-1" /> Done
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={enterSelection} disabled={notes.length === 0}>
              <CheckSquare className="h-4 w-4 mr-1" /> Select
            </Button>
          )}
          <Button onClick={() => { setEditNote(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Note
          </Button>
        </div>
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

          {selectionMode && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 backdrop-blur p-2.5 shadow-sm">
              <span className="text-sm font-medium pl-1">{selectedCount} selected</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={allFilteredSelected ? () => setSelectedIds(new Set()) : selectAllFiltered}
                disabled={processed.length === 0}
              >
                {allFilteredSelected ? "Clear" : "Select all"}
              </Button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={selectedCount === 0}>
                    <FolderInput className="h-3.5 w-3.5 mr-1" /> Move to
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleBulkMove(null)}>
                    <Inbox className="h-3.5 w-3.5 mr-2" /> Unfiled
                  </DropdownMenuItem>
                  {folders.length > 0 && <DropdownMenuSeparator />}
                  {folders.map((f) => (
                    <DropdownMenuItem key={f.id} onClick={() => handleBulkMove(f.id)}>
                      <Folder className="h-3.5 w-3.5 mr-2" /> {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedCount === 0}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          )}

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
                const isSelected = selectedIds.has(n.id);
                const handleCardClick = () => {
                  if (selectionMode) toggleSelect(n.id);
                  else { setEditNote(n); setFormOpen(true); }
                };
                return (
                  <Card
                    key={n.id}
                    className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow",
                      isSelected && "ring-2 ring-primary"
                    )}
                    onClick={handleCardClick}
                  >
                    <CardContent className="pt-4 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {selectionMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(n.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{n.title || "Untitled"}</p>
                            {n.speaker && <p className="text-sm text-muted-foreground truncate">{n.speaker}</p>}
                          </div>
                        </div>
                        {!selectionMode && (
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
                        )}
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} note{selectedCount === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
