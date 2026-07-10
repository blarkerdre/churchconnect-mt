export const SCORE_LABELS = {
  1: "Very poor",
  2: "Poor",
  3: "Average",
  4: "Good",
  5: "Excellent",
};

// The four items that contribute to the QC total score (max 20).
export const SCORE_FIELDS = [
  { key: "started_on_time", label: "1. Timeliness of lecturer (starting on time)" },
  { key: "finished_on_time", label: "2. Timeliness of lecturer (finishing on time)" },
  { key: "orderliness_score", label: "4. Orderliness of the class" },
  { key: "content_focus_score", label: "5. Content focus" },
];

export const YES_NO_FIELDS = [
  { key: "introduced_self", label: "3. Lecturer introduced self?" },
  { key: "conducted_test", label: "6. Lecturer conducted test?" },
  { key: "class_recorded", label: "9. This class was recorded" },
  { key: "recording_submitted", label: "10. Recording submitted" },
];

export const TIER_OPTIONS = ["BFC", "BCC", "LCC", "LDC"];
