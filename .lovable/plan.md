

## Add WSF Zones Management

### Overview
Create a zonal grouping system for WSF centres. Admins can CRUD zones, and each WSF centre is assigned to a zone.

### Database Changes

1. **New table: `wsf_zones`**
   - `id` uuid PK
   - `name` text NOT NULL
   - `description` text nullable
   - `is_active` boolean DEFAULT true
   - `created_at`, `updated_at` timestamps
   - RLS: Admins can manage, authenticated can view

2. **Add column to `wsf_centres`**
   - `zone_id` uuid nullable, FK → `wsf_zones(id)` ON DELETE SET NULL

### UI Changes

3. **New component: `src/components/settings/WSFZonesSection.jsx`**
   - CRUD interface for zones (similar pattern to `WSFCentresSection`)
   - Card list with name, description, active badge, count of assigned centres
   - Dialog form for create/edit with name, description, active toggle

4. **Update `WSFCentresSection.jsx`**
   - Add zone selector (dropdown) in the centre create/edit form
   - Display assigned zone name on each centre card
   - Query `wsf_zones` table for the dropdown options

5. **Add `WSFZonesSection` to Settings page**
   - Render above or alongside the existing WSF Centres section

6. **Update `WSFAttendanceTab` and `WSFManagement`**
   - Group centres by zone in the attendance view for better organization

### Technical Details
- Follows existing patterns from `WSFCentresSection` for mutations and queries
- Zone selector uses the standard `Select` component
- Query key: `["wsf-zones"]`

