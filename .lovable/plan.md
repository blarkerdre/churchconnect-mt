## Goal
Let admins see all testimonies submitted in their church on the Testimony page — showing the subject, sender, and total count — while keeping the existing member experience untouched.

## Changes

**`src/pages/Testimony.jsx`**
- Read `isAdmin` from `useAuth`.
- When `isAdmin` is true, render an additional "All Testimonies" tab (admin-only) alongside the existing "New Testimony" and "My Testimonies" tabs.
- Admin tab content:
  - Header with total count badge (e.g. "12 testimonies").
  - Search input (title / sender / situation).
  - Optional filter chips: All / Shared publicly / Private.
  - List of testimonies showing:
    - Subject (`title`)
    - Sender name (`member_name`, fallback "Anonymous")
    - Submission date
    - Public/Private indicator
    - Expand to view situation / action / god_did (reuses the same expandable card pattern already in the page).
- Query: `supabase.from("testimonies").select("*").eq("tenant_id", tenantId).order("created_at", desc)`. Admin RLS policy already permits this — no backend changes.

## Out of scope
- No DB / RLS / edge function changes.
- No edits to member submission flow or "My Testimonies" tab.
- No messaging or export actions (can be added later if requested).