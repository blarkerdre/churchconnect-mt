import { describe, it, expect } from "vitest";
import { smsLowState } from "./sms-low";
describe("smsLowState", () => {
  it("is low at the threshold", () => expect(smsLowState({ limit: 100, used: 80, balance: 0, threshold: 20 }).low).toBe(true));
  it("is not low above the threshold", () => expect(smsLowState({ limit: 100, used: 79, balance: 0, threshold: 20 }).low).toBe(false));
  it("counts top-up balance", () => expect(smsLowState({ limit: 100, used: 100, balance: 30, threshold: 20 }).available).toBe(30));
  it("threshold 0 turns it off", () => expect(smsLowState({ limit: 100, used: 100, balance: 0, threshold: 0 }).low).toBe(false));
  it("unlimited plans never warn", () => expect(smsLowState({ limit: 0, used: 500, balance: 0, threshold: 20 }).low).toBe(false));
});
