// Mirrors server planSmsCoverage: monthly free -> top-up credits -> overage (if allowed) -> blocked.
// The allowance counts one text per recipient (one sms_log row each), whatever the message length,
// so message length must not change this check.
// A picture/flyer text (MMS) costs this many units per person. Must match MMS_UNITS on the server.
export const MMS_UNITS = 3;

export function smsSendCoverage({ limit = 0, used = 0, credits = 0, allowOverage = false, recipients = 0, unitsEach = 1 }) {
  const needed = Math.max(0, recipients) * Math.max(1, unitsEach);
  const freeLeft = limit > 0 ? Math.max(0, limit - used) : 0;
  const unlimited = !limit || limit <= 0;
  if (unlimited) return { needed, freeLeft: Infinity, credits, available: Infinity, fromFree: needed, fromCredits: 0, overage: 0, short: 0, blocked: false, unlimited: true };
  const fromFree = Math.min(needed, freeLeft);
  const fromCredits = Math.min(needed - fromFree, credits);
  const beyond = needed - fromFree - fromCredits;
  const overage = allowOverage ? beyond : 0;
  const short = allowOverage ? 0 : beyond;
  return { needed, freeLeft, credits, available: freeLeft + credits, fromFree, fromCredits, overage, short, blocked: short > 0, unlimited: false };
}
