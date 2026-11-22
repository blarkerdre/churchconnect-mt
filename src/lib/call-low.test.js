import { describe, it, expect } from "vitest";
import { callLowState } from "./call-low";
const s = { enabled: true, threshold: 30 };
describe("callLowState", () => {
  it("is low at the threshold", () => expect(callLowState({ limit: 100, used: 70, balance: 0, settings: s }).low).toBe(true));
  it("is not low above the threshold", () => expect(callLowState({ limit: 100, used: 69, balance: 0, settings: s }).low).toBe(false));
  it("is empty at 0", () => expect(callLowState({ limit: 100, used: 100, balance: 0, settings: s }).empty).toBe(true));
  it("is off when turned off", () => expect(callLowState({ limit: 100, used: 100, balance: 0, settings: { enabled: false, threshold: 30 } }).low).toBe(false));
  it("is off when unlimited", () => expect(callLowState({ limit: 0, used: 500, balance: 0, settings: s }).low).toBe(false));
});
