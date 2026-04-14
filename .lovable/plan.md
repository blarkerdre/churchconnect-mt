

## Data Cleanup: Rename "WSF Leader" to "Home Cell Leader" in Member Data

### Problem
Six members have "WSF Leader" (or the variant "WSF Leaders") in their `church_unit` field. The `church_units` table also has a row named "WSF Leader". All need renaming to "Home Cell Leader" for consistency with the earlier UI rename.

### Affected Members

| Member | Current Value | Cleaned Value |
|--------|--------------|---------------|
| Akaninyene Umo | `Altar Minister, Follow-Up, WSF Leaders` | `Altar Minister, Follow-Up, Home Cell Leader` |
| Oyinkansola Akinmolayan | `Children Church, Transport Unit, WSF Leaders, Evangelism, WSF Leader` | `Children Church, Transport Unit, Home Cell Leader, Evangelism` |
| Olutodimu Basanya | `Ordained Ministers, CMC, Project Team, WSF Leader` | `Ordained Ministers, CMC, Project Team, Home Cell Leader` |
| Collins Okoyomon | `WSF Leader` | `Home Cell Leader` |
| Treasure Ejodamen Omotade | `Choir, Kingdom Care Covenant, WSF Leader` | `Choir, Kingdom Care Covenant, Home Cell Leader` |
| Adenya(Tayo) Selormey-Rotibi | `Choir, Communion Stewards, CSR, Evangelism, Fire Marshals and Warden, Safeguading Team, WSF Leader` | `Choir, Communion Stewards, CSR, Evangelism, Fire Marshals and Warden, Safeguading Team, Home Cell Leader` |

### Implementation

1. **Update `church_units` table** — rename "WSF Leader" to "Home Cell Leader" (via migration since it's a data update on a reference table)
2. **Update 6 member records** — fix each member's `church_unit` string, deduplicating where needed (Oyinkansola has both "WSF Leaders" and "WSF Leader")
3. Both steps use the data insert tool

### Technical Details
- Oyinkansola's record has both plural and singular variants — both get collapsed into one "Home Cell Leader"
- The `church_units` row rename ensures future form selections show the correct name

