

## Add Admin-Configurable External Links

### Overview
Admins can manage a list of external links (title, URL, description, icon) from Settings. These links appear as quick-action cards on the Member Dashboard and as items in the sidebar navigation.

### Changes

**1. Settings — new "External Links" tab** (`src/pages/Settings.jsx`)
- Add a new tab "Links" with a `Link2` icon
- Build an `ExternalLinksSection` component (similar to `ChurchUnitsSection` pattern)
- Store links in `app_settings` with key `external_links` as a JSON array: `[{ title, url, description, icon }]`
- Form dialog with fields: Title, URL, Description, and an icon picker (dropdown of ~12 common lucide icon names like `Globe`, `BookOpen`, `ExternalLink`, `GraduationCap`, `Church`, `Wallet`, `Music`, `Video`, `FileText`, `Phone`, `Mail`, `Heart`)
- Support add, edit, delete, reorder

**2. Member Dashboard** (`src/components/dashboard/MemberDashboard.jsx`)
- Fetch `external_links` from `app_settings` using `useAppSetting("external_links", [])`
- Render a "Quick Links" card section below the existing quick actions grid
- Each link shown as a clickable card that opens `target="_blank"` with the configured icon, title, and description

**3. Sidebar** (`src/components/AppLayout.jsx`)
- Fetch `external_links` using `useAppSetting`
- Render them below the main nav items as a small "Links" group with a divider
- Each item shows the icon and title, links open in a new tab
- Visible to all authenticated users

**4. Dynamic Icon component** (inline helper)
- A small mapping of icon-name strings to lucide-react components used by both the dashboard and sidebar to render the admin-selected icon

### No database changes needed
Uses the existing `app_settings` table with key `external_links`. No migration required.

