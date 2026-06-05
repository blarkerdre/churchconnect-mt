// Email send log rows have a pending row at enqueue and a terminal
// (sent / dlq / failed / suppressed) row when finished, sharing the same
// message_id. Keep only the latest row per message_id so completed emails
// don't appear as "pending" duplicates in the UI.
export function dedupeByMessageId(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = row.message_id || row.id;
    const existing = map.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      map.set(key, row);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}
