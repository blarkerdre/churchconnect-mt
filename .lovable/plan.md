Add Zone, Leader, and Host columns to the Home Cells Created report.

The current `WSFCreationReport` already shows a combined "Leader / Host" column and references `c.leader_name`, which does not exist on the `wsf_centres` row. This plan fixes that lookup and separates the fields.

Changes:
1. `src/pages/WSFManagement.jsx`
   - Add a query for `wsf_zones` to resolve zone names.
   - Add a query for relevant members (or leaders) to resolve `leader_id` to a name.
   - Pass the lookup arrays/maps as props to `<WSFCreationReport>`.

2. `src/components/wsf/WSFCreationReport.jsx`
   - Accept new props for zone/leader lookups.
   - Replace the combined "Leader / Host" column with two separate columns: "Leader" and "Host".
   - Add a "Zone" column (e.g., between Name and City).
   - Use the passed lookups to render zone name from `zone_id` and leader name from `leader_id`.
   - Update the print report builder so the printed version matches the on-screen columns.

No database changes are required. Only the two files above are affected.