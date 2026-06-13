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
import { Plus, Check, X } from "lucide-react";

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
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{note ? "Edit Note" : "New Sermon Note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
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
            <Input id="sn-date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
          <div>
            <Label>Notes *</Label>
            <SermonRichEditor content={content} onChange={setContent} />
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
