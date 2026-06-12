# Plan: Consolidate Certificates under Training Report

Move the Certificate Approvals workspace into the Training Report page and restrict both **Certificate Approvals** and **Certificates Report** to the Training Rep unit leader (and admins). Regular Training Rep members continue to see Training Report and use **Record Session**, but no longer see certificate entry points.

## Behavior

| Surface | Admin | Training Rep **Leader** | Training Rep **Member** | Others |
|---|---|---|---|---|
| Training Report page | Yes | Yes | Yes | Existing rules |
| Record Session button | Yes | Yes | Yes | — |
| Certificates Report button (on Training Report) | Yes | Yes | Hidden | Hidden |
| Certificate Approvals button (on Training Report) | Yes | Yes | Hidden | Hidden |
| Sidebar "Certificate Approvals" item | Removed for everyone | Removed | Removed | Removed |
| Reports Hub "Certificates" tile | Removed | Removed | Removed | Removed |
| Routes `/certificates-report`, `/certificate-approvals` | Still reachable (guarded) | Reachable | Blocked | Blocked |

Signposting from `TrainingAttendeesPanel` stays available to all Training Rep members — they still flag attendees for certificate issuance; only the leader processes them.

## Changes

### 1. `src/pages/TrainingReports.jsx`
- Add a `useQuery` for `isTrainingRepLeader` (mirror the one already in `App.jsx` / `AppLayout.jsx`: lookup in `unit_leader_assignments` for the current user, tenant, and unit name "Training Rep").
- Replace the single "Certificates Report" header button with a button group shown only when `isAdmin || isTrainingRepLeader`:
  - `Certificates Report` → `/certificates-report`
  - `Certificate Approvals` → `/certificate-approvals`
- Leave `Record Session` visibility unchanged (still `canRecordSession` + `canManageAttendees`).

### 2. `src/components/AppLayout.jsx`
- Remove the `Certificate Approvals` nav entry (the `{ name: "Certificate Approvals", … access: "training_rep_leader" }` line) and the now-unused `isTrainingRepLeader` query + `training_rep_leader` access branch.

### 3. `src/pages/Reports.jsx`
- Remove the `Certificates` tile from `MODULES` (and drop the unused `Award` icon import).

### 4. Route guards (`src/App.jsx`)
- Keep both routes mounted. Tighten `/certificates-report` so it requires `isAdmin || isTrainingRepLeader` (currently `ReportsRoute`, which lets Reports Officers in). Reuse the existing `CertificateApprovalsRoute` pattern, or rename to a shared `TrainingRepLeaderRoute` and use it for both routes.

## Out of scope
- No database / RLS changes. Existing policies on `training_attendees` and certificate tables already restrict approval actions; this change only hides UI entry points and tightens client-side route guards.
- No changes to signposting flow, certificate templates, or issuance logic.
- No changes to the Training Report list, filters, CSV export, or attachments.

## Files touched
- `src/pages/TrainingReports.jsx`
- `src/components/AppLayout.jsx`
- `src/pages/Reports.jsx`
- `src/App.jsx`
