import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";

/**
 * Returns pending join requests visible to the current user (admin/leader).
 * RLS handles filtering; we just SELECT all pending in tenant.
 */
export function usePendingJoinRequests() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-join-requests", tenantId, user?.id],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("unit_join_requests")
          .select(`
            id, request_type, unit_name, wsf_centre_id, status, created_at, decline_reason,
            member:members ( id, first_name, last_name, photo_url, email, phone ),
            wsf_centre:wsf_centres ( id, name, location )
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && !!user?.id,
  });
}

/**
 * Counts pending requests visible to current user (for badge).
 */
export function usePendingJoinRequestCount() {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-join-request-count", tenantId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_pending_join_requests_for_user", {
        _user_id: user.id,
        _tenant_id: tenantId,
      });
      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!tenantId && !!user?.id,
  });
}

export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId) => {
      const { error } = await supabase.rpc("approve_join_request", { p_request_id: requestId });
      if (error) throw error;
      return requestId;
    },
    onSuccess: (requestId) => {
      toast({ title: "Request approved" });
      qc.invalidateQueries({ queryKey: ["pending-join-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-join-request-count"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["dashboard-members"] });
      // Notify member (email + SMS) — fire and forget
      supabase.functions
        .invoke("notify-join-decision", {
          body: { request_id: requestId, decision: "approved" },
        })
        .catch((e) => console.error("notify-join-decision invoke error:", e));
    },
    onError: (err) => toast({ title: "Approval failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeclineJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, reason }) => {
      const { error } = await supabase.rpc("decline_join_request", {
        p_request_id: requestId,
        p_reason: reason || null,
      });
      if (error) throw error;
      return { requestId, reason };
    },
    onSuccess: ({ requestId, reason }) => {
      toast({ title: "Request declined" });
      qc.invalidateQueries({ queryKey: ["pending-join-requests"] });
      qc.invalidateQueries({ queryKey: ["pending-join-request-count"] });
      // Notify member (email + SMS) — fire and forget
      supabase.functions
        .invoke("notify-join-decision", {
          body: { request_id: requestId, decision: "declined", reason: reason || null },
        })
        .catch((e) => console.error("notify-join-decision invoke error:", e));
    },
    onError: (err) => toast({ title: "Decline failed", description: err.message, variant: "destructive" }),
  });
}

/**
 * Helper: given a member's existing approved units/centre, and the form's selected values,
 * returns:
 *   - unitsToRequest: string[] — unit names the member is asking to join
 *   - centreToRequest: uuid|null — centre id the member is asking to join
 *   - removedUnits: string[] — unit names removed (apply immediately)
 *   - centreRemoved: boolean — whether centre was cleared
 *
 * Comparison is case-insensitive for unit names.
 */
export function diffUnitMembership({
  existingUnits = "",
  selectedUnits = "",
  existingCentreId = null,
  selectedCentreId = null,
}) {
  const splitNorm = (s) =>
    (s || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const ex = splitNorm(existingUnits);
  const sel = splitNorm(selectedUnits);
  const lcSet = (arr) => new Set(arr.map((x) => x.toLowerCase()));
  const exLc = lcSet(ex);
  const selLc = lcSet(sel);

  const unitsToRequest = sel.filter((u) => !exLc.has(u.toLowerCase()));
  const removedUnits = ex.filter((u) => !selLc.has(u.toLowerCase()));

  const centreChanged = (selectedCentreId || null) !== (existingCentreId || null);
  const centreToRequest = centreChanged && selectedCentreId ? selectedCentreId : null;
  const centreRemoved = centreChanged && !selectedCentreId && !!existingCentreId;

  return { unitsToRequest, removedUnits, centreToRequest, centreRemoved };
}

/**
 * Submits pending join requests for the given diff.
 * Caller is responsible for already-applying the *removals* directly to the member row.
 */
export async function submitJoinRequests({ tenantId, memberId, requestedBy, unitsToRequest = [], centreToRequest = null }) {
  const rows = [];
  for (const unit of unitsToRequest) {
    rows.push({
      tenant_id: tenantId,
      member_id: memberId,
      request_type: "unit",
      unit_name: unit,
      requested_by: requestedBy || null,
    });
  }
  if (centreToRequest) {
    rows.push({
      tenant_id: tenantId,
      member_id: memberId,
      request_type: "home_cell",
      wsf_centre_id: centreToRequest,
      requested_by: requestedBy || null,
    });
  }
  if (rows.length === 0) return { inserted: [] };

  // Insert one-by-one to tolerate unique-pending conflicts gracefully
  const inserted = [];
  for (const row of rows) {
    const { data, error } = await supabase
      .from("unit_join_requests")
      .insert(row)
      .select("id, request_type, unit_name, wsf_centre_id")
      .single();
    if (error) {
      // ignore duplicate pending; surface other errors
      if (!String(error.message || "").toLowerCase().includes("duplicate")) {
        console.error("submitJoinRequests insert error:", error);
      }
      continue;
    }
    inserted.push(data);
  }

  // Fire-and-forget notification per inserted request
  for (const r of inserted) {
    supabase.functions
      .invoke("notify-join-request", {
        body: {
          request_id: r.id,
          tenant_id: tenantId,
          member_id: memberId,
          request_type: r.request_type,
          unit_name: r.unit_name || null,
          wsf_centre_id: r.wsf_centre_id || null,
        },
      })
      .catch((e) => console.error("notify-join-request invoke error:", e));
  }

  return { inserted };
}
