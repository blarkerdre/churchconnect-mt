import { describe, it, expect } from "vitest";
import { money, currencySymbol } from "./money";
describe("church currency", () => {
  it("formats in the church's currency", () => { expect(money(18, "USD")).toBe("US$18.00"); expect(money(5, "GBP")).toBe("£5.00"); });
  it("shows zero instead of hiding it", () => { expect(money(0, "CAD")).toBe("CA$0.00"); });
  it("gives the symbol for the honorarium label", () => { expect(currencySymbol("NGN")).toBe("NGN"); expect(currencySymbol("EUR")).toBe("€"); });
});
