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

/**
 * Fixed WOFBI-style letter grade bands used on the Statement of Result.
 * Independent from course grade_classifications (which drive the overall result).
 */
export const LETTER_GRADE_BANDS = [
  { letter: "A+", label: "Excellent", min: 90, max: 100 },
  { letter: "A",  label: "Merit",     min: 80, max: 89  },
  { letter: "B",  label: "Very Good", min: 70, max: 79  },
  { letter: "C",  label: "Good",      min: 60, max: 69  },
  { letter: "D",  label: "Average",   min: 50, max: 59  },
  { letter: "E",  label: "Pass",      min: 40, max: 49  },
  { letter: "F",  label: "Fail",      min: 0,  max: 39  },
];

export function getLetterGrade(percentage, bands) {
  const source = Array.isArray(bands) && bands.length > 0 ? bands : LETTER_GRADE_BANDS;
  const sorted = [...source].sort((a, b) => Number(b.min) - Number(a.min));
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  for (const b of sorted) {
    if (pct >= Number(b.min)) return b;
  }
  return sorted[sorted.length - 1];
}

export function resolveLetterGradeBands(course) {
  const custom = course?.letter_grade_bands;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return LETTER_GRADE_BANDS;
}
