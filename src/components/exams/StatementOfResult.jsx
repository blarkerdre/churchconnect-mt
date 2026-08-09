import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Printer, Download, Award, FileDown, Loader2 } from "lucide-react";
import { getGradeClassification, getLetterGrade, LETTER_GRADE_BANDS, resolveLetterGradeBands } from "@/lib/grade-utils";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchCourseTemplate } from "@/lib/certificate-template-lookup";
import { toImageDataUrl, aspectStyle } from "@/lib/logo-data-url";
import { useResolvedBrandingUrl } from "@/lib/branding-url";

function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function deriveCourseCode(course) {
  if (course?.course_code) return String(course.course_code).toUpperCase();
  const m = String(course?.name || "").match(/\(([^)]+)\)/);
  if (m) return m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
  const initials = String(course?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return initials || "CRS";
}

function deriveTenantCode(tenant) {
  const slug = String(tenant?.slug || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (slug && slug.length <= 6) return slug;
  const initials = String(tenant?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
  return initials || slug.slice(0, 6) || "ORG";
}

function formatSessionLabel(session) {
  const dateStr = session?.starts_at || session?.starts_on || session?.created_at;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.toLocaleString("en-GB", { month: "long" }).toUpperCase()} ${d.getFullYear()}`;
    }
  }
  if (session?.name) return String(session.name).toUpperCase();
  const now = new Date();
  return `${now.toLocaleString("en-GB", { month: "long" }).toUpperCase()} ${now.getFullYear()}`;
}

/**
 * Loads session, student number, and template metadata for a member's
 * statement of result. Shared by the standalone dialog and the inline preview.
 */
function useStatementData({ enabled, member, course, subjects }) {
  const { currentTenant } = useTenant();
  const [session, setSession] = useState(null);
  const [studentNumber, setStudentNumber] = useState("");
  const [template, setTemplate] = useState(null);

  useEffect(() => {
    if (!enabled || !member?.id || !course?.id || !currentTenant?.id) return;
    let cancelled = false;

    (async () => {
      const { data: reg } = await supabase
        .from("course_registrations")
        .select("id, student_number, session_id, registered_at")
        .eq("tenant_id", currentTenant.id)
        .eq("course_id", course.id)
        .eq("member_id", member.id)
        .maybeSingle();

      let sess = null;
      if (reg?.session_id) {
        const { data } = await supabase
          .from("exam_sessions")
          .select("id, name, starts_at, starts_on, ended_at, created_at")
          .eq("id", reg.session_id)
          .eq("tenant_id", currentTenant.id)
          .maybeSingle();
        sess = data;
      }
      if (!sess) {
        const subjectIds = (subjects || []).map((s) => s.id);
        if (subjectIds.length) {
          const { data: attempts } = await supabase
            .from("exam_attempts")
            .select("session_id, submitted_at, created_at")
            .eq("member_id", member.id)
            .eq("tenant_id", currentTenant.id)
            .in("subject_id", subjectIds)
            .not("session_id", "is", null)
            .order("submitted_at", { ascending: false, nullsFirst: false });
          const sid = attempts?.find((a) => a.session_id)?.session_id;
          if (sid) {
            const { data } = await supabase
              .from("exam_sessions")
              .select("id, name, starts_at, starts_on, ended_at, created_at")
              .eq("id", sid)
              .eq("tenant_id", currentTenant.id)
              .maybeSingle();
            sess = data;
          }
        }
      }

      let seq = 1;
      if (reg?.id) {
        let q = supabase
          .from("course_registrations")
          .select("id, registered_at")
          .eq("tenant_id", currentTenant.id)
          .eq("course_id", course.id)
          .order("registered_at", { ascending: true });
        if (sess?.id) q = q.eq("session_id", sess.id);
        const { data: allRegs } = await q;
        const idx = (allRegs || []).findIndex((r) => r.id === reg.id);
        if (idx >= 0) seq = idx + 1;
      }

      const tmpl = await fetchCourseTemplate({ tenantId: currentTenant.id, course });

      if (cancelled) return;
      setSession(sess);
      setTemplate(tmpl || null);

      const stored = reg?.student_number && String(reg.student_number).trim();
      if (stored) {
        setStudentNumber(stored);
      } else {
        const tenantCode = deriveTenantCode(currentTenant);
        const courseCode = deriveCourseCode(course);
        const sessionLabel = formatSessionLabel(sess).replace(/\s+/g, "/");
        const seqStr = String(100 + seq).padStart(3, "0");
        setStudentNumber(`${tenantCode}/${courseCode}/${sessionLabel}/${seqStr}`);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, member?.id, course?.id, currentTenant?.id, subjects]);

  return { session, studentNumber, template, currentTenant };
}

/**
 * Inline preview of the Statement of Result — no Dialog wrapper, no action
 * buttons. Reused by `StatementOfResult` and `SendResultsDialog`.
 */
export function StatementPreview({ member, course, subjects, memberSubjects, enabled = true }) {
  const { session, studentNumber, template, currentTenant } = useStatementData({
    enabled,
    member,
    course,
    subjects,
  });

  if (!member || !course) return null;

  const classifications = course.grade_classifications || [
    { label: "Distinction", min_percentage: 75 },
    { label: "Merit", min_percentage: 65 },
    { label: "Pass", min_percentage: 50 },
  ];
  const letterBands = resolveLetterGradeBands(course);

  const rows = (subjects || []).map((s) => {
    const sub = (memberSubjects || {})[s.id];
    const pct = sub && sub.total_points > 0 ? (sub.score / sub.total_points) * 100 : 0;
    const letter = sub ? getLetterGrade(pct, letterBands).letter : "—";
    return { name: s.name, score: sub?.score ?? 0, total: sub?.total_points ?? 0, pct, letter, taken: !!sub };
  });

  const totalScore = rows.reduce((s, r) => s + r.score, 0);
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const overallGrade = getGradeClassification(overallPct, classifications);

  const sessionLabel = formatSessionLabel(session);
  const churchName = template?.church_name || currentTenant?.name || "";
  const centreName =
    template?.centre_name ||
    (currentTenant?.name && template?.church_name && template.church_name !== currentTenant.name
      ? currentTenant.name
      : "");
  const rawLogoUrl =
    template?.wofbi_logo_url ||
    template?.crest_image_url ||
    template?.logo_url ||
    currentTenant?.logo_url ||
    "";
  const logoUrl = useResolvedBrandingUrl(rawLogoUrl);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 border-b pb-3">
        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-24 w-auto max-w-[280px] object-contain mx-auto mb-1" /> : null}
        <p className="text-2xl font-black tracking-wide">{(churchName || "").toUpperCase()}</p>
        {centreName ? <p className="text-sm font-bold uppercase tracking-wide">{centreName.toUpperCase()}</p> : null}
        <p className="text-sm font-bold">STATEMENT OF RESULT</p>
        <p className="text-sm font-bold">
          {(course.name || "").toUpperCase()} {sessionLabel}
        </p>
      </div>

      <div className="flex justify-between items-baseline text-sm">
        <div>
          <span className="font-bold">NAME: </span>
          <span className="text-base font-serif text-primary">{member.name}</span>
        </div>
        <div className="font-bold underline text-xs">{studentNumber || "—"}</div>
      </div>

      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] bg-primary/10 px-3 py-2 text-xs font-bold">
          <div>Module Title</div>
          <div className="text-right">Grades</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-[1fr_auto] px-3 py-1.5 text-sm border-t border-border/50"
          >
            <div className="uppercase">{r.name}</div>
            <div className="text-right font-bold tabular-nums">{r.taken ? r.letter : "—"}</div>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto] bg-primary/10 px-3 py-2 text-sm font-bold border-t">
          <div />
          <div className="text-right">Overall Result: {overallGrade}</div>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold italic underline mb-1">Explanatory Notes</p>
        <div className="grid grid-cols-2 gap-x-4 text-[11px]">
          <div className="font-semibold">Result</div>
          <div className="font-semibold">Grades</div>
          {letterBands.map((b) => (
            <React.Fragment key={b.letter}>
              <div>{b.label}</div>
              <div>{b.letter} &nbsp;{b.min}-{b.max}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StatementOfResult({ open, onOpenChange, member, course, subjects, memberSubjects }) {
  const { currentTenant } = useTenant();
  const { session, studentNumber, template } = useStatementData({
    enabled: open,
    member,
    course,
    subjects,
  });
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  if (!member || !course) return null;

  const classifications = course.grade_classifications || [
    { label: "Distinction", min_percentage: 75 },
    { label: "Merit", min_percentage: 65 },
    { label: "Pass", min_percentage: 50 },
  ];
  const letterBands = resolveLetterGradeBands(course);
  const rows = (subjects || []).map((s) => {
    const sub = (memberSubjects || {})[s.id];
    const pct = sub && sub.total_points > 0 ? (sub.score / sub.total_points) * 100 : 0;
    const letter = sub ? getLetterGrade(pct, letterBands).letter : "—";
    return { name: s.name, score: sub?.score ?? 0, total: sub?.total_points ?? 0, pct, letter, taken: !!sub };
  });
  const totalScore = rows.reduce((s, r) => s + r.score, 0);
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const overallGrade = getGradeClassification(overallPct, classifications);

  const sessionLabel = formatSessionLabel(session);
  const churchName = template?.church_name || currentTenant?.name || "";
  const centreName =
    template?.centre_name ||
    (currentTenant?.name && template?.church_name && template.church_name !== currentTenant.name
      ? currentTenant.name
      : "");
  const logoUrl =
    template?.wofbi_logo_url ||
    template?.crest_image_url ||
    template?.logo_url ||
    currentTenant?.logo_url ||
    "";
  const signatoryName = template?.signatory_name || "";
  const signatoryTitle = template?.signatory_title || "";
  const signatureUrl = template?.dean_signature_url || "";

  const handlePrint = async () => {
    const [logoImg, signatureImg] = await Promise.all([
      toImageDataUrl(logoUrl),
      toImageDataUrl(signatureUrl),
    ]);
    if (logoUrl && !logoImg) {
      toast.warning("Logo could not be loaded — printing without it.");
    }
    const subjectRows = rows
      .map(
        (r) => `
        <tr>
          <td>${escHtml(r.name.toUpperCase())}</td>
          <td class="grade">${r.taken ? escHtml(r.letter) : "—"}</td>
        </tr>`
      )
      .join("");

    const notesRows = letterBands.map(
      (b) => `<tr><td>${escHtml(b.label)}</td><td>${escHtml(b.letter)}&nbsp;&nbsp;${b.min}-${b.max}</td></tr>`
    ).join("");

    const logoHtml = logoImg
      ? `<img src="${logoImg.dataUrl}" alt="Logo" style="${aspectStyle(logoImg, 130, 360)}margin:0 auto 6px;display:block;object-fit:contain;" />`
      : "";

    const centreLine = centreName
      ? `<div class="centre">${escHtml(centreName.toUpperCase())}</div>`
      : "";

    const watermarkHtml = logoUrl
      ? `<div class="watermark">WOFBI</div>`
      : "";

    const signatureHtml = signatureImg
      ? `<img src="${signatureImg.dataUrl}" alt="Signature" style="${aspectStyle(signatureImg, 60, 220)}object-fit:contain;" />`
      : `<div style="border-bottom:1px solid #333;width:180px;height:40px;"></div>`;

    const html = `<!DOCTYPE html><html><head><title>Statement of Result — ${escHtml(member.name)}</title>
      <style>
        @page { size: A4; margin: 14mm 18mm; }
        html, body { margin:0; padding:0; }
        body { font-family: 'Cambria', 'Georgia', serif; color:#111; position:relative; }
        #sheet-wrap { width:100%; }
        #sheet { transform-origin: top left; page-break-inside: avoid; break-inside: avoid; }
        .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-family:'Impact','Arial Black',sans-serif; font-size:180px; color:rgba(0,0,0,0.07); letter-spacing:10px; z-index:0; pointer-events:none; }
        .header, .name-row, table.modules, .notes, .signature { position:relative; z-index:1; }
        .header { text-align:center; margin-bottom:14px; }
        .header h1 { font-family: 'Impact', 'Arial Black', sans-serif; font-size:34px; margin:4px 0; letter-spacing:1px; word-break:break-word; }
        .centre { font-size:15px; font-weight:bold; margin-top:6px; }
        .title { font-size:14px; font-weight:bold; margin-top:2px; }
        .course-line { font-size:14px; font-weight:bold; margin-top:2px; }
        .name-row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin: 14px 0 6px; font-size:14px; }
        .name-row .label { font-weight:bold; }
        .name-row .name { font-size:21px; color:#6b3fa0; font-family: 'Georgia', serif; margin-left:6px; word-break:break-word; }
        .name-row .ref { text-decoration:underline; font-weight:bold; white-space:nowrap; }
        table.modules { width:100%; border-collapse:collapse; margin-top:4px; table-layout:fixed; }
        table.modules thead th {
          background:#dbe5f1; color:#000; text-align:left;
          padding:7px 10px; font-size:13px; border-bottom:1px solid #b7c7d9;
        }
        table.modules thead th.grade, table.modules col.grade { text-align:right; }
        table.modules td { padding:5px 10px; font-size:13px; word-break:break-word; }
        table.modules td.grade { text-align:right; font-weight:bold; white-space:nowrap; width:22%; }
        table.modules tfoot td {
          background:#dbe5f1; font-weight:bold; padding:7px 10px; font-size:13px;
          border-top:1px solid #b7c7d9;
        }
        .notes { margin-top:14px; }
        .notes .heading { font-style:italic; font-weight:bold; text-decoration:underline; margin-bottom:5px; }
        table.notes-table td { padding:2px 24px 2px 0; font-size:12px; }
        .signature { margin-top:26px; display:flex; align-items:flex-end; gap:16px; }
        .signature .who { font-size:12px; }
        @media print { body { margin:0; } }
      </style></head><body>
      ${watermarkHtml}
      <div id="sheet-wrap"><div id="sheet">
      <div class="header">
        ${logoHtml}
        <h1>${escHtml((churchName || "").toUpperCase())}</h1>
        ${centreLine}
        <div class="title">STATEMENT OF RESULT</div>
        <div class="course-line">${escHtml((course.name || "").toUpperCase())} ${escHtml(sessionLabel)}</div>
      </div>

      <div class="name-row">
        <div><span class="label">NAME:</span><span class="name">${escHtml(member.name)}</span></div>
        <div class="ref">${escHtml(studentNumber)}</div>
      </div>

      <table class="modules">
        <thead>
          <tr><th>Module Title</th><th class="grade">Grades</th></tr>
        </thead>
        <tbody>${subjectRows}</tbody>
        <tfoot>
          <tr><td></td><td class="grade">Overall Result:&nbsp;&nbsp;${escHtml(overallGrade)}</td></tr>
        </tfoot>
      </table>

      <div class="notes">
        <div class="heading">Explanatory Notes</div>
        <table class="notes-table">
          <tr><td><b>Result</b></td><td><b>Grades</b></td></tr>
          ${notesRows}
        </table>
      </div>

      <div class="signature">
        <div>
          ${signatureHtml}
          <div class="who">
            ${signatoryName ? `<div><b>${escHtml(signatoryName)}</b></div>` : ""}
            ${signatoryTitle ? `<div>${escHtml(signatoryTitle)}</div>` : ""}
          </div>
        </div>
      </div>
      </div></div>
      <script>
        window.__fitOnePage = function () {
          var sheet = document.getElementById('sheet');
          if (!sheet) return;
          sheet.style.transform = '';
          // A4 height (297mm) minus 14mm top/bottom margins, at 96dpi.
          var maxPx = (297 - 28) / 25.4 * 96;
          var h = sheet.scrollHeight;
          if (h > maxPx) {
            var s = Math.max(0.5, maxPx / h);
            sheet.style.transform = 'scale(' + s + ')';
            sheet.style.width = (100 / s) + '%';
          }
        };
      <\/script>
    </body></html>`;


    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) {
      toast.error("Pop-up blocked — allow pop-ups to print.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();

    const doc = win.document;
    const pending = Array.from(doc.images || []).filter((i) => !i.complete);
    const go = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* user can print manually */
      }
    };
    if (!pending.length) {
      setTimeout(go, 150);
    } else {
      let left = pending.length;
      const done = () => {
        left -= 1;
        if (left <= 0) setTimeout(go, 150);
      };
      pending.forEach((img) => {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
      setTimeout(() => {
        if (left > 0) {
          left = 0;
          go();
        }
      }, 4000);
    }
  };

  const handleDownloadCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Module", "Score", "Total", "%", "Letter"];
    const csvRows = rows.map((r) =>
      [r.name, r.taken ? r.score : "", r.taken ? r.total : "", r.taken ? `${Math.round(r.pct)}%` : "", r.letter]
        .map(esc)
        .join(",")
    );
    csvRows.push(["OVERALL", totalScore, totalPoints, `${Math.round(overallPct)}%`, overallGrade].map(esc).join(","));
    const csv = [headers.map(esc).join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.name}_${member.name}_statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!currentTenant?.id || !course?.id || !member?.id) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("render-statement-pdf", {
        body: { tenant_id: currentTenant.id, course_id: course.id, member_id: member.id },
      });
      if (error) throw error;
      if (!data?.signed_url) throw new Error("No download URL returned");
      const a = document.createElement("a");
      a.href = data.signed_url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = `${course.name}_${member.name}_statement.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Statement of Result PDF ready");
    } catch (e) {
      toast.error(e?.message || "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Award className="h-4 w-4 text-primary" /> Statement of Result
        </TenantDialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <StatementPreview
            member={member}
            course={course}
            subjects={subjects}
            memberSubjects={memberSubjects}
            enabled={open}
          />

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" className="gap-1.5" disabled={downloadingPdf} onClick={handleDownloadPdf}>
              {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
