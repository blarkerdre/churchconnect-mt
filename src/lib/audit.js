import { supabase } from "@/integrations/supabase/client";

/**
 * Log an admin action to the audit_log table.
 * @param {string} action - e.g. "role_change", "member_delete", "member_create"
 * @param {string} entityType - e.g. "user_roles", "members"
 * @param {string|null} entityId - ID of the affected entity
 * @param {object|null} details - Additional context (old/new values, names, etc.)
 */
export async function logAudit(action, entityType, entityId = null, details = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
