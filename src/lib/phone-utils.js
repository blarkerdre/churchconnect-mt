/**
 * Normalize a phone number to E.164 format.
 * Returns the normalized string or null if invalid.
 */
export function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  // UK local number: 0xxx -> +44xxx
  if (/^0[1-9]\d{9,10}$/.test(cleaned)) {
    cleaned = "+44" + cleaned.slice(1);
  }
  // Prepend + if missing
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  // Validate E.164: + followed by 7-15 digits
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Check if a phone string is valid E.164 (after normalization).
 */
export function isValidPhone(phone) {
  return normalizePhone(phone) !== null;
}
