# Follow-ups Process Map — Downloadable PNG

Produce a single high-resolution PNG (`/mnt/documents/followups-process-map.png`) diagramming the entire Follow-ups workflow. Delivered via `<presentation-artifact>` so the user can preview and download it. No app code changes.

## Diagram scope (four swimlanes)

**1. Signposting flow**
Member/leader raises signpost → SignPostDialog → assigned to inbox of target leader/unit → recipient reviews in SignPostInboxDialog → Accept (converts to follow-up) / Decline (with reason) / Reassign → referral timeline updated → closure.

**2. Follow-up lifecycle**
Creation (manual, from signpost, from absence alert, from new-convert trigger) → assignment to assignee → contact attempts logged (call / SMS / WhatsApp / email / visit) → status transitions (Pending → In Progress → Awaiting Response → Completed / Unreachable / Reassigned) → outcome + notes → auto-close.

**3. Roles & permissions**
- Member: raise signpost, view own.
- Assignee (leader): action inbox, log contact, update status.
- Unit / Home Cell Leader: see unit's follow-ups, reassign within unit.
- Admin / Tenant Owner: full visibility, bulk reassign, reports, templates.
- Reports Officer: read-only across all.

**4. Notifications & escalations**
Assignment → in-app bell + email + optional SMS/WhatsApp (per template) → 48h no-action reminder → overdue banner on dashboard (OverdueReminder) → admin escalation after configured SLA → weekly digest.

## Visual design
- Landscape 2400×1600 PNG, 200 DPI feel.
- Navy (#1e3a5f) headers, gold (#c9a961) accents, white background — matches project brand.
- Playfair Display for titles, Source Sans 3 for body (fallback to DejaVu if unavailable).
- Four horizontal swimlanes with rounded nodes, arrows, decision diamonds, and a legend (node types, actor colors).
- Small footer: "Church Management Suite — Follow-ups Process Map" + generated date.

## Technical approach
- Python + `graphviz` (or `matplotlib` fallback) rendered to PNG in `/tmp/`, then moved to `/mnt/documents/followups-process-map.png`.
- Mandatory visual QA: open the PNG, check for overlaps, clipped text, arrow crossings, low contrast; iterate until clean.
- Final reply embeds:
  `<presentation-artifact path="followups-process-map.png" mime_type="image/png"></presentation-artifact>`

No changes to source code, DB, or RLS.
