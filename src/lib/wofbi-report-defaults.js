// Structure for the Bible School (WOFBI) course final report.
// Mirrors the Cardiff WOFBI BCC report template.

export const FINDING_FIELDS = [
  { key: "attendance", label: "Attendance" },
  { key: "registration", label: "Registration" },
  { key: "breaks", label: "Class breaks" },
  { key: "phones", label: "Mobile phones" },
  { key: "reminders", label: "Post induction reminders" },
  { key: "marking", label: "Answer sheet marking & grading" },
  { key: "coordinator", label: "Class coordinator" },
  { key: "graduation", label: "Graduation" },
  { key: "summary", label: "Summary" },
];

export const DEFAULT_FINDINGS = {
  attendance: "Majority of all the students were in attendance.",
  registration:
    "Majority of the students registered before the induction, and some came on the first day to complete the registration.",
  breaks: "The scheduled breaks were observed all through the session.",
  phones: "All the students adhered to instructions regarding mobile phones.",
  reminders:
    "On Day 1 of the course, the Bible School Team provided the induction to keep all students aware of the rules and regulations of the Institute.",
  marking:
    "The marking and grading process was submitted on the last day by the Bible School Team.",
  coordinator:
    "The class coordinators for most of the time managed the class well and ensured that the rules were obeyed. They also ensured classes were tidied up at the end of the day.",
  graduation:
    "The graduation ceremony was held with majority of the graduating students in attendance with their guests. Awards and gifts were presented to graduates based on Outstanding Performance, Punctuality, Perseverance, and Responsibility.",
  summary:
    "In summary, majority of the students were satisfied with the delivery of the courses and stated they would recommend the Bible School to their families and friends. They all testified of the impact that the course had on their lives.",
};

export function emptyReport() {
  return {
    cover: {
      institute_name: "WORD OF FAITH BIBLE INSTITUTE",
      centre_name: "",
      church_name: "",
      course_title: "",
      course_code: "",
      edition: "",
      date_range: "",
      logo_url: "",
    },
    introduction: "",
    faculty: { coordinating: [], volunteers: [] },
    induction: { date: "", students: "" },
    class_attendance: "",
    stats_a: {
      water_baptised: "",
      holy_ghost: "",
      new_birth: "",
      testimonies: "",
    },
    stats_b: {
      forms_received: "",
      registered_confirmed: "",
      completed: "",
      at_graduation: "",
      absentees: "",
    },
    nations: [],
    courses: [],
    findings: { ...DEFAULT_FINDINGS },
    overall_performance: "",
    testimonies: [],
    student_feedback: [],
    qc: [],
    honorarium: [],
    honorarium_matrix: { rate: 50, rows: [] },
    next_session: "",
  };
}

export function mergeReport(saved) {
  const base = emptyReport();
  if (!saved || typeof saved !== "object") return base;
  return {
    ...base,
    ...saved,
    cover: { ...base.cover, ...(saved.cover || {}) },
    faculty: { ...base.faculty, ...(saved.faculty || {}) },
    induction: { ...base.induction, ...(saved.induction || {}) },
    stats_a: { ...base.stats_a, ...(saved.stats_a || {}) },
    stats_b: { ...base.stats_b, ...(saved.stats_b || {}) },
    findings: { ...base.findings, ...(saved.findings || {}) },
    honorarium_matrix: {
      ...base.honorarium_matrix,
      ...(saved.honorarium_matrix || {}),
    },
  };
}
