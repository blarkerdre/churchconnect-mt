

## Fix: Certificate Not Printing Signatory Name and Title

### Root Cause
The edge function (`issue-certificate/index.ts`) looks up `certificate_templates` using an **exact match** on `training_type` (line 97–101). When a certificate is issued — especially auto-issued from WoFBI exam completion — the `training_type` value (e.g. the course name from `exam_titles`) may not exactly match the template's `training_type`. This causes the lookup to return nothing, and signatory defaults to empty string, so it's omitted from the SVG.

### Fix

**1. Edge function — case-insensitive + trimmed lookup (`supabase/functions/issue-certificate/index.ts`)**
- Change the template query from `.eq("training_type", training_type)` to `.ilike("training_type", training_type.trim())`
- This handles minor casing/whitespace mismatches

**2. Add a fallback "default" template**
- If no template matches the specific training_type, do a second query for a template with `training_type = 'Default'`
- This lets the admin set a default signatory that applies to all certificates without needing a template per type

**3. Update `CertificateTemplateSettings.jsx`**
- Add a hint in the UI explaining that a "Default" template will be used as fallback when no specific template matches

### Technical Detail
```
// In issue-certificate/index.ts
let { data: template } = await supabase
  .from("certificate_templates")
  .select("*")
  .ilike("training_type", training_type.trim())
  .maybeSingle();

// Fallback to default template
if (!template) {
  const { data: defaultTpl } = await supabase
    .from("certificate_templates")
    .select("*")
    .ilike("training_type", "default")
    .maybeSingle();
  template = defaultTpl;
}
```

### Files to change
- `supabase/functions/issue-certificate/index.ts` — improve template lookup with ilike + default fallback
- `src/components/certificates/CertificateTemplateSettings.jsx` — add helper text about "Default" template

