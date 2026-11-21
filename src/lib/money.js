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
