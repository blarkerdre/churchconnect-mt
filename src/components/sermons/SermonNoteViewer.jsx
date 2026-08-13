import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { X, Printer } from "lucide-react";
import { printSermonNote } from "@/lib/sermon-note-print";

export default function SermonNoteViewer({ note, folderName, churchName, logoUrl, onClose }) {
  const handlePrint = () => {
    printSermonNote(
      {
        title: note.title,
        speaker: note.speaker,
        category: note.category,
        folderName,
        serviceDate: note.service_date ? format(new Date(note.service_date), "PPP") : "",
        content: note.content,
      },
      { logoUrl, churchName },
    );
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex flex-col bg-background",
      "animate-in fade-in-0 zoom-in-95 duration-200"
    )}>
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4 shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate">{note.title || "Untitled note"}</h2>
          <p className="text-sm text-muted-foreground truncate">
            {[
              note.speaker,
              note.service_date && format(new Date(note.service_date), "PPP"),
              note.category,
              folderName,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <article
          className="prose dark:prose-invert max-w-none mx-auto sm:prose-lg"
          dangerouslySetInnerHTML={{ __html: note.content || "" }}
        />
      </div>
    </div>
  );
}
