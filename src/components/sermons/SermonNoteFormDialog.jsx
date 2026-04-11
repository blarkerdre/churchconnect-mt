import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SermonRichEditor from "@/components/sermons/SermonRichEditor";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SermonNoteFormDialog({ open, onOpenChange, note, onSaved }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [category, setCategory] = useState("");
  const [serviceDate, setServiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState("");

  useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title || "");
        setSpeaker(note.speaker || "");
        setCategory(note.category || "");
        setServiceDate(note.service_date || format(new Date(), "yyyy-MM-dd"));
        setContent(note.content || "");
      } else {
        setTitle("");
        setSpeaker("");
        setCategory("");
        setServiceDate(format(new Date(), "yyyy-MM-dd"));
        setContent("");
      }
    }
  }, [open, note]);

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
        user_id: user.id,
        tenant_id: tenantId,
      };

      if (note) {
        const { error } = await supabase
          .from("sermon_notes")
          .update({ title: payload.title, speaker: payload.speaker, category: payload.category, service_date: payload.service_date, content: payload.content })
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
