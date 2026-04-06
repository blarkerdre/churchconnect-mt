import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Download, Award } from "lucide-react";
import { getGradeClassification } from "@/lib/grade-utils";
import { useTenant } from "@/contexts/TenantContext";

function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function StatementOfResult({ open, onOpenChange, member, course, subjects, memberSubjects }) {
  const { currentTenant } = useTenant();
  if (!member || !course) return null;

  const classifications = course.grade_classifications || [
    { label: "Distinction", min_percentage: 75 },
    { label: "Merit", min_percentage: 65 },
    { label: "Pass", min_percentage: 50 },
  ];

  const rows = subjects.map(s => {
    const sub = memberSubjects[s.id];
    const pct = sub && sub.total_points > 0 ? (sub.score / sub.total_points) * 100 : 0;
    const grade = sub ? getGradeClassification(pct, classifications) : "—";
    return { name: s.name, score: sub?.score ?? 0, total: sub?.total_points ?? 0, pct, grade, taken: !!sub };
  });

  const totalScore = rows.reduce((s, r) => s + r.score, 0);
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const overallGrade = getGradeClassification(overallPct, classifications);

  const gradeVariant = (grade) => {
    if (grade === "Distinction") return "default";
    if (grade === "Merit") return "secondary";
    if (grade === "Fail") return "destructive";
    return "outline";
  };

  const handlePrint = () => {
    const logoHtml = currentTenant?.logo_url
      ? `<img src="${escHtml(currentTenant.logo_url)}" style="height:48px;margin-bottom:8px;" />`
      : "";
    const churchName = currentTenant?.name || "";
    const subjectRows = rows.map(r =>
      `<tr><td>${escHtml(r.name)}</td><td class="c">${r.taken ? r.score : "—"}</td><td class="c">${r.taken ? r.total : "—"}</td><td class="c">${r.taken ? Math.round(r.pct) + "%" : "—"}</td><td class="c"><strong>${r.grade}</strong></td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Statement of Result</title><style>
      body{font-family:Arial,sans-serif;margin:32px;color:#111}
      .header{text-align:center;margin-bottom:24px}
      .header h1{font-size:20px;color:#1e3a5f;margin:4px 0}
      .header h2{font-size:16px;color:#333;margin:4px 0;font-weight:normal}
      .header p{font-size:12px;color:#666}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px}
      tr:nth-child(even) td{background:#f8fafc}
      .c{text-align:center}
      .footer{margin-top:16px;padding:12px;background:#f0f4f8;border-radius:6px;text-align:center}
      .footer .grade{font-size:18px;font-weight:bold;color:#1e3a5f}
      @media print{body{margin:0}}
    </style></head><body>
      <div class="header">
        ${logoHtml}
        <h1>${escHtml(churchName)}</h1>
        <h2>Statement of Result</h2>
        <p><strong>Course:</strong> ${escHtml(course.name)} &nbsp;|&nbsp; <strong>Student:</strong> ${escHtml(member.name)}</p>
        <p>Generated: ${escHtml(new Date().toLocaleDateString("en-GB"))}</p>
      </div>
      <table>
        <thead><tr><th>Subject</th><th class="c">Score</th><th class="c">Total</th><th class="c">%</th><th class="c">Grade</th></tr></thead>
        <tbody>${subjectRows}</tbody>
        <tfoot><tr style="font-weight:bold;background:#e8edf3"><td>AGGREGATE</td><td class="c">${totalScore}</td><td class="c">${totalPoints}</td><td class="c">${Math.round(overallPct)}%</td><td class="c">${escHtml(overallGrade)}</td></tr></tfoot>
      </table>
      <div class="footer">
        <p>Overall Classification</p>
        <p class="grade">${escHtml(overallGrade)}</p>
      </div>
    </body></html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownloadCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Subject", "Score", "Total", "%", "Grade"];
    const csvRows = rows.map(r => [r.name, r.taken ? r.score : "", r.taken ? r.total : "", r.taken ? `${Math.round(r.pct)}%` : "", r.grade].map(esc).join(","));
    csvRows.push(["AGGREGATE", totalScore, totalPoints, `${Math.round(overallPct)}%`, overallGrade].map(esc).join(","));
    const csv = [headers.map(esc).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.name}_${member.name}_statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <TenantDialogHeader>
          <Award className="h-4 w-4 text-primary" /> Statement of Result
        </TenantDialogHeader>

        <div className="space-y-4">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">{course.name}</p>
            <p className="text-sm text-muted-foreground">{member.name}</p>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.name}>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-center text-sm">{r.taken ? r.score : "—"}</TableCell>
                    <TableCell className="text-center text-sm">{r.taken ? r.total : "—"}</TableCell>
                    <TableCell className="text-center text-sm">{r.taken ? `${Math.round(r.pct)}%` : "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={gradeVariant(r.grade)} className="text-[10px]">{r.grade}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="text-sm font-bold">AGGREGATE</TableCell>
                  <TableCell className="text-center text-sm font-bold">{totalScore}</TableCell>
                  <TableCell className="text-center text-sm font-bold">{totalPoints}</TableCell>
                  <TableCell className="text-center text-sm font-bold">{Math.round(overallPct)}%</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={gradeVariant(overallGrade)} className="text-xs">{overallGrade}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
