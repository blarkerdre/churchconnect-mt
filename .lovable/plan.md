

## Rename "WSF" to "Home Cell" in Settings

### Summary
Replace all user-facing "WSF" / "Winners Satellite Fellowship" labels with "Home Cell" across the Settings page tab and both settings sections (Zones and Centres).

### Changes

**`src/pages/Settings.jsx`**
- Line 1043: Change tab label from `WSF` to `Home Cell`

**`src/components/settings/WSFCentresSection.jsx`**
- Line 162: `WSF Centres` → `Home Cell Centres`
- Line 164: `Manage Winners Satellite Fellowship centres` → `Manage Home Cell centres`
- Line 175: `No WSF centres configured` → `No Home Cell centres configured`

**`src/components/settings/WSFZonesSection.jsx`**
- Line 103: `WSF Zones` → `Home Cell Zones`
- Line 105: `Group WSF centres into zones…` → `Group Home Cell centres into zones…`
- Line 116: `No WSF zones configured` → `No Home Cell zones configured`

No database or backend changes required — this is a display-only rename in Settings.

