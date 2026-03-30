

## Transportation: Leader Notifications, Task Assignment & Tracking

### Current state
- `transportation` table has `assigned_driver` (text) and `driver_phone` (text) — free-text fields, not linked to actual unit members
- No notifications are sent when a booking is created
- No ability to reassign a booking to a specific unit member
- Manage dialog only has status, driver name, and driver phone fields

### What needs to change

#### 1. Database migration — add `assigned_to` column + trigger

Add `assigned_to UUID` column to `transportation` table (references a user_id for assignment tracking).

Create two triggers:
- **`trg_transport_new_booking`** — `AFTER INSERT` on `transportation`: notifies all Transportation unit leaders (via in-app notification + edge function for email/SMS)
- **`trg_transport_assignment`** — `AFTER UPDATE OF assigned_to` on `transportation`: when `assigned_to` changes, notifies the assigned unit member (in-app + edge function for email/SMS)

Both triggers look up leaders/members from `unit_leader_assignments` and `members` scoped by `tenant_id`.

#### 2. New edge function: `notify-transport-booking/index.ts`

Accepts: `booking_id`, `member_name`, `pickup`, `destination`, `request_date`, `tenant_id`, plus either `leader_user_ids` (array) for new booking notifications or `assigned_user_id` for assignment notifications, and a `notification_type` flag.

- Looks up contact info from `members`/`profiles`
- Sends email + SMS to the relevant recipients
- Respects tenant SMS toggle
- Logs to `email_send_log` and `sms_log`

#### 3. Frontend changes — `Transportation.jsx`

**Manage dialog enhancements:**
- Add "Assign To" dropdown populated from Transportation unit members (query `unit_leader_assignments` where `unit_name = 'Transportation'` + members in the Transportation unit via `church_unit ILIKE '%Transportation%'`)
- When saving, set `assigned_to` on the booking (triggers the assignment notification)
- Show assigned member name on booking cards

**Reporting tab/section:**
- The existing date filters, search, CSV export, and print already cover reporting needs
- Add an "Assigned To" filter dropdown alongside the existing status filter
- Summary stats: add an "Assigned" count card

#### 4. Migration SQL shape

```sql
ALTER TABLE public.transportation ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Trigger: notify leaders on new booking
CREATE OR REPLACE FUNCTION public.notify_transport_leaders_on_new_booking()
RETURNS trigger ...
-- Looks up Transportation unit leaders from unit_leader_assignments
-- Inserts in-app notification for each leader
-- Calls notify-transport-booking edge function

CREATE TRIGGER trg_transport_new_booking
AFTER INSERT ON public.transportation
FOR EACH ROW EXECUTE FUNCTION notify_transport_leaders_on_new_booking();

-- Trigger: notify assigned member
CREATE OR REPLACE FUNCTION public.notify_transport_assignment()
RETURNS trigger ...
-- Fires when assigned_to changes
-- Inserts in-app notification for the assigned member
-- Calls notify-transport-booking edge function

CREATE TRIGGER trg_transport_assignment
AFTER UPDATE OF assigned_to ON public.transportation
FOR EACH ROW EXECUTE FUNCTION notify_transport_assignment();
```

### Files changed
1. **New migration** — `assigned_to` column + two trigger functions + two triggers
2. **New edge function** — `supabase/functions/notify-transport-booking/index.ts`
3. **Edit** — `src/pages/Transportation.jsx` — assign-to dropdown in manage dialog, assigned member display on cards, assigned-to filter

### Expected result
- When a member books transport, all Transportation unit leaders get in-app + email + SMS notification
- Leader can reassign the booking to a unit member via the Manage dialog
- Assigned member gets in-app + email + SMS notification
- Leader can track, filter by assignee and date, and export reports

