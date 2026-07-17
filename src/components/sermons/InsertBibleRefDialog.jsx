import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOOKS, getKjv, lookupVerses, formatReference } from "@/lib/bible/refs";

export default function InsertBibleRefDialog({ open, onOpenChange, onInsert }) {
  const [bookIdx, setBookIdx] = useState(42); // John
  const [chapter, setChapter] = useState(3);
  const [verseStart, setVerseStart] = useState(16);
  const [verseEnd, setVerseEnd] = useState("");
  const [kjv, setKjv] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => { if (open) getKjv().then(setKjv); }, [open]);

  const maxChapter = kjv?.[bookIdx]?.c?.length || 150;
  const maxVerse = kjv?.[bookIdx]?.c?.[chapter - 1]?.length || 176;

  const ref = useMemo(() => {
    const verses = verseStart ? [{ start: parseInt(verseStart, 10), end: parseInt(verseEnd || verseStart, 10) }] : [];
    return { bookIdx, book: BOOKS[bookIdx][0], chapter: parseInt(chapter, 10), verses };
  }, [bookIdx, chapter, verseStart, verseEnd]);

  useEffect(() => {
    let alive = true;
    lookupVerses(ref).then((d) => { if (alive) setPreview(d); });
    return () => { alive = false; };
  }, [ref]);

  const handleInsert = () => {
    onInsert?.(formatReference(ref));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Insert Bible Verse</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Book</Label>
            <Select value={String(bookIdx)} onValueChange={(v) => { setBookIdx(parseInt(v,10)); setChapter(1); setVerseStart(1); setVerseEnd(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {BOOKS.map(([name, idx]) => (
                  <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Chapter</Label>
              <Input type="number" min={1} max={maxChapter} value={chapter} onChange={(e) => setChapter(e.target.value)} />
            </div>
            <div>
              <Label>Verse</Label>
              <Input type="number" min={1} max={maxVerse} value={verseStart} onChange={(e) => setVerseStart(e.target.value)} />
            </div>
            <div>
              <Label>To (opt.)</Label>
              <Input type="number" min={1} max={maxVerse} value={verseEnd} onChange={(e) => setVerseEnd(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-2 text-sm">
            <div className="text-xs font-semibold text-primary mb-1">{formatReference(ref)} · KJV</div>
            {preview?.verses?.length ? (
              <div className="max-h-[160px] overflow-y-auto leading-relaxed">
                {preview.verses.map((v) => (
                  <span key={v.n}><sup className="text-[10px] text-muted-foreground mr-0.5">{v.n}</sup>{v.text} </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No verse found.</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleInsert}>Insert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
