## Goal
Prompt logged-in users to install the PWA so they get the tenant-branded app on their home screen with one tap (Android/Chrome) or clear instructions (iOS).

## Components

### 1. `useInstallPrompt` hook (`src/hooks/useInstallPrompt.jsx`)
- Captures `beforeinstallprompt` (Chrome/Edge/Android) into a ref.
- Detects platform: iOS Safari, Android Chrome, desktop, other.
- Detects already-installed (`display-mode: standalone` or `navigator.standalone`).
- Exposes: `{ canPrompt, isIOS, isInstalled, promptInstall, dismiss }`.
- `promptInstall()` calls the saved event's `prompt()` (must be from a user click).

### 2. `InstallAppDialog` (`src/components/pwa/InstallAppDialog.jsx`)
- Branded modal using `TenantDialogHeader` showing tenant logo + "Install {tenant name}".
- **Android/Chrome**: primary "Install" button → calls `promptInstall()`. On accept → close + toast.
- **iOS**: shows step-by-step instructions with Share icon → "Add to Home Screen" (no button can trigger it).
- **Desktop unsupported browsers**: short "Open this site on your phone to install" message.
- "Maybe later" button stores a dismissal timestamp in `localStorage` (key includes `tenant_id`).

### 3. Auto-trigger logic (in `AppLayout`)
- On mount for an authenticated member, if:
  - not already installed,
  - not dismissed within last 7 days,
  - tenant is resolved (so manifest has the branded name),
  - either `beforeinstallprompt` fired OR platform is iOS Safari,
- → open the dialog after a short delay (3s) on first navigation.
- Persistent install button in the user dropdown / sidebar footer ("Install app") so users can trigger it any time.

### 4. Settings opt-out (light)
- Sidebar/profile menu entry "Install app" only shown when installable or iOS, hidden once installed.

## Notes
- Cannot truly auto-install — `prompt()` requires a user click. We auto-open the dialog; the user clicks Install.
- iOS will never have a programmatic install — instructions only.
- Tenant name + icon already wired through the manifest from previous step, so the install dialog (Chrome) shows the right branding.
- No backend changes.
