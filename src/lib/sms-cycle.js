// Start of a church's current text allowance period.
// The allowance restarts on the day a subscription payment is confirmed;
// churches with no confirmed payment yet use the 1st of the calendar month.
export function smsCycleStart(cycleStart, now = new Date()) {
  if (cycleStart) { const d = new Date(cycleStart); if (!isNaN(d)) return d; }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
