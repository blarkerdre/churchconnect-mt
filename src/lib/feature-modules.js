// Single source of truth for tenant-toggleable modules.
// Add a new entry here and it will automatically appear in Tenant Admin → Modules
// and be honored by sidebar/route filtering via `disabled_features`.
export const FEATURE_MODULES = [
  { key: "members", label: "Members", description: "Member directory and management" },
  { key: "events", label: "Events", description: "Event scheduling and registration" },
  { key: "attendance", label: "Attendance", description: "Unit meeting attendance tracking" },
  { key: "followups", label: "Follow-ups", description: "Follow-up task management" },
  { key: "pastoral-care", label: "Pastoral Care", description: "Pastoral care requests and tracking" },
  { key: "communications", label: "Communications", description: "Announcements, email, and messaging" },
  { key: "transportation", label: "Transportation", description: "Transport booking and management" },
  { key: "analytics", label: "Analytics", description: "Attendance and growth analytics" },
  { key: "training-reports", label: "Training Reports", description: "BFC and training progress" },
  { key: "church-attendance", label: "Church Attendance", description: "Sunday service attendance" },
  { key: "exam-management", label: "Bible School", description: "Exam sessions and results" },
  { key: "wsf", label: "Home Cell Centres", description: "Home Cell Fellowship management" },
  { key: "sms", label: "SMS", description: "SMS messaging capability" },
  { key: "sermon-notes", label: "Sermon Notes", description: "Sermon notes management" },
  { key: "testimony", label: "Testimony", description: "Member testimony sharing" },
  { key: "children-church", label: "Children Church", description: "Secure child drop-off, pickup PIN, guardians & delegations" },
  { key: "unit-tasks", label: "Unit Tasks", description: "Task groups, assignments, and comments for units" },
  { key: "inventory", label: "Inventory", description: "Items, categories, and inspection checklists" },
  { key: "reports", label: "Reports Hub", description: "Cross-module reports for the Reports Officer role" },
  { key: "certificates", label: "Certificates", description: "Issue and approve training/course certificates" },
  { key: "phone-call", label: "Phone Call", description: "Outbound phone calls via configured voice provider" },
  { key: "whatsapp", label: "WhatsApp", description: "WhatsApp messaging via configured provider" },
  { key: "my-family", label: "My Family", description: "Family profile, children and teens registered by parents" },
  { key: "dashboard-slideshow", label: "Dashboard Slideshow", description: "Banner and Book of the Month carousel on the dashboard" },
  { key: "trivia", label: "Bible Trivia", description: "Daily and weekly scripture quizzes with streaks and leaderboards" },

];
