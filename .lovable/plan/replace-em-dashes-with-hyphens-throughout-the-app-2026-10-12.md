# Replace em dashes with hyphens throughout the app

## Scope confirmed

The current app source contains **800 em dashes across 211 files**: 696 in the screens and shared app code, and 104 in backend-generated messages and documents. These include visible sentences, headings, labels, notifications, empty-value placeholders and developer comments.

## Changes

- Replace every literal em dash (`—`) with a standard hyphen (`-`) across the current app source and backend functions.
- Cover all user-facing screens, dialogs, reports, downloads, emails, text messages and generated documents.
- Also replace em dashes used as empty-value placeholders and separators, so none remain in the running app.
- Leave historical database migration files and archived plans unchanged; they are records of past work and are not displayed by the app.
- Do not change en dashes (`–`), minus signs, existing hyphens, data, or business logic.

## Verification

- Search the current app source and backend functions again and confirm there are zero em dashes.
- Run the existing app checks and confirm the app still builds successfully.
