import { supabase } from "@/integrations/supabase/client";

/**
 * Records a Bible School activity for the signed-in user:
 *  - an in-app notification receipt (bell) for that user only
 *  - an audit_log row so the activity shows in System Logs → Audit
 *
 * Runs through the `log_wofbi_activity` SECURITY DEFINER function because
 * students/QC officers cannot insert into notifications or audit_log directly.
 * Failures are swallowed — logging must never block the user's action.
 */
export async function logWofbiActivity(tenantId, { action, entityType, entityId = null, title = null, message = null, details = {} } = {}) {
  if (!tenantId || !action || !entityType) return;
  try {
    await supabase.rpc("log_wofbi_activity", {
      _tenant_id: tenantId,
      _action: action,
      _entity_type: entityType,
      _entity_id: entityId ? String(entityId) : null,
      _title: title,
      _message: message,
      _details: details || {},
    });
  } catch (err) {
    console.warn("[wofbi-activity] log failed", action, err);
  }
}
