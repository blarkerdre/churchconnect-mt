# Show the Bible School logo only on Bible School certificates

## What will change

- Rename **WoFBI Logo (Statement of Result)** to **Bible School Logo** throughout the certificate template editor, including upload confirmations and image descriptions.
- Show the Bible School Logo upload, preview, replace, and remove controls only when the selected certificate type matches an active Bible School course.
- Hide the control for Default and other non-Bible-School certificate types.
- Preserve any previously saved logo when editing a non-Bible-School template; hiding the control will not silently delete stored data.
- Keep certificate generation and Statement of Result logo rendering unchanged.

## Technical details

- Determine Bible School status by matching `form.training_type` against the active course names already loaded from the Bible School course list.
- Use this single condition around the existing logo control; retain the existing `wofbi_logo_url` database field for compatibility.

## Verification

- Confirm the field is hidden for Default and custom non-Bible-School templates.
- Confirm it appears after selecting an active Bible School course.
- Confirm upload, preview, remove, save, and reopen continue to work for Bible School templates.
- Confirm switching certificate types updates the field immediately without erasing saved values.
