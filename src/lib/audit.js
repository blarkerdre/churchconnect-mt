import { supabase } from "@/integrations/supabase/client";

/**
 * Log an admin action to the audit_log table.
 * Automatically injects tenant_id from the user's current tenant membership.
 * @param {string} action - e.g. "role_change", "member_delete", "member_create"
 * @param {string} entityType - e.g. "user_roles", "members"
 * @param {string|null} entityId - ID of the affected entity
 * @param {object|null} details - Additional context (old/new values, names, etc.)
 * @param {string|null} tenantId - Optional tenant_id to inject
 */
export async function logAudit(action, entityType, entityId = null, details = null, tenantId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const payload = {
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    };
    if (tenantId) payload.tenant_id = tenantId;

    await supabase.from("audit_log").insert(payload);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
