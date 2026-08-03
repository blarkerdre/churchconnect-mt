import { Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useExamSessionFilter,
  EXAM_SESSION_ALL,
  EXAM_SESSION_UNASSIGNED,
} from "@/contexts/ExamSessionFilterContext";

/** Global Session / Edition selector that scopes every Bible School tab. */
export default function SessionFilterBar({ className = "" }) {
  const { sessionId, setSessionId, sessions } = useExamSessionFilter();

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 ${className}`}>
      <Layers className="h-4 w-4 text-primary shrink-0" />
      <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Session / Edition
      </Label>
      <Select value={sessionId} onValueChange={setSessionId}>
        <SelectTrigger className="h-8 w-full sm:w-[280px] bg-background">
          <SelectValue placeholder="All editions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EXAM_SESSION_ALL}>All editions</SelectItem>
          <SelectItem value={EXAM_SESSION_UNASSIGNED}>Unassigned edition</SelectItem>
          {sessions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              {s.status ? ` · ${s.status}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-[11px] text-muted-foreground hidden md:inline">
        Applies to every tab below
      </span>
    </div>
  );
}
