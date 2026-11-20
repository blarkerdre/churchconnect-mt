// Decide whether to show a renewal reminder. dueDate: "YYYY-MM-DD" or Date.
export function renewalState({ dueDate, reminderDays, today = new Date() }) {
  const rd = Number(reminderDays ?? 7);
  if (!dueDate || rd <= 0) return { show: false };
  const d = new Date(typeof dueDate === "string" ? dueDate.slice(0, 10) + "T00:00:00Z" : dueDate);
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysLeft = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - t) / 864e5);
  return { show: daysLeft <= rd, daysLeft, overdue: daysLeft < 0, dueToday: daysLeft === 0 };
}
