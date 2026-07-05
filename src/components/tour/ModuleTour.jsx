import React from "react";
import HelpButton from "./HelpButton";
import { useAutoTour } from "@/hooks/useAutoTour";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Drop-in per-page tour anchor. Matches the My Family / Children Church pattern:
 *   - Auto-launches the tour on first visit (persisted to user_tour_completions).
 *   - Renders a Tour "?" button so the user can replay it any time.
 *
 * Usage in a page:
 *   <ModuleTour tourId="members-v1" />
 *
 * Position defaults to floating in the top-right of the page content area
 * (below the app header) so it works regardless of the host page's layout.
 * Pass `inline` to render it as a plain HelpButton for pages that already
 * have a header row (like MyFamily/ChildrenChurch).
 */
export default function ModuleTour({ tourId, inline = false, extraCtx = {} }) {
  const auth = useAuth() || {};
  const { tenantMemberships = [] } = useTenant() || {};
  const ctx = {
    isAdmin: !!auth.isAdmin,
    isLeader: !!(auth.isUnitLeader || auth.isWSFLeader),
    isUnitLeader: !!auth.isUnitLeader,
    isWSFLeader: !!auth.isWSFLeader,
    isReportsOfficer: !!auth.isReportsOfficer,
    isTenantAdmin: !!auth.isTenantAdmin,
    isTenantOwner: !!auth.isTenantOwner,
    isSuperAdmin: (auth.roles || []).includes?.("super_admin"),
    hasMultipleTenants: tenantMemberships.length > 1,
    ...extraCtx,
  };
  useAutoTour(tourId, ctx);

  const dataTour = `${tourId.replace(/-v\d+$/, "")}-help`;

  if (inline) {
    return <HelpButton tourId={tourId} ctx={ctx} dataTour={dataTour} />;
  }
  return (
    <div className="fixed right-3 top-[70px] z-30 lg:right-8 lg:top-[76px]">
      <HelpButton tourId={tourId} ctx={ctx} dataTour={dataTour} />
    </div>
  );
}
