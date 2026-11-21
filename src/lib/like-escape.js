// Escape LIKE/ILIKE wildcards (%, _ and \) so a value is matched literally,
// case-insensitively, and never as a pattern.
export function escapeLike(value) {
  return String(value ?? "").replace(/[\\%_]/g, (c) => `\\${c}`);
}
