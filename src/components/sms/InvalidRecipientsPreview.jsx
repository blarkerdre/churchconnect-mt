import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, ChevronDown, ChevronUp, User } from "lucide-react";

export default function InvalidRecipientsPreview({ invalidRecipients }) {
  const [expanded, setExpanded] = useState(false);

  if (!invalidRecipients || invalidRecipients.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between p-0 h-auto hover:bg-transparent text-destructive"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4" />
          {invalidRecipients.length} member{invalidRecipients.length !== 1 ? "s" : ""} with invalid numbers
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>

      {expanded && (
        <ScrollArea className="max-h-32">
          <div className="space-y-1.5 pt-1">
            {invalidRecipients.map((r, i) => {
              const name = r.first_name
                ? `${r.first_name} ${r.last_name || ""}`.trim()
                : r.name || "Unknown";
              const rawPhone = r.rawPhone || r.phone || "—";
              return (
                <div
                  key={r.id || r.member_id || i}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-background/60"
                >
                  <span className="flex items-center gap-1.5 text-foreground">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {name}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono text-destructive border-destructive/20">
                    {rawPhone}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <p className="text-[11px] text-muted-foreground">
        These members will be skipped. Update their phone numbers in the Members page to include them.
      </p>
    </div>
  );
}
