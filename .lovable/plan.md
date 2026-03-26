

## Plan: Seed Test Data for Demo Church (TEST)

### What We'll Do

Insert realistic test data into the Demo Church (TEST) tenant (`d8bbbdae-d9b3-4999-912d-3aa5999884b0`) across core tables to make the app functional for testing.

### Data to Seed

1. **Church Units** (8 records) -- Follow-up, Pastoral Care, Ushering, Media, Choir, Protocol, Children, Hospitality

2. **WSF Centres** (3 records) -- Canton, Cathays, Splott with meeting days, postcodes, locations

3. **Members** (15 records) -- Mix of Active, First Timer, New Convert, Inactive statuses; varied genders, church units, WSF membership, training completions; one linked to the admin user_id

4. **Attendance Sessions** (3 records) -- One open Sunday Service, two closed Unit Meetings with dates in last 4 weeks

5. **Attendance Records** (20+ records) -- Spread across the 3 sessions linking to seeded members

6. **Events** (3 records) -- Upcoming Bible Study, past Youth Fellowship, future Sunday Service

7. **Announcements** (2 records) -- One published, one draft

8. **Followups** (3 records) -- Pending, In Progress, Completed statuses linked to first-timer/new-convert members

### How

- Use the database insert tool for all data operations (no migrations needed)
- Insert in FK-safe order: church_units → wsf_centres → members → attendance_sessions → attendance_records → events → announcements → followups
- All records tagged with `tenant_id = 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'`
- Admin user (`6483c76f-3ce3-4f14-b0af-0c8a98ebb484`) linked to one member record and used as `created_by` where applicable

### No Code Changes Needed

This is purely a data seeding operation using the insert tool.

