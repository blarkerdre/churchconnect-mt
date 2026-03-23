

## Remove Hardcoded Training Types from Certificate Template Settings

### Change
In `src/components/certificates/CertificateTemplateSettings.jsx` (line 44-48), remove the hardcoded `defaults` array and build `allTypes` only from dynamic sources:
- "Default" (the fallback template option — keep this)
- Active courses from `exam_titles`
- Custom types from `app_settings` (`training_types` key)

### File: `src/components/certificates/CertificateTemplateSettings.jsx`
Replace the `allTypes` memo to remove the hardcoded `["BFC", "BCC", "LCC", "LDC", "Water Baptism", "WIT"]` array:

```js
const allTypes = useMemo(() => {
  const courseNames = courses.map(c => c.name);
  const merged = new Set(["Default", ...courseNames, ...(settingsTypes || [])]);
  return [...merged];
}, [courses, settingsTypes]);
```

### No other files or database changes needed

