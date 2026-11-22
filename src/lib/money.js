export const currencySymbol = (currency) => {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).formatToParts(0).find((p) => p.type === "currency")?.value || currency;
  } catch { return currency || "£"; }
};
export function money(amount, currency) {
  const n = Number(amount || 0);
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(n); }
  catch { return `${currency || ""} ${n.toFixed(2)}`.trim(); }
}
// Never rounds up: a fractional total (e.g. 33 texts at £0.0095 = £0.3135) is
// charged and shown as the whole pence below it (£0.31), so a church never
// pays more than the exact price.
export function moneyDown(amount, currency) {
  const n = Math.floor(Number(amount || 0) * 100 + 1e-9) / 100;
  return money(n, currency);
}
