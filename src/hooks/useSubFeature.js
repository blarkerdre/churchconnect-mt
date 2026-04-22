import { useAppSetting } from "@/hooks/useAppSetting";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Sub-feature registry — maps parent feature paths to toggleable sub-features.
 */
export const SUB_FEATURES = {
  "/members": [
    { key: "members.add_member", name: "Add Member" },
    { key: "members.bulk_import", name: "Bulk Import" },
    { key: "members.qr_code", name: "Registration QR Code" },
    { key: "members.certificate", name: "Issue Certificate" },
    { key: "members.csv_export", name: "CSV Export" },
  ],
  "/events": [
    { key: "events.create", name: "Create Event" },
    { key: "events.sms", name: "SMS Attendees" },
  ],
  "/communications": [
    { key: "communications.announcements", name: "Announcements" },
    { key: "communications.email", name: "Email Alerts" },
    { key: "communications.sms", name: "SMS" },
    { key: "communications.whatsapp", name: "WhatsApp" },
  ],
  "/followups": [
    { key: "followups.create", name: "Create Follow-up" },
    { key: "followups.sms", name: "SMS Follow-up" },
  ],
  "/pastoral-care": [
    { key: "pastoral.create_request", name: "Create Request" },
    { key: "pastoral.assign_cases", name: "Assign Cases" },
  ],
  "/transportation": [
    { key: "transportation.create_booking", name: "Create Booking" },
  ],
  "/analytics": [
    { key: "analytics.download_report", name: "Download Report" },
    { key: "analytics.milestone_report", name: "Member Milestones Report" },
    { key: "analytics.conversion_report", name: "Status Conversion Report" },
  ],
  "/training-reports": [
    { key: "training.record_session", name: "Record Session" },
    { key: "training.csv_export", name: "CSV Export" },
    { key: "training.print", name: "Print Report" },
    { key: "training.attachments", name: "Attachments" },
  ],
  "/church-attendance": [
    { key: "church_attendance.record", name: "Record Attendance" },
  ],
  "/exam-management": [
    { key: "wofbi.create_course", name: "Create Course" },
    { key: "wofbi.registration_qr", name: "Registration QR" },
  ],
  "/wsf": [
    { key: "wsf.record_attendance", name: "Record Attendance" },
  ],
  "/attendance": [
    { key: "attendance.create_session", name: "Create Session" },
  ],
  "/": [
    { key: "dashboard.self_checkin", name: "Self Check-In Widget" },
    { key: "dashboard.book_of_month", name: "Book of the Month" },
  ],
};

/**
 * Mapping from tenant-level feature flag keys (in tenants.settings.features)
 * to the route paths they control. When a tenant disables a feature,
 * it's treated as if the route is in disabled_features.
 */
const TENANT_FEATURE_TO_ROUTES = {
  sms_enabled: [], // SMS is a sub-feature, handled at sub-feature level
  exams_enabled: ["/exam-management"],
  transportation: ["/transportation"],
  pastoral_care: ["/pastoral-care"],
  wsf_enabled: ["/wsf"],
};

/**
 * Hook to check if a module route is enabled at the tenant level.
 * Returns true if the feature is enabled or if no tenant context is available.
 */
export function useTenantFeatureEnabled(routePath) {
  const { currentTenant } = useTenant();

  // Check disabled_features array first
  const disabledFeatures = currentTenant?.settings?.disabled_features || [];
  if (disabledFeatures.includes(routePath)) return false;

  // Check tenant-level feature flags
  if (!currentTenant?.settings?.features) return true;
  const features = currentTenant.settings.features;
  for (const [featureKey, routes] of Object.entries(TENANT_FEATURE_TO_ROUTES)) {
    if (routes.includes(routePath) && features[featureKey] === false) {
      return false;
    }
  }
  return true;
}

/**
 * Hook to check if a sub-feature is enabled.
 * Returns { enabled: boolean, isLoading: boolean }
 */
export function useSubFeature(key) {
  const { data: disabledSubFeatures = [], isLoading } = useAppSetting("disabled_sub_features", []);
  const { currentTenant } = useTenant();

  // Check tenant-level SMS toggle
  const tenantFeatures = currentTenant?.settings?.features;
  if (tenantFeatures?.sms_enabled === false) {
    const smsKeys = ["communications.sms", "communications.whatsapp", "events.sms", "followups.sms"];
    if (smsKeys.includes(key)) {
      return { enabled: false, isLoading };
    }
  }

  return {
    enabled: !disabledSubFeatures.includes(key),
    isLoading,
  };
}

/**
 * Hook to get the full disabled sub-features list (for Settings page).
 */
export function useDisabledSubFeatures() {
  return useAppSetting("disabled_sub_features", []);
}
