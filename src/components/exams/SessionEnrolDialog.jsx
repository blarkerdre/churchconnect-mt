import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/useAuth";

export default function SessionEnrolDialog({ session, sessionCourses, open, onOpenChange }) {
  const { user } = useAuth();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const courseTitles = sessionCourses.map(c => c.exam_title);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["enrol-members", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("members").select("id, first_name, last_name, email").order("first_name")
      );
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
  });

  // Find courses by titles -> ids
  const { data: courses = [] } = useQuery({
    queryKey: ["exam-titles-for-enrol", tenantId, courseTitles.join("|")],
    queryFn: async () => {
      if (courseTitles.length === 0) return [];
      const { data, error } = await scopeQuery(
        supabase.from("exam_titles").select("id, name").in("name", courseTitles)
      );
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open && courseTitles.length > 0,
  });

  // Existing registrations for this session
  const { data: existing = [] } = useQuery({
    queryKey: ["session-existing-regs", tenantId, session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_registrations")
        .select("member_id, course_id")
        .eq("tenant_id", tenantId)
        .eq("session_id", session.id);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const enrolledIds = useMemo(() => {
    const counts = {};
    existing.forEach(r => { counts[r.member_id] = (counts[r.member_id] || 0) + 1; });
    return counts;
  }, [existing]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const enrolMutation = useMutation({
    mutationFn: async () => {
      if (selected.size === 0 || courses.length === 0) return { inserted: 0 };
      const existingSet = new Set(existing.map(r => `${r.member_id}|${r.course_id}`));
      const rows = [];
      for (const memberId of selected) {
        for (const c of courses) {
          if (!existingSet.has(`${memberId}|${c.id}`)) {
            rows.push(withTenant({
              member_id: memberId,
              course_id: c.id,
              session_id: session.id,
            }));
          }
        }
      }
      if (rows.length === 0) return { inserted: 0 };
      const { error } = await supabase.from("course_registrations").insert(rows);
      if (error) throw error;
      return { inserted: rows.length };
    },
    onSuccess: ({ inserted }) => {
      qc.invalidateQueries({ queryKey: ["session-existing-regs", tenantId, session.id] });
      qc.invalidateQueries({ queryKey: ["course-registrations"] });
      qc.invalidateQueries({ queryKey: ["my-course-registrations"] });
      toast({ title: "Enrolled", description: `${inserted} registration(s) added.` });
      logAudit(
        "session_bulk_enrol",
        "exam_session",
        session.id,
        { member_count: selected.size, courses: courseTitles, inserted },
        tenantId,
      );
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <TenantDialogHeader>Enrol Members — {session.name}</TenantDialogHeader>
        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="flex flex-wrap gap-1">
            {courseTitles.map(c => <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>)}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…" className="pl-8" />
          </div>
          <div className="text-xs text-muted-foreground">
            {selected.size} selected · will create rows for {courseTitles.length} course(s) each
          </div>
          <div className="flex-1 overflow-y-auto border border-border rounded-lg divide-y divide-border">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No members match.</p>
            ) : filtered.map(m => {
              const fullyEnrolled = (enrolledIds[m.id] || 0) >= courses.length && courses.length > 0;
              return (
                <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} disabled={fullyEnrolled} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.first_name} {m.last_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.email}</div>
                  </div>
                  {fullyEnrolled && <Badge variant="outline" className="text-[10px]">Enrolled</Badge>}
                  {!fullyEnrolled && enrolledIds[m.id] > 0 && <Badge variant="secondary" className="text-[10px]">Partial</Badge>}
                </label>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => enrolMutation.mutate()} disabled={selected.size === 0 || enrolMutation.isPending}>
            {enrolMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enrol {selected.size || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
