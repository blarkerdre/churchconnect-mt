// Declarative tour definitions. Each step targets an element via `[data-tour="…"]`.
// If a selector is missing on the page the step falls back to a centered modal — so
// tours degrade gracefully as pages change. Steps with `when: (ctx) => boolean`
// are filtered out for users who lack the relevant role.
//
// ctx keys available: { isAdmin, isTenantAdmin, isTenantOwner, isSuperAdmin,
//   isLeader, isUnitLeader, isWSFLeader, isReportsOfficer, isChildrenChurch }

const genericHeader = '[data-tour="page-help"]';

export const TOURS = {
  // ─── Dashboard / global overview ────────────────────────────────────────────
  "dashboard-v1": {
    title: "App overview",
    steps: [
      {
        selector: genericHeader,
        title: "Welcome to Church Management Suite",
        body: "Quick tour of the app. You can re-open it any time from the Tour button in the page header.",
      },
      {
        selector: '[data-tour="sidebar-nav"]',
        title: "Main navigation",
        body: "Use the sidebar to switch modules — Members, Events, Attendance, Follow-ups, Communications and more. Only modules you have access to appear here.",
      },
      {
        selector: '[data-tour="notification-bell"]',
        title: "Notifications",
        body: "Real-time alerts land here: announcements, follow-up assignments, pastoral care requests, check-in codes, and more.",
      },
      {
        selector: '[data-tour="dashboard-feed"]',
        title: "Church feed",
        body: "The dashboard shows announcements, birthdays, upcoming events and recent activity across the church.",
      },
      {
        selector: '[data-tour="tenant-switcher"]',
        title: "Switch churches",
        body: "If you belong to more than one church, switch between them here. Each switch is confirmed with your password.",
        when: (ctx) => ctx.hasMultipleTenants,
      },
    ],
  },

  // ─── My Profile ─────────────────────────────────────────────────────────────
  "my-profile-v1": {
    title: "My Profile walkthrough",
    steps: [
      { selector: genericHeader, title: "Your profile", body: "This is your personal space — keep your contact details, photo, and preferences up to date." },
      { selector: '[data-tour="profile-completion"]', title: "Complete your profile", body: "The completion banner shows what's still missing (photo, phone, birthday, address). A complete profile helps your leaders serve you better." },
      { selector: '[data-tour="profile-feed"]', title: "Your feed", body: "See announcements aimed at you, messages, and reactions." },
      { selector: '[data-tour="my-certificates"]', title: "Certificates", body: "Any training certificates issued to you appear here — download them any time." },
    ],
  },

  // ─── Members directory ──────────────────────────────────────────────────────
  "members-v1": {
    title: "Members walkthrough",
    steps: [
      { selector: genericHeader, title: "Members directory", body: "The full church directory. Search, filter, view profiles, and manage member records." },
      { selector: '[data-tour="members-add"]', title: "Add a member", body: "Register a new member here. Their profile carries through the rest of the app.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="members-import"]', title: "Bulk import", body: "Import multiple members from a spreadsheet — useful when migrating from another system.", when: (c) => c.isAdmin },
      { selector: '[data-tour="members-filters"]', title: "Filters & search", body: "Narrow by unit, status, or attendance state. Search matches name, email or phone." },
      { selector: '[data-tour="members-table"]', title: "Member list", body: "Click a row to open the full profile — status history, giving, pastoral care, unit membership and more." },
    ],
  },

  // ─── Events ─────────────────────────────────────────────────────────────────
  "events-v1": {
    title: "Events walkthrough",
    steps: [
      { selector: genericHeader, title: "Events", body: "Schedule services, meetings, and special events. Members register, react, and receive reminders." },
      { selector: '[data-tour="events-create"]', title: "Create an event", body: "Set title, date, delivery mode (in-person / online / hybrid), audience scoping, and optional recurrence.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="events-list"]', title: "Event list", body: "Cards show upcoming events. Click one for details, registrations, and reactions." },
    ],
  },

  // ─── Church Unit ────────────────────────────────────────────────────────────
  "church-unit-v1": {
    title: "Church Unit walkthrough",
    steps: [
      { selector: genericHeader, title: "Your unit", body: "This is your church unit's workspace — members, meetings, and communication scoped to your team." },
      { selector: '[data-tour="unit-members"]', title: "Unit members", body: "The people in your unit. Leaders can manage roles, assignments and communications from here." },
    ],
  },

  // ─── Unit Attendance ────────────────────────────────────────────────────────
  "attendance-v1": {
    title: "Attendance walkthrough",
    steps: [
      { selector: genericHeader, title: "Unit attendance", body: "Track attendance at unit meetings. Sessions capture who came, plus demographics." },
      { selector: '[data-tour="attendance-create"]', title: "New session", body: "Create a session for a meeting — set the date, unit, and topic.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="attendance-checkin"]', title: "Check-in panel", body: "Mark members present. Members can also self check-in from their dashboard when the session is open." },
    ],
  },

  // ─── Church Attendance ──────────────────────────────────────────────────────
  "church-attendance-v1": {
    title: "Church Attendance walkthrough",
    steps: [
      { selector: genericHeader, title: "Sunday attendance", body: "Log Sunday service attendance with demographic breakdown." },
      { selector: '[data-tour="ca-new-report"]', title: "New report", body: "Enter the head-count and demographic split for a service.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="ca-trends"]', title: "Trends", body: "Visualise attendance trends over time to spot growth or dips." },
    ],
  },

  // ─── Follow-ups ─────────────────────────────────────────────────────────────
  "followups-v1": {
    title: "Follow-ups walkthrough",
    steps: [
      { selector: genericHeader, title: "Follow-ups", body: "Track first-timers, new converts, and members needing a personal follow-up." },
      { selector: '[data-tour="followups-new"]', title: "Log a follow-up", body: "Record contact attempts, notes and outcomes. Preferred contact modes appear prominently." },
      { selector: '[data-tour="followups-referrals"]', title: "Referrals & sign-posts", body: "Refer a case to a specialist leader or sign-post it into another unit's inbox." },
      { selector: '[data-tour="followups-templates"]', title: "Message templates", body: "Send templated SMS/email/WhatsApp updates without retyping.", when: (c) => c.isAdmin },
    ],
  },

  // ─── Pastoral Care ──────────────────────────────────────────────────────────
  "pastoral-care-v1": {
    title: "Pastoral Care walkthrough",
    steps: [
      { selector: genericHeader, title: "Pastoral care", body: "Prayer requests and pastoral needs are captured, assigned, and tracked here." },
      { selector: '[data-tour="pc-request"]', title: "New request", body: "Log a request on behalf of a member — it can convert to an active pastoral case." },
      { selector: '[data-tour="pc-assign"]', title: "Assign a pastor", body: "Assign cases to pastors and track visits, calls, and life events.", when: (c) => c.isAdmin || c.isLeader },
    ],
  },

  // ─── Communications ─────────────────────────────────────────────────────────
  "communications-v1": {
    title: "Communications walkthrough",
    steps: [
      { selector: genericHeader, title: "Communications", body: "Announcements, direct SMS/email/WhatsApp and message history all live here." },
      { selector: '[data-tour="comms-announcement"]', title: "Post an announcement", body: "Announcements can target the whole church or specific audiences — units, age groups, roles." },
      { selector: '[data-tour="comms-direct"]', title: "Direct send", body: "Send SMS, email or WhatsApp to selected members. Delivery status is logged.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="comms-history"]', title: "History", body: "Every send is recorded with delivery outcome and cost against your monthly quota." },
    ],
  },

  // ─── Transportation ────────────────────────────────────────────────────────
  "transportation-v1": {
    title: "Transportation walkthrough",
    steps: [
      { selector: genericHeader, title: "Transportation", body: "Book rides, manage driver availability, and plan routes to church." },
      { selector: '[data-tour="transport-book"]', title: "Request a ride", body: "Members request pickups; the system matches them with available drivers." },
      { selector: '[data-tour="transport-drivers"]', title: "Driver availability", body: "Drivers set their availability slots and vehicle capacity.", when: (c) => c.isAdmin || c.isLeader },
    ],
  },

  // ─── Analytics ─────────────────────────────────────────────────────────────
  "analytics-v1": {
    title: "Analytics walkthrough",
    steps: [
      { selector: genericHeader, title: "Analytics", body: "Live data-driven insights across attendance, growth, and engagement." },
      { selector: '[data-tour="analytics-charts"]', title: "Charts", body: "Trend charts for attendance, new members, follow-up conversion and more." },
      { selector: '[data-tour="analytics-absence"]', title: "Absence alerts", body: "Members drifting away are flagged so leaders can reach out." },
      { selector: '[data-tour="analytics-conversion"]', title: "Milestone & conversion reports", body: "See First Timer → New Convert → Active journeys and message the filtered cohort in one click.", when: (c) => c.isAdmin },
    ],
  },

  // ─── Bible School (exam-management) ─────────────────────────────────────────
  "exam-management-v1": {
    title: "Bible School walkthrough",
    steps: [
      { selector: genericHeader, title: "Bible School", body: "Register for courses, take exams, and view results." },
      { selector: '[data-tour="exam-sessions"]', title: "Sessions", body: "Enroll in an open exam session and pick your courses." },
      { selector: '[data-tour="exam-take"]', title: "Take an exam", body: "When a session is live, sit the exam here. Answers are graded server-side automatically." },
      { selector: '[data-tour="exam-results"]', title: "Results", body: "Once graded, your results and classification appear here — with a downloadable Statement of Result." },
    ],
  },

  // ─── Training Reports ──────────────────────────────────────────────────────
  "training-reports-v1": {
    title: "Training Reports walkthrough",
    steps: [
      { selector: genericHeader, title: "Training reports", body: "Track attendance for BFC, BCC, LCC, and LDC programs." },
      { selector: '[data-tour="training-attendees"]', title: "Attendees", body: "Mark who attended each session and their progress through the curriculum." },
    ],
  },

  // ─── Home Cell (WSF) ────────────────────────────────────────────────────────
  "wsf-v1": {
    title: "Home Cell walkthrough",
    steps: [
      { selector: genericHeader, title: "Home Cell", body: "Manage Home Cell Fellowship centres, attendance, and reports." },
      { selector: '[data-tour="wsf-attendance"]', title: "Cell attendance", body: "Log who attended your Home Cell meeting each week." },
      { selector: '[data-tour="wsf-members"]', title: "Centre members", body: "See members assigned to your centre. Addresses auto-sync from member profiles." },
    ],
  },

  // ─── Sermon Notes ──────────────────────────────────────────────────────────
  "sermon-notes-v1": {
    title: "Sermon Notes walkthrough",
    steps: [
      { selector: genericHeader, title: "Sermon notes", body: "Your personal notes on sermons, organised into folders." },
      { selector: '[data-tour="sn-folders"]', title: "Folders", body: "Group notes by series, book of the Bible, or topic." },
      { selector: '[data-tour="sn-new"]', title: "New note", body: "Create rich-text notes with headings, lists, and images. Handwriting is supported on touch devices." },
    ],
  },

  // ─── Testimony ─────────────────────────────────────────────────────────────
  "testimony-v1": {
    title: "Testimony walkthrough",
    steps: [
      { selector: genericHeader, title: "Testimony", body: "Share what God has done — structured spiritual breakthrough sharing." },
      { selector: '[data-tour="testimony-new"]', title: "Share a testimony", body: "Choose a category, describe your breakthrough, and choose visibility — private, leaders only, or public to the church." },
    ],
  },

  // ─── Unit Tasks ────────────────────────────────────────────────────────────
  "unit-tasks-v1": {
    title: "Unit Tasks walkthrough",
    steps: [
      { selector: genericHeader, title: "Unit tasks", body: "Assign, track and complete tasks within your unit." },
      { selector: '[data-tour="tasks-new"]', title: "New task", body: "Create a task, assign it to one or more members, and set a due date.", when: (c) => c.isAdmin || c.isLeader },
      { selector: '[data-tour="tasks-report"]', title: "Report", body: "See completion rates and outstanding items across the unit." },
    ],
  },

  // ─── Inventory ─────────────────────────────────────────────────────────────
  "inventory-v1": {
    title: "Inventory walkthrough",
    steps: [
      { selector: genericHeader, title: "Inventory", body: "Track church property, equipment, and consumables." },
      { selector: '[data-tour="inv-items"]', title: "Items", body: "Add or edit items — category, location, condition, and photos." },
      { selector: '[data-tour="inv-inspections"]', title: "Inspections", body: "Run scheduled inspections using checklists and record the results.", when: (c) => c.isAdmin || c.isLeader },
    ],
  },

  // ─── Reports Hub ───────────────────────────────────────────────────────────
  "reports-v1": {
    title: "Reports Hub walkthrough",
    steps: [
      { selector: genericHeader, title: "Reports Hub", body: "One place to view read-only reports across every module — Members, Attendance, Follow-ups, Home Cell, Bible School, and more." },
    ],
  },

  // ─── Settings ──────────────────────────────────────────────────────────────
  "settings-v1": {
    title: "Settings walkthrough",
    steps: [
      { selector: genericHeader, title: "Settings", body: "Church-wide configuration — branding, modules, templates, integrations and danger zone." },
      { selector: '[data-tour="settings-modules"]', title: "Modules", body: "Enable or disable modules for your church. Disabled modules disappear from the sidebar." },
      { selector: '[data-tour="settings-branding"]', title: "Branding", body: "Your logo, colours, dashboard banner, and social preview images." },
      { selector: '[data-tour="settings-restart-tours"]', title: "Replay tours", body: "Click here any time to reset onboarding and replay every module's tour." },
      { selector: '[data-tour="settings-danger"]', title: "Danger zone", body: "Permanent operations — data purge, backups, tenant deletion. Handle with care.", when: (c) => c.isTenantOwner || c.isSuperAdmin },
    ],
  },

  // ─── Tenant Admin (super admin) ────────────────────────────────────────────
  "tenant-admin-v1": {
    title: "Tenant Admin walkthrough",
    steps: [
      { selector: genericHeader, title: "Tenant Admin", body: "Super-admin oversight across every church on the platform." },
      { selector: '[data-tour="ta-tenants"]', title: "Tenants", body: "Every church, with lifecycle status (active, archived, suspended)." },
      { selector: '[data-tour="ta-billing"]', title: "Billing", body: "Subscriptions, invoices, receipts, and overage charges." },
      { selector: '[data-tour="ta-integrations"]', title: "Integrations", body: "DomiFort and other global API tokens live here." },
    ],
  },

  // ─── User Management ──────────────────────────────────────────────────────
  "user-management-v1": {
    title: "User Management walkthrough",
    steps: [
      { selector: genericHeader, title: "Users & roles", body: "Manage app users, roles and unit leader assignments." },
      { selector: '[data-tour="um-invite"]', title: "Invite users", body: "Send email invitations. Recipients set their password on first sign-in." },
      { selector: '[data-tour="um-roles"]', title: "Assign roles", body: "Grant admin, reports officer, or leader roles. Roles are stored securely, separately from profiles." },
    ],
  },

  // ─── My Family (existing) ─────────────────────────────────────────────────
  "my-family-v1": {
    title: "My Family walkthrough",
    steps: [
      { selector: '[data-tour="mf-help"]', title: "Welcome to My Family", body: "This is where you register your children, choose who is allowed to collect them, and issue one-time pickup codes. You can re-open this tour any time from this help button." },
      { selector: '[data-tour="mf-add-child"]', title: "Add each of your children", body: "Tap Add child to create a profile: name, date of birth, age group, allergies and any notes for the Children Church workers." },
      { selector: '[data-tour="mf-child-card"]', title: "Manage a child", body: "Each card shows your child. Use Edit to update details. The 'In care' badge appears when they're checked in at Children Church." },
      { selector: '[data-tour="mf-authorised"]', title: "Authorised pickup adults", body: "By default only you can pick up your child. Add trusted adults here (co-parent, grandparent, family friend) so they can collect too. Search by member name." },
      { selector: '[data-tour="mf-onetime"]', title: "One-time pickup code", body: "Need someone not on the list to collect just today? Issue a one-time code. Share it with them — it expires that same day and can only be used once." },
    ],
  },

  // ─── Children Church (existing) ───────────────────────────────────────────
  "children-church-v1": {
    title: "Children Church walkthrough",
    steps: [
      { selector: '[data-tour="cc-help"]', title: "Welcome to Children Church", body: "This is the desk workflow: drop off children safely, verify who collects them, and (for leaders) review reports. You can re-open this tour any time." },
      { selector: '[data-tour="cc-tab-checkin"]', title: "1. Drop-off / Check-in", body: "Search for the family by child, parent name or phone, then check the child in. A PIN is generated and sent to the parent by in-app notification, email and SMS." },
      { selector: '[data-tour="cc-tab-pickup"]', title: "2. Pickup", body: "At pickup, verify the collecting adult here. They must be an authorised adult, use the parent's PIN, or present a one-time pickup code." },
      { selector: '[data-tour="cc-tab-all"]', title: "All children", body: "Leaders and admins can browse every child registered in the tenant, view profiles, allergies and medical notes.", when: (ctx) => ctx.isLeader || ctx.isAdmin },
      { selector: '[data-tour="cc-tab-report"]', title: "Report", body: "Leaders and admins see the attendance report — filter by date range, export, and (admins only) remove stale records.", when: (ctx) => ctx.isLeader || ctx.isAdmin },
    ],
  },
};

export function resolveSteps(tourId, ctx = {}) {
  const t = TOURS[tourId];
  if (!t) return [];
  return t.steps.filter((s) => (typeof s.when === "function" ? s.when(ctx) : true));
}

// Map a bare pathname to the tourId that should auto-launch there.
export const ROUTE_TOURS = {
  "/": "dashboard-v1",
  "/my-profile": "my-profile-v1",
  "/members": "members-v1",
  "/events": "events-v1",
  "/church-unit": "church-unit-v1",
  "/attendance": "attendance-v1",
  "/church-attendance": "church-attendance-v1",
  "/followups": "followups-v1",
  "/pastoral-care": "pastoral-care-v1",
  "/communications": "communications-v1",
  "/transportation": "transportation-v1",
  "/analytics": "analytics-v1",
  "/exam-management": "exam-management-v1",
  "/training-reports": "training-reports-v1",
  "/wsf": "wsf-v1",
  "/sermon-notes": "sermon-notes-v1",
  "/testimony": "testimony-v1",
  "/unit-tasks": "unit-tasks-v1",
  "/inventory": "inventory-v1",
  "/reports": "reports-v1",
  "/settings": "settings-v1",
  "/tenant-admin": "tenant-admin-v1",
  "/user-management": "user-management-v1",
  "/my-family": "my-family-v1",
  "/children-church": "children-church-v1",
};
