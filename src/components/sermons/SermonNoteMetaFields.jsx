import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Check } from "lucide-react";

export const NONE = "__none__";
export const NEW = "__new__";

export default function SermonNoteMetaFields({
  title,
  setTitle,
  speaker,
  setSpeaker,
  category,
  setCategory,
  serviceDate,
  setServiceDate,
  folderId,
  folders = [],
  onFolderChange,
  creatingFolder,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
  onCancelCreateFolder,
}) {
  return (
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
                if (e.key === "Enter") { e.preventDefault(); onCreateFolder(); }
                if (e.key === "Escape") { onCancelCreateFolder(); }
              }}
              autoFocus
              maxLength={60}
            />
            <Button type="button" size="icon" variant="ghost" onClick={onCreateFolder}>
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onCancelCreateFolder}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Select value={folderId} onValueChange={onFolderChange}>
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
}
