## Goal
Mirror the Children Church rename in My Family: user-visible wording for the child group becomes "Early Years", matching the Preteens and Teens sections which already have their own headings.

## Changes (src/pages/MyFamily.jsx)
- Add an "Early Years" section heading above the child list, styled like the existing "Preteens" / "Teens" headings, so the three groups read consistently.
- Header subtitle: "Manage your children and authorised pickup adults." → "Manage your Early Years children and authorised pickup adults."; the all-tenant variant "Browsing all children in this tenant." → "Browsing all Early Years records in this tenant."
- Button "Add child" → "Add Early Years child".
- Empty states: "No children added yet." → "No Early Years children added yet."; "No children registered in this tenant yet." → "No Early Years children registered in this tenant yet."
- Dialog title "Add child" / "Edit child" → "Add Early Years child" / "Edit Early Years child".
- Leave the "Promote to teenager", consent, allergy, guardian and one-time-code wording as-is (generic/legal copy).

## Optional (tell me if you want it)
- Tour copy in `src/components/tour/tours.js` (`my-family-v1`) still says "children" — I can align those step texts too.

## Not changing
- Table names, RPCs, query keys, URL params, RLS, `data-tour` attributes, permission logic — no data or behaviour changes.
