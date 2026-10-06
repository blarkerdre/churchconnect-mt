// Quote a CSV cell and neutralise spreadsheet formula injection: values that
// start with = + - @ tab or carriage return are prefixed with an apostrophe.
export function csvSafeCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
