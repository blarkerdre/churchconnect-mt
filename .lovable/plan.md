

## Rename "WSF Leader" to "Home Cell Leader" in All Forms

### Problem
Several UI components still display "WSF Leader" instead of "Home Cell Leader". The internal key `wsf_leader` is correct, but the display labels need updating.

### Changes

**`src/components/members/MemberFormDialog.jsx`**
- Line 424: Change `<SelectItem value="wsf_leader">WSF Leader</SelectItem>` to `Home Cell Leader`
- Lines 586 and 602: The role badges/checkboxes use `r.replace("_", " ")` which produces "wsf leader". Add a `roleLabels` map (like UserManagement has) to display proper names, mapping `wsf_leader` → "Home Cell Leader"

**`src/components/wsf/WSFCentreFormDialog.jsx`**
- Line 75: Change label from "WSF Leader Name" to "Home Cell Leader Name"
- Line 79: Change label from "WSF Leader Email" to "Home Cell Leader Email"

**`src/pages/MyProfile.jsx`**
- Line 142: Change `"Unit & WSF Leader"` to `"Unit & Home Cell Leader"`
- Line 144: Change `"WSF Leader"` to `"Home Cell Leader"`

**`src/components/AppLayout.jsx`**
- Line 105: Change `"Unit & WSF Leader"` to `"Unit & Home Cell Leader"`
- Line 107: Change `"WSF Leader"` to `"Home Cell Leader"`

