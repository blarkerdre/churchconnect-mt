import { useAppSetting } from "@/hooks/useAppSetting";

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
 * Hook to check if a sub-feature is enabled.
 * Returns { enabled: boolean, isLoading: boolean }
 */
export function useSubFeature(key) {
  const { data: disabledSubFeatures = [], isLoading } = useAppSetting("disabled_sub_features", []);
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
