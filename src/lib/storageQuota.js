import { supabase } from "@/integrations/supabase/client";

/**
 * Throws a friendly error if uploading `bytes` would exceed the tenant's
 * storage_limit_mb. Returns silently when the tenant has unlimited storage
 * (limit = 0) or when the upload fits.
 *
 * Safe to call before any storage.from(...).upload(...) site in the app.
 *
 * @param {string} tenantId
 * @param {number} bytes  Size of the file about to be uploaded
 */
export async function assertStorageAvailable(tenantId, bytes) {
  if (!tenantId) return; // platform-level files have no tenant quota
  const { data, error } = await supabase.rpc("check_tenant_storage_quota", {
    _tenant_id: tenantId,
    _added_bytes: Math.max(0, Math.floor(bytes || 0)),
  });
  if (error) {
    // Don't block uploads on a transient RPC failure; surface a console warning.
    console.warn("storage quota check failed:", error);
    return;
  }
  if (data === false) {
    const err = new Error(
      "Storage limit reached for this church. Please remove old files or ask a tenant admin to raise the storage allowance."
    );
    err.code = "STORAGE_LIMIT_REACHED";
    throw err;
  }
}

/**
 * Returns the current MB used by the tenant. 0 when the call fails.
 */
export async function getTenantStorageUsageMb(tenantId) {
  if (!tenantId) return 0;
  const { data, error } = await supabase.rpc("get_tenant_storage_usage_mb", {
    _tenant_id: tenantId,
  });
  if (error) {
    console.warn("storage usage fetch failed:", error);
    return 0;
  }
  return Number(data) || 0;
}
