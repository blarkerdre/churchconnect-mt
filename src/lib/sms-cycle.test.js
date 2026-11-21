import { describe, it, expect } from "vitest";
import { smsCycleStart } from "./sms-cycle";

describe("smsCycleStart", () => {
  it("restarts on the subscription confirmation date", () => {
    expect(smsCycleStart("2026-11-18T10:00:00Z", new Date("2026-12-02T00:00:00Z")).toISOString()).toBe("2026-11-18T10:00:00.000Z");
  });
  it("uses the 1st of the month when no payment has been confirmed", () => {
    expect(smsCycleStart(null, new Date("2026-11-21T15:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});
