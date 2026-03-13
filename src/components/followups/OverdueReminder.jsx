import React, { useState, useEffect } from "react";
import { AlertCircle, X, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function OverdueReminder({ overdueTasks, onSelectTask }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || overdueTasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">
              {overdueTasks.length} overdue follow-up{overdueTasks.length !== 1 ? "s" : ""} need attention
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {overdueTasks.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 transition-colors"
                >
                  <span className="font-medium">{t.person_name}</span>
                  <span className="text-red-400">·</span>
                  <span>Due {format(new Date(t.due_date), "dd MMM")}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              ))}
              {overdueTasks.length > 5 && (
                <Badge className="bg-red-100 text-red-600 border-red-200">+{overdueTasks.length - 5} more</Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-100"
          onClick={() => setDismissed(true)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}