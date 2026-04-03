

## Hide Prayer Request & Show Preferred Contact Mode in Follow-ups

### Changes

#### 1. Hide Prayer Request from Profile and Member Form

- **`src/pages/MyProfile.jsx`** — Remove the "Prayer Request" textarea (lines ~489-493) from the edit form. The `notes` field still exists in the data model but won't be editable from the profile.
- **`src/components/members/MemberFormDialog.jsx`** — Remove the "Prayer Request" textarea (lines ~634-638) from the admin member form.

#### 2. Pass preferred contact mode to follow-up

- **`src/pages/Followups.jsx`** — Add `preferred_contact_modes` to the members select join:
  ```js
  .select("*, members(first_name, last_name, email, phone, membership_status, preferred_contact_modes)")
  ```
  Map it through as `person_preferred_contact: f.members?.preferred_contact_modes`.

- **`src/components/followups/FollowupDetailPanel.jsx`** — Display the preferred contact mode in the contact info section as a badge or label (e.g. "Preferred: Phone, WhatsApp") so follow-up workers know how the member prefers to be contacted.

### Files changed
- `src/pages/MyProfile.jsx` — remove Prayer Request field
- `src/components/members/MemberFormDialog.jsx` — remove Prayer Request field
- `src/pages/Followups.jsx` — include `preferred_contact_modes` in query join
- `src/components/followups/FollowupDetailPanel.jsx` — display preferred contact mode

