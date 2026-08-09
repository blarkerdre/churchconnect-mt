# Fix: bulk download of Statements of Result fails

## What's happening

The backend job that builds the bulk statements is running out of processing time. The function logs for `render-statements-bulk` show repeated `CPU Time exceeded` errors this morning (09:20, 09:30, 09:33), each ending the request before a file is produced — so the download never appears and you get a failure toast.

Why it runs out of time: the job repeats all the expensive work for every single student in the batch. For each student it re-reads the certificate template, re-reads the tenant record, re-signs the image URLs, then re-downloads and re-encodes the church logo and the signature image before drawing the page. With a batch size of up to 50 students, that's up to 50 identical logo downloads and 50 identical encodes, plus jsPDF storing the same image bytes once per page.

A second, smaller problem: the finished file is opened with `window.open` after several awaits, which browsers commonly block as a popup, so even a successful run can look like nothing happened.

## The fix

1. Load shared data once per request
   - Fetch the course, certificate template, tenant record and signed image URLs a single time, then reuse them for every student in the batch.
   - Download and encode the logo and signature image once, and register them with jsPDF under an alias so the same bytes aren't embedded again on every page.

2. Fetch student data in bulk instead of per student
   - Replace the per-student queries (member, registration, session, attempts, sequence lookup) with batched queries over the whole member list, then assemble each student's page from the in-memory results.

3. Safer batch size
   - Lower the server cap from 50 to 15 students per request and chunk on the client to match, keeping each invocation comfortably inside the processing limit.
   - For merged PDFs across multiple chunks, produce one file per chunk and name them clearly (e.g. `statement-of-result-merged-1of3.pdf`) so nothing is silently lost.

4. Reliable download
   - Trigger the download with a temporary anchor element (`download` attribute) instead of `window.open`, so it isn't blocked as a popup.
   - Show a clear error toast that distinguishes "timed out, try a smaller selection" from other failures.

## Technical notes
- Files: `supabase/functions/render-statements-bulk/index.ts`, `supabase/functions/_shared/generate-statement.ts`, `supabase/functions/_shared/statement-pdf.ts`, `src/components/exams/CourseResultsView.jsx`.
- `collectStatementInput` gains a shared-context parameter (course, template, tenant, encoded images) so the bulk path can pass it in; the single-statement path (`render-statement-pdf`) keeps working unchanged by building that context for one student.
- `renderStatementOnDoc` accepts pre-encoded image data instead of fetching by URL.
- No database changes.
