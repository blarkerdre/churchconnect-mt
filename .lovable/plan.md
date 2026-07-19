## Diagnosis

The Children's Church Age Groups list is backed by `app_settings.children_age_groups`, read via `useAppSetting` and edited via `SettingsListSection` in `src/pages/Settings.jsx`.

Looking at `SettingsListSection` (lines 374–426), there's an **auto‑seed effect** that writes `DEFAULT_CHILDREN_AGE_GROUPS` back to the database whenever it thinks the row doesn't exist:

```js
useEffect(() => {
  if (seededRef.current) return;
  if (isLoading) return;
  if (!tenantId) return;
  if (rowExists) return;
  ...
  seededRef.current = true;
  saveMutation.mutate(defaults);   // overwrites with defaults
}, [isLoading, rowExists, tenantId, defaults]);
```

The database confirms the symptom:

- Both tenants have `children_age_groups` = `["Nursery","Toddler","Primary","Pre-Teen"]`
- Both `updated_at` timestamps are stale (mid‑June) — every edit has been silently overwritten back to defaults.

The seeding effect is racy in several realistic paths:

1. `tenantId` changes (tenant switch, first hydration) → query key changes → `queryResult` becomes `undefined` for the new key → `rowExists` reads as `false` from `queryResult?.rowExists ?? false` in the brief window before the new fetch flips `isLoading` to true. If the effect fires in that window, it upserts defaults over the real row.
2. `seededRef` is per‑mount only. Any remount (dialog navigation, tab switch, HMR in preview) restarts the "have I seeded?" check, giving the race another chance to fire.
3. The `saveMutation` invalidates with the key `["app-settings", settingsKey]`, but `useAppSetting` reads with `["app-settings", key, tenantId]`. Invalidation still matches by prefix — that's fine — but confirms the seeder and the reader share cache, so a bad seed write is immediately visible everywhere as "went back to default".

Net effect: user edits Age Groups → save succeeds → shortly after, the seed effect fires on some re‑render and writes the defaults back → UI reverts. This also affects the other list settings that use the same component (Service Types, Event Categories, Training Types, Pastoral Care Types).

## Fix

Remove the auto‑seed write entirely — it's the source of the overwrite and it isn't needed. Instead:

1. In `SettingsListSection` (`src/pages/Settings.jsx`):
   - Delete the `seededRef` + `useEffect` block that calls `saveMutation.mutate(defaults)`.
   - When no row exists yet for the tenant, show `defaults` in the UI as a starting point (read‑only presentation). The first real user action (Add / Edit / Delete) performs the initial upsert, so the row is created on demand with the user's actual intent.
   - Keep the existing `useQuery`, `saveMutation`, and `onConflict: "key,tenant_id"` logic unchanged.

2. In `src/hooks/useAppSetting.jsx`: no changes needed — it already falls back to defaults when the row is missing or empty, so consumers like `ChildrenChurch.jsx` continue to work whether or not a row has been persisted.

3. Data cleanup: none required. Existing rows stay valid; they simply won't be silently rewritten anymore.

## Verification

After the change:
- Edit "Nursery" → "Babies" in Settings → Children's Church Age Groups. Reload the Settings page and the Children's Church page. The edited value should persist in both.
- Repeat for Service Types, Event Categories, Training Types, Pastoral Care Types (same component). Confirm no reversion after reload or tenant switch.
- Query `app_settings` for `children_age_groups` and confirm `updated_at` reflects the edit time.
