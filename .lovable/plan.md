## What I checked

I extracted the attached `CARDIFF_WOFBI_REPORT-_BCC_AUGUST_2025.docx` and compared it section by section against the generator (`src/lib/wofbi-report-defaults.js`, `src/lib/wofbi-report-export.js`) and the editor (`src/components/exams/CourseReportTab.jsx`).

**Already matching:** cover block, 1 Introduction, 2 Faculty (coordinating + volunteers lists), 3 Induction, 4 Class attendance, 5a/5b statistics, 6 Nations, 7 Courses & lecturers table, 8 findings headings, 9 Striking testimonies, 10 feedback table, 11 QC table, honorarium table + matrix.

## Gaps found

1. **Section 10 narrative missing.** The template opens section 10 with two paragraphs of prose about student feedback (delivery clarity, interactivity, ratings 8–10 across board; suggestions about testing after each module, slide access, pace). The app renders only the table.
2. **Section 11 QC observations are unstructured.** The template lists 10 numbered points per lecturer (timeliness starting, timeliness finishing, introduced self, orderliness, content focus & score, submitted test, Q&A, general observations, class recorded, recording submitted). Autofill only copies `general_observations` from `lecturer_qc_checks` into one free-text cell.
3. **Closing REMARK + signature block missing entirely.** The template ends with an appreciation paragraph to lecturers and volunteers, then `Pastor <Name>` / `RP, <Church>`.
4. **Section numbering differs.** Template: 11 = QC, **13 = Honorarium Recommendation** (with the sub-heading "<COURSE> COURSE – <CENTRE>"). App uses 12 and has no sub-heading.
5. **Wording differences in section 8 defaults:**
   - Graduation text omits the "held on <date>" clause the template carries.
   - Summary omits "progress to the next level which is the LCC (Leadership Certificate Course)".
   - Overall performance omits "All the students graduated with **DISTINCTION**."
   - Heading label "Class breaks" vs template "CLASS BREAKS"; "Mobile phones" vs "MOBILE PHONES:" (cosmetic only — export upper-cases already).
6. **Next session paragraph placement.** In the template it sits at the end of section 8; the app renders it as a separate numbered section 13.

## Fix

**`src/lib/wofbi-report-defaults.js`**
- Add `feedback_intro` (default = the two template paragraphs, editable), `closing_remark` (default = the appreciation paragraph), and `signoff: { name: "", title: "RP, [Church]" }` to `emptyReport()` and `mergeReport()`.
- Add `honorarium_heading` default (`"<COURSE> COURSE – <CENTRE>"`, filled from the cover).
- Add a `QC_CHECKLIST_FIELDS` list of the 10 template points.
- Update graduation / summary / overall-performance defaults to the exact template wording (with `[date]` and course-level placeholders so they stay editable).

**`src/lib/wofbi-report-export.js`**
- Render `feedback_intro` paragraphs before the section 10 table.
- Render each QC row's observations as the numbered 10-point list when structured values exist, falling back to the current free text.
- Renumber Honorarium to **13**, add the sub-heading line, and move the next-session paragraph to the tail of section 8 (keeping a final unnumbered paragraph, as in the template).
- Append the REMARK paragraph and the signature block after the honorarium matrix.

**`src/components/exams/CourseReportTab.jsx`**
- Add editable fields for feedback intro, closing remark, and sign-off name/title.
- Extend the QC row editor with the 10 checklist fields (Yes/No selects + general observations text).
- Autofill the checklist from the matching `lecturer_qc_checks` columns where they exist, and autofill sign-off/honorarium heading from tenant + cover data.

## Technical notes
No schema changes. Existing saved reports keep working — `mergeReport` supplies defaults for the new keys, and autofill only seeds empty values.
