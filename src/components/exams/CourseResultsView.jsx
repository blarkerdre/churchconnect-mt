import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";

export default function CourseResultsView({ course }) {
  const { data: subjects = [] } = useQuery({
    queryKey: ["exam-subjects", course.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("*")
        .eq("course_id", course.id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!course.id,
  });

  const subjectIds = subjects.map(s => s.id);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["course-attempts", course.id, subjectIds],
    queryFn: async () => {
      if (subjectIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, members(first_name, last_name)")
        .in("subject_id", subjectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: subjectIds.length > 0,
  });

  // Group by member
  const memberMap = {};
  attempts.forEach(a => {
    if (!a.subject_id) return;
    if (!memberMap[a.member_id]) {
      memberMap[a.member_id] = {
        name: `${a.members?.first_name || ""} ${a.members?.last_name || ""}`.trim(),
        subjects: {},
        totalScore: 0,
        totalPoints: 0,
      };
    }
    const m = memberMap[a.member_id];
    const pct = a.total_points > 0 ? a.score / a.total_points : 0;
    const existing = m.subjects[a.subject_id];
    const existingPct = existing ? (existing.total_points > 0 ? existing.score / existing.total_points : 0) : -1;

    if (!existing || pct > existingPct) {
      if (existing) {
        m.totalScore -= existing.score;
        m.totalPoints -= existing.total_points;
      }
      m.subjects[a.subject_id] = { score: a.score, total_points: a.total_points };
      m.totalScore += a.score;
      m.totalPoints += a.total_points;
    }
  });

  const members = Object.entries(memberMap).map(([id, m]) => ({
    id,
    ...m,
    percentage: m.totalPoints > 0 ? (m.totalScore / m.totalPoints) * 100 : 0,
    subjectsTaken: Object.keys(m.subjects).length,
    passed: m.totalPoints > 0 && ((m.totalScore / m.totalPoints) * 100) >= course.pass_mark_percentage,
  }));

  const totalParticipants = members.length;
  const totalPassed = members.filter(m => m.passed && m.subjectsTaken === subjects.length).length;

  const buildPrintRows = () => ({
    title: `${course.name} — Course Results`,
    headers: ["Member", ...subjects.map(s => s.name), "Total", "%", "Status"],
    rows: members.map(m => [
      m.name,
      ...subjects.map(s => {
        const sub = m.subjects[s.id];
        return sub ? `${sub.score}/${sub.total_points}` : "—";
      }),
      `${m.totalScore}/${m.totalPoints}`,
      `${Math.round(m.percentage)}%`,
      m.passed && m.subjectsTaken === subjects.length ? "Passed" : "Incomplete",
    ]),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> {course.name} — Course Results
          </CardTitle>
          {members.length > 0 && <PrintReportButton buildRows={buildPrintRows} label="Print Results" />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No exam attempts for this course yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Participants:</span> <strong>{totalParticipants}</strong>
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Passed:</span> <strong>{totalPassed}</strong>
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Pass mark:</span> <strong>{course.pass_mark_percentage}%</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    {subjects.map(s => <TableHead key={s.id} className="text-center text-xs">{s.name}</TableHead>)}
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{m.name}</TableCell>
                      {subjects.map(s => {
                        const sub = m.subjects[s.id];
                        return (
                          <TableCell key={s.id} className="text-center text-xs">
                            {sub ? `${sub.score}/${sub.total_points}` : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-sm font-semibold">{m.totalScore}/{m.totalPoints}</TableCell>
                      <TableCell className="text-center text-sm">{Math.round(m.percentage)}%</TableCell>
                      <TableCell className="text-center">
                        {m.subjectsTaken < subjects.length ? (
                          <Badge variant="outline" className="text-[10px]">{m.subjectsTaken}/{subjects.length}</Badge>
                        ) : (
                          <Badge variant={m.passed ? "default" : "destructive"} className="text-[10px]">
                            {m.passed ? "Passed" : "Failed"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
