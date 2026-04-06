/**
 * Returns the grade classification label for a given percentage
 * based on the course's configured grade bands.
 * @param {number} percentage - The score percentage (0-100)
 * @param {Array<{label: string, min_percentage: number}>} classifications - Grade bands
 * @returns {string} The classification label, or "Fail" if below all thresholds
 */
export function getGradeClassification(percentage, classifications) {
  const sorted = [...(classifications || [])].sort(
    (a, b) => b.min_percentage - a.min_percentage
  );
  for (const c of sorted) {
    if (percentage >= c.min_percentage) return c.label;
  }
  return "Fail";
}

export const DEFAULT_GRADE_CLASSIFICATIONS = [
  { label: "Distinction", min_percentage: 75 },
  { label: "Merit", min_percentage: 65 },
  { label: "Pass", min_percentage: 50 },
];
