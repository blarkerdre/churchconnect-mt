// Returns texts available and whether the church is at/below its warning level.
export function smsLowState({ limit, used, balance, threshold }) {
  const lim = Number(limit || 0), thr = Number(threshold ?? 20);
  if (lim <= 0 || thr <= 0) return { low: false, available: null };
  const available = Math.max(0, lim - Number(used || 0)) + Number(balance || 0);
  return { low: available <= thr, empty: available === 0, available };
}
