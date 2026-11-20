// Quote a CSV cell and neutralise spreadsheet formula injection: values that
// start with = + - @ tab or carriage return are prefixed with an apostrophe.
export function csvSafeCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

// Spreadsheet formula protection that stays reversible for restores:
// a value starting with optional apostrophes followed by = + - @ tab or CR gets
// one extra leading apostrophe on export, and exactly one is removed on import.
const FORMULA_CELL = /^'*[=+\-@\t\r]/;
export function protectFormulaCell(str) {
  return FORMULA_CELL.test(str) ? "'" + str : str;
}
export function unprotectFormulaCell(str) {
  return str.startsWith("'") && FORMULA_CELL.test(str) ? str.slice(1) : str;
}
