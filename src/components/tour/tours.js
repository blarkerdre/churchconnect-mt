// Declarative tour definitions. Each step targets an element via `[data-tour="…"]`.
// Steps with `when: (ctx) => boolean` are filtered out for users who can't see the target.
// `ctx` is { isAdmin, isLeader } (add more as needed).

export const TOURS = {
  "my-family-v1": {
    title: "My Family walkthrough",
    steps: [
      {
        selector: '[data-tour="mf-help"]',
        title: "Welcome to My Family",
        body: "This is where you register your children, choose who is allowed to collect them, and issue one-time pickup codes. You can re-open this tour any time from this help button.",
      },
      {
        selector: '[data-tour="mf-add-child"]',
        title: "Add each of your children",
        body: "Tap Add child to create a profile: name, date of birth, age group, allergies and any notes for the Children Church workers.",
      },
      {
        selector: '[data-tour="mf-child-card"]',
        title: "Manage a child",
        body: "Each card shows your child. Use Edit to update details. The 'In care' badge appears when they're checked in at Children Church.",
      },
      {
        selector: '[data-tour="mf-authorised"]',
        title: "Authorised pickup adults",
        body: "By default only you can pick up your child. Add trusted adults here (co-parent, grandparent, family friend) so they can collect too. Search by member name.",
      },
      {
        selector: '[data-tour="mf-onetime"]',
        title: "One-time pickup code",
        body: "Need someone not on the list to collect just today? Issue a one-time code. Share it with them — it expires that same day and can only be used once.",
      },
    ],
  },
  "children-church-v1": {
    title: "Children Church walkthrough",
    steps: [
      {
        selector: '[data-tour="cc-help"]',
        title: "Welcome to Children Church",
        body: "This is the desk workflow: drop off children safely, verify who collects them, and (for leaders) review reports. You can re-open this tour any time.",
      },
      {
        selector: '[data-tour="cc-tab-checkin"]',
        title: "1. Drop-off / Check-in",
        body: "Search for the family by child, parent name or phone, then check the child in. A PIN is generated and sent to the parent by in-app notification, email and SMS.",
      },
      {
        selector: '[data-tour="cc-tab-pickup"]',
        title: "2. Pickup",
        body: "At pickup, verify the collecting adult here. They must be an authorised adult, use the parent's PIN, or present a one-time pickup code.",
      },
      {
        selector: '[data-tour="cc-tab-all"]',
        title: "All children",
        body: "Leaders and admins can browse every child registered in the tenant, view profiles, allergies and medical notes.",
        when: (ctx) => ctx.isLeader || ctx.isAdmin,
      },
      {
        selector: '[data-tour="cc-tab-report"]',
        title: "Report",
        body: "Leaders and admins see the attendance report — filter by date range, export, and (admins only) remove stale records.",
        when: (ctx) => ctx.isLeader || ctx.isAdmin,
      },
    ],
  },
};

export function resolveSteps(tourId, ctx = {}) {
  const t = TOURS[tourId];
  if (!t) return [];
  return t.steps.filter((s) => (typeof s.when === "function" ? s.when(ctx) : true));
}
