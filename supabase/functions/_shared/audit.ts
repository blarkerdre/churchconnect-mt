// Shared audit-log helper for edge functions.
// Writes to public.audit_log with a service-role client (bypasses RLS).

export type AuditPayload = {
  tenant_id: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
};

// deno-lint-ignore no-explicit-any
export async function writeAudit(serviceClient: any, payload: AuditPayload): Promise<void> {
  try {
    await serviceClient.from("audit_log").insert({
      tenant_id: payload.tenant_id,
      user_id: payload.user_id ?? null,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      details: payload.details ?? {},
    });
  } catch (err) {
    console.error("[audit] write failed", payload.action, err);
  }
}
