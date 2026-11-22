import { describe, it, expect } from "vitest";
import { money, moneyDown, currencySymbol } from "./money";
describe("church currency", () => {
  it("formats in the church's currency", () => { expect(money(18, "USD")).toBe("US$18.00"); expect(money(5, "GBP")).toBe("£5.00"); });
  it("shows zero instead of hiding it", () => { expect(money(0, "CAD")).toBe("CA$0.00"); });
  it("gives the symbol for the honorarium label", () => { expect(currencySymbol("NGN")).toBe("NGN"); expect(currencySymbol("EUR")).toBe("€"); });
});
describe("moneyDown never rounds up", () => {
  it("truncates a fractional total to the whole pence below", () => {
    expect(moneyDown(0.0095 * 33, "GBP")).toBe("£0.31"); // exact 0.3135 -> 0.31, not 0.32
    expect(moneyDown(0.0095 * 105, "USD")).toBe("US$0.99"); // exact 0.9975 -> 0.99
  });
  it("leaves exact amounts untouched", () => {
    expect(moneyDown(0.095 * 500, "GBP")).toBe("£47.50");
    expect(moneyDown(4.75, "GBP")).toBe("£4.75");
  });
  it("survives floating point wobble", () => {
    expect(moneyDown(0.29 * 100, "GBP")).toBe("£29.00"); // 28.999999999999996 -> 29.00
  });
});
