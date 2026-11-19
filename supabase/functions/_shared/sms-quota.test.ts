import { describe, it, expect } from "vitest";
import { planSmsCoverage, resolveSmsUnitPrice } from "./sms-quota.ts";
describe("SMS charging rules", () => {
  it("uses church price when set", () => expect(resolveSmsUnitPrice(0.05, 0.08)).toBe(0.05));
  it("falls back to plan price", () => expect(resolveSmsUnitPrice(null, 0.08)).toBe(0.08));
  it("monthly quota first", () => expect(planSmsCoverage({ limit: 100, usage: 50, requested: 10, credits: 20, allowOverage: false })).toEqual({ allowed: true, fromCredits: 0, overage: 0 }));
  it("then top-up texts", () => expect(planSmsCoverage({ limit: 100, usage: 95, requested: 10, credits: 20, allowOverage: false })).toEqual({ allowed: true, fromCredits: 5, overage: 0 }));
  it("blocks when out and extras not allowed", () => expect(planSmsCoverage({ limit: 100, usage: 100, requested: 10, credits: 3, allowOverage: false }).allowed).toBe(false));
  it("bills extras when allowed", () => expect(planSmsCoverage({ limit: 100, usage: 100, requested: 10, credits: 3, allowOverage: true })).toEqual({ allowed: true, fromCredits: 3, overage: 7 }));
});
