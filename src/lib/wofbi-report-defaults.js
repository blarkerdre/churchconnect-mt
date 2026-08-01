// Structure for the Bible School (WOFBI) course final report.
// Mirrors the Cardiff WOFBI BCC report template — all text below is a starting
// point that the user can edit freely in the report editor.

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
    "The marking and grading process for the course was submitted on the last day by the Bible School Team.",
  coordinator:
    "The class coordinators for most of the time managed the class well and ensured that the rules were obeyed. They also ensured classes were tidied up at the end of the day.",
  graduation:
    "The graduation ceremony was held and majority of the graduating students were in attendance with their guests. At the Graduation Ceremony, awards and gifts were presented to graduates based on Outstanding Performance, Punctuality, Perseverance, and Responsibility. It was a glorious moment of thanksgiving to God for the successful completion of the course and the life changing impact it had on the students.",
  summary:
    "In summary, majority of the students were satisfied with the delivery of the courses and stated they would all recommend the Bible School to their families and friends. Majority of the students would like to progress to the next level. They all testified of the impact that the course had on their lives.",
};

export const DEFAULT_OVERALL_PERFORMANCE =
  "The overall performance of the students was excellent.";

export const DEFAULT_NEXT_SESSION =
  "The next Bible School training session to be held at the Learning Centre is scheduled for the next quarter.";

export const DEFAULT_TESTIMONY_HEADING = "Testimony at Bible School";

/**
 * Template introduction, with the course / edition / centre woven in where known.
 */
export function buildIntroduction({ course = "", edition = "", centre = "", church = "" } = {}) {
  const courseLabel = course || "the course";
  const editionLabel = edition ? `${edition} Edition of ` : "";
  const place = [centre, church].filter(Boolean).join(", ");
  return [
    `To God alone be all the Glory for the successful and impactful completion of the ${editionLabel}${courseLabel}${
      place ? ` held at ${place}` : ""
    }.`,
    `This report provides a summary of findings from ${courseLabel}${
      edition ? ` — ${edition}` : ""
    }. It must be noted that the session birthed greater interest for Bible School attendance as it spreads across members from other stations, and this is a breakthrough that has been made possible only by the grace of God.`,
    "The students all confirmed their lives have taken a different and positive turn since they started and completed the classes. They were excited about taking up their positions in life and expressing the seed of greatness deposited in them. Some of them received their healings, some received directions, and some received breakthroughs at work while going through the Bible School (Romans 8:19).",
  ].join("\n\n");
}

export const DEFAULT_FACULTY = {
  coordinating: [
    "Pst. [Name] - Resident Pastor / Chairman & Bible School Coordinator",
    "Pst. [Name] - Associate Pastor / Vice Chairman",
  ],
  volunteers: ["Pst. [Name]", "Bro. [Name]", "Dcns. [Name]"],
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
    introduction: buildIntroduction(),
    faculty: {
      coordinating: [...DEFAULT_FACULTY.coordinating],
      volunteers: [...DEFAULT_FACULTY.volunteers],
    },
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
    overall_performance: DEFAULT_OVERALL_PERFORMANCE,
    testimonies: [],
    student_feedback: [],
    qc: [],
    honorarium: [],
    honorarium_matrix: { rate: 50, rows: [] },
    next_session: DEFAULT_NEXT_SESSION,
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
