import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SermonRichEditor from "@/components/sermons/SermonRichEditor";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Plus, Check, X, Maximize2, Minimize2, Pencil, ChevronUp } from "lucide-react";

const NONE = "__none__";
const NEW = "__new__";

export default function SermonNoteFormDialog({ open, onOpenChange, note, folders = [], defaultFolderId = null, onSaved }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [category, setCategory] = useState("");
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState(NONE);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [metaExpanded, setMetaExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title || "");
        setSpeaker(note.speaker || "");
        setCategory(note.category || "");
        setServiceDate(note.service_date || format(new Date(), "yyyy-MM-dd"));
        setContent(note.content || "");
        setFolderId(note.folder_id || NONE);
      } else {
        setTitle("");
        setSpeaker("");
        setCategory("");
        setServiceDate(format(new Date(), "yyyy-MM-dd"));
        setContent("");
        setFolderId(defaultFolderId || NONE);
      }
      setCreatingFolder(false);
      setNewFolderName("");
    }
  }, [open, note, defaultFolderId]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (metaExpanded) {
          setMetaExpanded(false);
        } else {
          setExpanded(false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expanded, metaExpanded]);

  const handleFolderChange = (value) => {
    if (value === NEW) {
      setCreatingFolder(true);
      return;
    }
    setFolderId(value);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("sermon_note_folders")
      .insert({ name, user_id: user.id, tenant_id: tenantId })
      .select()
      .single();
    if (error) {
      toast.error(error.message?.includes("duplicate") ? "A folder with that name already exists." : "Failed to create folder.");
      return;
    }
    toast.success("Folder created.");
    queryClient.invalidateQueries({ queryKey: ["sermon_note_folders"] });
    setFolderId(data.id);
    setCreatingFolder(false);
    setNewFolderName("");
  };

  const handleSave = async () => {
    const stripped = content.replace(/<[^>]*>/g, "").trim();
    if (!stripped) {
      toast.error("Please write some notes before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim() || null,
        speaker: speaker.trim() || null,
        category: category.trim() || null,
        service_date: serviceDate,
        content: content.trim(),
        folder_id: folderId === NONE ? null : folderId,
        user_id: user.id,
        tenant_id: tenantId,
      };

      if (note) {
        const { error } = await supabase
          .from("sermon_notes")
          .update({
            title: payload.title,
            speaker: payload.speaker,
            category: payload.category,
            service_date: payload.service_date,
            content: payload.content,
            folder_id: payload.folder_id,
          })
          .eq("id", note.id)
          .eq("user_id", user.id);

        if (error) throw error;
        toast.success("Note updated.");
      } else {
        const { error } = await supabase.from("sermon_notes").insert(payload);
        if (error) throw error;
        toast.success("Note saved.");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to save note.");
    } finally {
      setSaving(false);
    }
  };

  const MetadataFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="sn-title">Sermon Title (optional)</Label>
        <Input id="sn-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Power of Faith" maxLength={200} />
      </div>
      <div>
        <Label htmlFor="sn-speaker">Speaker (optional)</Label>
        <Input id="sn-speaker" value={speaker} onChange={(e) => setSpeaker(e.target.value)} placeholder="e.g. Pastor John" maxLength={100} />
      </div>
      <div>
        <Label htmlFor="sn-category">Category (optional)</Label>
        <Input id="sn-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Faith, Prayer, Worship" maxLength={50} />
      </div>
      <div>
        <Label>Folder</Label>
        {creatingFolder ? (
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(); }
                if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
              }}
              autoFocus
              maxLength={60}
            />
            <Button type="button" size="icon" variant="ghost" onClick={handleCreateFolder}>
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Select value={folderId} onValueChange={handleFolderChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unfiled</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
              <SelectItem value={NEW}>
                <span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Create new folder…</span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="sn-date">Service date</Label>
        <Input id="sn-date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) setExpanded(false); }}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-1rem)] p-4 sm:p-6 flex flex-col",
          expanded ? "max-w-6xl h-[92vh]" : "max-w-2xl max-h-[92vh]"
        )}
      >
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "New Sermon Note"}</DialogTitle>
        </DialogHeader>
        <div className={cn(
          "space-y-4 flex-1 min-h-0 pr-1",
          expanded ? "flex flex-col overflow-hidden" : "overflow-y-auto"
        )}>
          {!expanded && <MetadataFields />}
          {expanded && !metaExpanded && (
            <div className="shrink-0 rounded-md border border-border bg-muted/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{title || "Untitled note"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[speaker, serviceDate, category].filter(Boolean).join(" · ") || "No details"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMetaExpanded(true)}
                className="h-7 px-2 gap-1 shrink-0"
                title="Edit note details"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="text-xs">Edit details</span>
              </Button>
            </div>
          )}
          {expanded && metaExpanded && (
            <div className="shrink-0 space-y-4">
              <MetadataFields />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMetaExpanded(false)}
                  className="h-7 px-2 gap-1"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-xs">Hide details</span>
                </Button>
              </div>
            </div>
          )}
          <div className={cn("flex flex-col", expanded && "flex-1 min-h-0")}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <Label>Notes *</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setExpanded((v) => !v)}
                className="h-7 px-2 gap-1"
                title={expanded ? "Collapse notes editor" : "Expand notes editor"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="text-xs hidden sm:inline">{expanded ? "Collapse" : "Expand"}</span>
              </Button>
            </div>
            <SermonRichEditor content={content} onChange={setContent} expanded={expanded} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
