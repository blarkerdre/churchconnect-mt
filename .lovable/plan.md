

## Plan: Add WhatsApp Tab to System Logs

### What Changes
Add a "WhatsApp" tab alongside Email and SMS in the System Logs page, filtering `sms_log` records by `channel = 'whatsapp'`.

### Changes

**`src/pages/SystemLogs.jsx`**

1. **Add WhatsApp icon** — Reuse the same `WhatsAppIcon` SVG component from Communications page (or define it inline here)

2. **Create `WhatsAppLogsPanel`** — Clone `SMSLogsPanel` but add `.eq("channel", "whatsapp")` to the query. Update empty-state text to "No WhatsApp logs found"

3. **Add WhatsApp tab trigger and content** (lines 407-414):
   - Add `<TabsTrigger value="whatsapp">` with the WhatsApp icon between SMS and Audit tabs
   - Add `<TabsContent value="whatsapp"><WhatsAppLogsPanel /></TabsContent>`

4. **Filter existing SMS tab** — Add `.eq("channel", "sms")` to `SMSLogsPanel` query so SMS tab only shows SMS messages (not WhatsApp)

5. **Add WhatsApp CSV headers** — Same as `SMS_CSV_HEADERS` but with a `Channel` column

6. **Update subtitle** — Change "Monitor emails, SMS, and admin activity" to include WhatsApp

